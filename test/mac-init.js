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

// distPath layout we assume:
//   <dist>/data/effects/         libobs effects (.effect files)
//   <dist>/PlugIns/*.plugin       Mac plugin bundles
//
// OSN ships effects under data/libobs/, not data/effects/. Build a
// staging dir that aliases the layout libobs expects.
const osnRoot = path.resolve(
  __dirname,
  '..',
  '..',
  'wow-recorder',
  'release',
  'app',
  'node_modules',
  'obs-studio-node',
);

if (!fs.existsSync(osnRoot)) {
  console.error('OSN root not found:', osnRoot);
  process.exit(1);
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'noobs-mac-stage-'));
const dataDir = path.join(stage, 'data');
fs.mkdirSync(dataDir);

// Effects path: noobs adds <dist>/data/effects/. OSN's libobs/data
// holds the .effect files at the root. Symlink so layout matches.
fs.symlinkSync(path.join(osnRoot, 'data', 'libobs'), path.join(dataDir, 'effects'));

// PlugIns: noobs reads from <dist>/PlugIns/<name>.plugin
fs.symlinkSync(path.join(osnRoot, 'PlugIns'), path.join(stage, 'PlugIns'));

// Frameworks: libobs-opengl.dylib + transitive ffmpeg/mbedtls libs.
// libobs's @rpath was baked as @executable_path/../Frameworks which
// resolves wrong when noobs.node loads inside Node. Symlink Frameworks/
// into the stage dir so init_obs can hand libobs an absolute path.
fs.symlinkSync(path.join(osnRoot, 'Frameworks'), path.join(stage, 'Frameworks'));

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
