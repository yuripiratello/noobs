// Phase 3 smoke test: capture the main display via mac-capture's
// screen_capture source, encode with the software x264 fallback (no
// VideoToolbox so we don't need TCC for this first pass), and write
// a few seconds of MP4 to /tmp.
//
// Run from the noobs repo root:
//   DYLD_FALLBACK_LIBRARY_PATH=$PWD/Frameworks node test/mac-record.js
//
// First run will trigger a Screen Recording permission prompt — Node
// is the binary that needs the grant.

const path = require('path');
const fs = require('fs');
const os = require('os');

const noobs = require(path.join(__dirname, '..', 'build', 'Release', 'noobs.node'));

const stage = path.resolve(__dirname, '..');
const logDir = path.join(os.tmpdir(), 'noobs-mac-log');
fs.mkdirSync(logDir, { recursive: true });

const outDir = path.join(os.tmpdir(), 'noobs-mac-rec');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const captureSeconds = parseInt(process.env.SECONDS || '5', 10);
const encoder = process.env.ENCODER || 'obs_x264'; // VT_HEVC: 'com.apple.videotoolbox.videoencoder.ave.hevc'

console.log('[smoke] dist:', stage);
console.log('[smoke] log:', logDir);
console.log('[smoke] out:', outDir);
console.log('[smoke] capture:', captureSeconds, 's encoder:', encoder);

const signals = [];
noobs.Init(stage, logDir, (sig) => {
  signals.push(sig);
  console.log('[signal]', sig);
});

// Live recording (not replay buffer) keeps this test simple.
noobs.SetBuffering(false);
noobs.SetRecordingCfg(outDir, 'mp4');
noobs.ResetVideoContext(30, 1920, 1080);

// Encoder. obs_x264 is bundled, low risk for first recording test.
// VT_HEVC needs the GPU encoder + ScreenCaptureKit grant working.
noobs.SetVideoEncoder(encoder, {
  rate_control: 'CRF',
  crf: 26,
  keyint_sec: 1,
});

// Display capture via mac-capture's screen_capture source.
//   type 0 = display, 1 = window, 2 = application bundle id.
const sourceName = noobs.CreateSource('Main Display', 'screen_capture');
console.log('[smoke] created source:', sourceName);

noobs.SetSourceSettings(sourceName, {
  type: 0, // ScreenCaptureDisplayStream — main display.
  show_cursor: true,
  hide_obs: true,
});

noobs.AddSourceToScene(sourceName);

console.log('[smoke] starting recording…');
noobs.StartRecording(0);

// Sleep without blocking the libuv signal callbacks.
setTimeout(() => {
  console.log('[smoke] stopping recording…');
  noobs.StopRecording();

  // Give libobs a moment to flush.
  setTimeout(() => {
    const last = noobs.GetLastRecording();
    console.log('[smoke] last recording:', last);
    if (last && fs.existsSync(last)) {
      const stat = fs.statSync(last);
      console.log('[smoke] OUTPUT', last, stat.size, 'bytes');
    } else {
      console.warn('[smoke] no output file');
    }

    noobs.Shutdown();
    console.log('[smoke] done. signals:', signals.length);
  }, 1500);
}, captureSeconds * 1000);
