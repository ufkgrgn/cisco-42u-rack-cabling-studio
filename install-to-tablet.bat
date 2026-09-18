@echo off
setlocal enabledelayedexpansion
title Android Cihaza Otomatik Yukleme Araci

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
    set "ADB=adb"
)

set "APK_SIGNED=src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release-signed.apk"
set "APK_DEBUG=src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk"
set "APK_RELEASE=src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk"

set "TARGET_APK="
if exist "%APK_SIGNED%" (
    set "TARGET_APK=%APK_SIGNED%"
) else if exist "%APK_RELEASE%" (
    set "TARGET_APK=%APK_RELEASE%"
) else if exist "%APK_DEBUG%" (
    set "TARGET_APK=%APK_DEBUG%"
)

echo ===============================================================================
echo          CISCO 42U RACK STUDIO - TABLETE OTOMATIK YUKLEME ARACI
echo ===============================================================================
echo.
if not defined TARGET_APK (
    echo [HATA] Yuklenecek APK bulunamadi! Once 'build.bat' ile uygulamayi derleyin.
    pause
    exit /b 1
)

echo Yuklenecek Paket: %TARGET_APK%
echo.
echo Cihaz baglantisi kontrol ediliyor...
echo Lutfen tabletinizin USB ile bilgisayara bagli ve 'USB Hata Ayiklama' modunun acik oldugundan emin olun.
echo.

:CHECK_DEVICE
for /f "skip=1 tokens=1,2" %%A in ('"%ADB%" devices 2^>nul') do (
    if "%%B"=="device" (
        set "DEVICE_ID=%%A"
        goto :FOUND_DEVICE
    ) else if "%%B"=="unauthorized" (
        echo [UYARI] Tablet algilandi ancak izin verilmemis!
        echo Lutfen tablet ekraninda cikan "Bu bilgisayara her zaman izin ver" kutucugunu secip "Tamam / Izin Ver"e basin.
        timeout /t 3 >nul
        goto :CHECK_DEVICE
    )
)

echo Cihaz henuz algilanmadi. Bekleniyor...
echo (Iptal etmek icin Ctrl+C tuslarina basabilirsiniz)
"%ADB%" wait-for-device >nul 2>&1
goto :CHECK_DEVICE

:FOUND_DEVICE
echo [BASARILI] Tablet baglandi: %DEVICE_ID%
echo.
echo Uygulama yukleniyor, lutfen bekleyin...
"%ADB%" install -r -d "%TARGET_APK%"
if errorlevel 1 (
    echo.
    echo [HATA] Yukleme basarisiz oldu.
    echo Olasiliklar:
    echo 1. Tablette eski/cakisan bir surum varsa onu tablet ekranindan kaldirin.
    echo 2. Tablet ekraninda "Play Protect" uyarisi cikarsa "Yine de yukle"ye basin.
) else (
    echo.
    echo ===============================================================================
    echo [TEBRIKLER] Uygulama basariyla tablete yuklendi!
    echo Uygulama tablette aciliyor...
    echo ===============================================================================
    "%ADB%" shell monkey -p com.cisco.rackcablingstudio -c android.intent.category.LAUNCHER 1 >nul 2>&1
)

echo.
pause
