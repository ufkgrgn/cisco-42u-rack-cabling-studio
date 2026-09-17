const { spawnSync } = require("child_process");
const path = require("path");

const batPath = path.resolve(__dirname, "build-android.bat");
const args = process.argv.slice(2);
const res = spawnSync("cmd.exe", ["/c", batPath, ...args], { stdio: "inherit" });
process.exit(res.status ?? 0);

