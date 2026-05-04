// Phase 2 smoke test: spin up libobs on Mac, load Mac modules from the
// OSN tarball checked into the consuming wow-recorder repo, list
// encoders/sources/outputs, then shut down cleanly.
//
// Run from the noobs repo root:
//   node test/mac-init.js
//
// The libobs.framework + dylib symlinks must be in place under
// noobs/Frameworks/ (set up during Phase 1 spike — see plan).

const path = require('path');
const fs = require('fs');
const os = require('os');

const noobs = require(path.join(__dirname, '..', 'build', 'Release', 'noobs.node'));

// distPath layout we expect (vendored, all under noobs/):
//   <dist>/Frameworks/libobs.framework         vanilla libobs from obs-studio
//   <dist>/Frameworks/libobs-opengl.dylib       graphics module
//   <dist>/Frameworks/lib*.dylib                ffmpeg + crypto deps
//   <dist>/PlugIns/*.plugin                     Mac plugin bundles
//   <dist>/data/effects/                        libobs effects (.effect files)
//
// Phase 5 builds these from obsproject/obs-studio source — see plan.
const noobsRoot = path.resolve(__dirname, '..');
const stage = noobsRoot;

const logDir = path.join(os.tmpdir(), 'noobs-mac-log');
fs.mkdirSync(logDir, { recursive: true });

console.log('[smoke] dist:', stage);
console.log('[smoke] log:', logDir);

let signalCount = 0;
const cb = (sig) => {
  signalCount++;
  console.log('[smoke] signal', sig);
};

console.log('[smoke] calling Init…');
try {
  noobs.Init(stage, logDir, cb);
} catch (err) {
  console.error('[smoke] Init threw:', err.message);
  process.exit(2);
}
console.log('[smoke] Init returned');

try {
  const encoders = noobs.ListVideoEncoders();
  console.log('[smoke] video encoders:', encoders);
} catch (err) {
  console.error('[smoke] ListVideoEncoders threw:', err.message);
}

console.log('[smoke] Shutdown…');
try {
  noobs.Shutdown();
} catch (err) {
  console.error('[smoke] Shutdown threw:', err.message);
}
console.log('[smoke] done; signals received:', signalCount);
