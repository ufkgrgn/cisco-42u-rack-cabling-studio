const { spawnSync } = require('child_process');
const path = require('path');

const batPath = path.resolve(__dirname, 'build-tauri.bat');
const offline = process.argv.includes('--offline');
const res = spawnSync('cmd.exe', ['/c', batPath, ...(offline ? ['--offline'] : [])], { stdio: 'inherit' });
process.exit(res.status ?? 0);
