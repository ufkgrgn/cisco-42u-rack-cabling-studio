@echo off
title Visual Studio C++ Desktop Tools Installer
echo ====================================================================
echo  Cisco Studio - C++ Build Tools & Windows SDK Kurulumu
echo ====================================================================
echo.
echo Bu islem Visual Studio Community uzerine:
echo   - MSVC C++ x64/x86 Derleme Araclari
echo   - Windows 10/11 SDK ve msvcrt.lib
echo bilesenlerini otomatik olarak ekleyecektir.
echo.

"C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" modify --installPath "C:\Program Files\Microsoft Visual Studio\18\Community" --add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended --passive

echo.
echo ====================================================================
echo Kurulum tamamlandi!
echo Artik terminalde "npm run tauri:build" komutunu calistirabilirsiniz.
echo ====================================================================
pause
