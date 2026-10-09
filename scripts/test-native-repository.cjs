const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const candidates = [
  'C:/Program Files/Microsoft Visual Studio/18/Community/VC/Auxiliary/Build/vcvars64.bat',
  'C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Auxiliary/Build/vcvars64.bat',
  'C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Auxiliary/Build/vcvars64.bat'
];
const environment = candidates.find(file => fs.existsSync(file));
function cargo(args) {
  const result = process.platform === 'win32' && environment
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `""${environment}" && cargo ${args.join(' ')}"`], { cwd:path.join(root,'src-tauri'), stdio:'inherit', windowsVerbatimArguments:true })
    : spawnSync('cargo', args, { cwd:path.join(root,'src-tauri'), stdio:'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
cargo(['test','--lib']);
cargo(['build','--example','repository_ipc']);
const executable = path.join(root,'src-tauri/target/debug/examples/repository_ipc' + (process.platform === 'win32' ? '.exe' : ''));
const result = spawnSync(process.execPath, ['--test','tests/project-native-repository.test.cjs'], {
  cwd:root, stdio:'inherit', env:{ ...process.env, RACK_STUDIO_NATIVE_TEST_EXE:executable }
});
process.exit(result.status ?? 1);
