@echo off
if exist "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" (
  call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
)
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
if "%~1"=="--offline" (
  npx tauri build --config src-tauri/tauri.offline.conf.json
) else (
  npx tauri build
)
