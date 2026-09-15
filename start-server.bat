@echo off
chcp 65001 >nul
title Cisco Enterprise 3D Rack Cabling Studio

echo ========================================================
echo   Cisco Enterprise 3D Rack ^& Cabling Studio (60 FPS)
echo ========================================================
echo.

set "NODE_PATH=C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64"
if exist "%NODE_PATH%\node.exe" (
    set "PATH=%NODE_PATH%;%PATH%"
)

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [1/2] 3D Stüdyo yerel web sunucusu başlatılıyor (http://127.0.0.1:4173)...
    start /b "" node scripts/serve.cjs
    timeout /t 1 >nul
    echo [2/2] 3D Stüdyo tarayıcınızda açılıyor...
    start "" "http://127.0.0.1:4173"
) else (
    echo [1/1] 3D Stüdyo doğrudan tarayıcınızda açılıyor...
    start "" "%~dp0index.html"
)

echo.
echo Başarıyla açıldı! 3D Stüdyo keyfini çıkarabilirsiniz.
timeout /t 3 >nul
exit
