@echo off
chcp 65001 >nul
title Cisco Enterprise 42U Rack Cabling Studio

echo ========================================================
echo   Cisco Enterprise 42U Rack ^& Cabling Studio
echo ========================================================
echo.

:: Try opening index.html directly in default browser
echo [1/1] Stüdyo varsayılan tarayıcınızda açılıyor...
start "" "%~dp0index.html"

echo.
echo Başarıyla açıldı! Bu pencereyi kapatabilirsiniz.
timeout /t 3 >nul
exit
