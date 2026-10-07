@echo off
chcp 65001 >nul
title Cloudflare Remote Tunnel - Cisco 3D Rack Studio

echo ===============================================================================
echo       CISCO 3D RACK CABLING STUDIO - CLOUDFLARE REMOTE ACCESS
echo ===============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "BIN_DIR=%SCRIPT_DIR%..\bin"
if not exist "%BIN_DIR%\cloudflared.exe" (
    set "BIN_DIR=%SCRIPT_DIR%bin"
)
if not exist "%BIN_DIR%\cloudflared.exe" (
    set "BIN_DIR=D:\RackCabinet\bin"
)

set "CLOUDFLARED=%BIN_DIR%\cloudflared.exe"
if not exist "%CLOUDFLARED%" (
    echo [HATA] cloudflared.exe bulunamadi: %CLOUDFLARED%
    pause
    exit /b 1
)

echo [1/2] Yerel web sunucusu (Port 4173) kontrol ediliyor...
curl.exe -s -o nul http://127.0.0.1:4173 >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Yerel sunucu zaten calisiyor.
) else (
    echo [INFO] Yerel sunucu arka planda baslatiliyor...
    start /b "" node "%SCRIPT_DIR%scripts\serve.cjs"
    timeout /t 2 >nul
)

echo [2/2] Cloudflare Guvenli Tunel baslatiliyor...
echo.
echo ===============================================================================
echo   Asagidaki "trycloudflare.com" linki uzerinden tum cihazlardan erisebilirsiniz.
echo   Tuneli durdurmak icin Ctrl + C yapabilirsiniz.
echo ===============================================================================
echo.

"%CLOUDFLARED%" tunnel --url http://127.0.0.1:4173

pause
