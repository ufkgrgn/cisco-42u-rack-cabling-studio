const { spawnSync } = require('child_process');
const path = require('path');

const batPath = path.resolve(__dirname, 'build-tauri.bat');
const res = spawnSync('cmd.exe', ['/c', batPath], { stdio: 'inherit' });
process.exit(res.status ?? 0);
