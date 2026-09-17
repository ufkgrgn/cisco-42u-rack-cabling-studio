@echo off
if exist "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" (
  call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
)
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "NDK_HOME=%LOCALAPPDATA%\Android\Sdk\ndk\27.2.12479018"
set "PATH=%JAVA_HOME%\bin;%USERPROFILE%\.cargo\bin;%ANDROID_HOME%\platform-tools;%PATH%"
npx tauri android build --apk %*
