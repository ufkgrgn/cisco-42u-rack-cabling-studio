@echo off
setlocal enabledelayedexpansion
title Cisco 42U Rack ^& Cabling Studio - Build Manager

:: ============================================================================
:: 1. TOOLCHAIN & ENVIRONMENT SETUP
:: ============================================================================

:: MSVC Visual Studio Environment
if exist "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" (
    call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
) else if exist "C:\Program Files\Microsoft Visual Studio\18\Insiders\VC\Auxiliary\Build\vcvars64.bat" (
    call "C:\Program Files\Microsoft Visual Studio\18\Insiders\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
) else if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
    call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
)

:: Java Development Kit (JDK 17)
if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot" (
        set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
    ) else if exist "C:\Program Files\Java\jdk-17" (
        set "JAVA_HOME=C:\Program Files\Java\jdk-17"
    )
)

:: Android SDK & NDK
if "%ANDROID_HOME%"=="" (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    )
)

if "%NDK_HOME%"=="" (
    if exist "%ANDROID_HOME%\ndk\27.2.12479018" (
        set "NDK_HOME=%ANDROID_HOME%\ndk\27.2.12479018"
    ) else (
        for /f "delims=" %%D in ('dir /b /ad /o-n "%ANDROID_HOME%\ndk" 2^>nul') do (
            if not defined NDK_HOME set "NDK_HOME=%ANDROID_HOME%\ndk\%%D"
        )
    )
)

:: Update PATH
set "PATH=%JAVA_HOME%\bin;%USERPROFILE%\.cargo\bin;%ANDROID_HOME%\platform-tools;%PATH%"

:: Change directory to project root
cd /d "%~dp0"

:: ============================================================================
:: 2. ARGUMENT HANDLING (Headless Mode)
:: ============================================================================
if "%~1"=="0" exit /b 0
if /i "%~1"=="help" goto :SHOW_HELP
if /i "%~1"=="--help" goto :SHOW_HELP
if /i "%~1"=="-h" goto :SHOW_HELP
if /i "%~1"=="desktop" goto :BUILD_DESKTOP
if /i "%~1"=="desktop-dev" goto :DEV_DESKTOP
if /i "%~1"=="android" goto :BUILD_ANDROID_DEBUG
if /i "%~1"=="android-release" goto :BUILD_ANDROID_RELEASE
if /i "%~1"=="android-aab" goto :BUILD_ANDROID_AAB
if /i "%~1"=="android-dev" goto :DEV_ANDROID
if /i "%~1"=="web" goto :BUILD_WEB
if /i "%~1"=="all" goto :BUILD_ALL

:: ============================================================================
:: 3. INTERACTIVE MENU
:: ============================================================================
:MENU
cls
echo ===============================================================================
echo            CISCO 42U RACK STUDIO - DERLEME VE YAYIN YONETICISI
echo ===============================================================================
echo.
echo [1] Windows Desktop Derle (Release Installer - NSIS Setup / EXE)
echo [2] Windows Desktop Gelistirme (Tauri Dev - Canli Tarayici / Pencere)
echo.
echo [3] Android APK Derle (Debug APK - Hizli Cihaz Testi)
echo [4] Android APK Derle (Release APK - Dagitim ve Kurulum)
echo [5] Android AAB Derle (Release App Bundle - Google Play Store)
echo [6] Android Gelistirme (Tauri Android Dev - Bagli Cihaz / Emulator)
echo.
echo [7] Web / Dist Derle (npm run build)
echo [8] Tam Derleme (Hem Desktop Hem Android Release APK)
echo.
echo [0] Cikis
echo ===============================================================================
echo Ortam Bilgisi:
echo   JAVA_HOME    : %JAVA_HOME%
echo   ANDROID_HOME : %ANDROID_HOME%
echo   NDK_HOME     : %NDK_HOME%
echo ===============================================================================
set /p "CHOICE=Seciminiz [0-8]: "

if "%CHOICE%"=="1" goto :BUILD_DESKTOP
if "%CHOICE%"=="2" goto :DEV_DESKTOP
if "%CHOICE%"=="3" goto :BUILD_ANDROID_DEBUG
if "%CHOICE%"=="4" goto :BUILD_ANDROID_RELEASE
if "%CHOICE%"=="5" goto :BUILD_ANDROID_AAB
if "%CHOICE%"=="6" goto :DEV_ANDROID
if "%CHOICE%"=="7" goto :BUILD_WEB
if "%CHOICE%"=="8" goto :BUILD_ALL
if "%CHOICE%"=="0" exit /b 0

echo Gecersiz secim. Lutfen tekrar deneyin.
timeout /t 2 >nul
goto :MENU

:: ============================================================================
:: ACTIONS
:: ============================================================================

:BUILD_DESKTOP
echo.
echo [1/2] Web arayuzu ve modulleri derleniyor...
call npm run build
if errorlevel 1 (
    echo [HATA] Web derlemesi basarisiz oldu!
    pause
    goto :MENU
)
echo.
echo [2/2] Tauri Windows Desktop (NSIS / Release) derleniyor...
call npx tauri build
if errorlevel 1 (
    echo [HATA] Desktop derlemesi basarisiz oldu!
) else (
    echo.
    echo ===============================================================================
    echo [BASARILI] Windows Desktop surumu olusturuldu!
    echo Cikti Dizini: src-tauri\target\release\bundle\nsis\
    echo ===============================================================================
)
pause
goto :MENU

:DEV_DESKTOP
echo.
echo Tauri Desktop Gelistirme Modu baslatiliyor...
call npx tauri dev
pause
goto :MENU

:BUILD_ANDROID_DEBUG
echo.
echo [1/2] Web arayuzu derleniyor...
call npm run build
if errorlevel 1 (
    echo [HATA] Web derlemesi basarisiz oldu!
    pause
    goto :MENU
)
echo.
echo [2/2] Tauri Android Debug APK derleniyor...
call npx tauri android build --apk --debug
if errorlevel 1 (
    echo [HATA] Android Debug APK derlemesi basarisiz oldu!
) else (
    echo.
    echo ===============================================================================
    echo [BASARILI] Android Debug APK olusturuldu!
    echo Cikti Dizini: src-tauri\gen\android\app\build\outputs\apk\universal\debug\
    echo ===============================================================================
)
pause
goto :MENU

:BUILD_ANDROID_RELEASE
echo.
echo [1/2] Web arayuzu derleniyor...
call npm run build
if errorlevel 1 (
    echo [HATA] Web derlemesi basarisiz oldu!
    pause
    goto :MENU
)
echo.
echo [2/2] Tauri Android Release APK derleniyor...
call npx tauri android build --apk
if errorlevel 1 (
    echo [HATA] Android Release APK derlemesi basarisiz oldu!
) else (
    set "OUT_DIR=src-tauri\gen\android\app\build\outputs\apk\universal\release"
    if exist "!OUT_DIR!\app-universal-release-unsigned.apk" (
        echo.
        echo [3/3] APK otomatik imzalaniyor (Debug Keystore)...
        for /f "delims=" %%S in ('dir /b /ad /o-n "%ANDROID_HOME%\build-tools" 2^>nul') do (
            if not defined BUILD_TOOLS_DIR set "BUILD_TOOLS_DIR=%ANDROID_HOME%\build-tools\%%S"
        )
        if exist "!BUILD_TOOLS_DIR!\apksigner.bat" (
            call "!BUILD_TOOLS_DIR!\apksigner.bat" sign --ks "%USERPROFILE%\.android\debug.keystore" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out "!OUT_DIR!\app-universal-release-signed.apk" "!OUT_DIR!\app-universal-release-unsigned.apk" >nul 2>&1
        )
    )
    echo.
    echo ===============================================================================
    echo [BASARILI] Android Release APK olusturuldu ve imzalandi!
    echo Cihaziniza yuklenecek dosya:
    if exist "!OUT_DIR!\app-universal-release-signed.apk" (
        echo   !OUT_DIR!\app-universal-release-signed.apk
    ) else if exist "!OUT_DIR!\app-universal-release.apk" (
        echo   !OUT_DIR!\app-universal-release.apk
    ) else (
        echo   !OUT_DIR!\
    )
    echo ===============================================================================
)
pause
goto :MENU

:BUILD_ANDROID_AAB
echo.
echo [1/2] Web arayuzu derleniyor...
call npm run build
if errorlevel 1 (
    echo [HATA] Web derlemesi basarisiz oldu!
    pause
    goto :MENU
)
echo.
echo [2/2] Tauri Android Release AAB (App Bundle) derleniyor...
call npx tauri android build
if errorlevel 1 (
    echo [HATA] Android AAB derlemesi basarisiz oldu!
) else (
    echo.
    echo ===============================================================================
    echo [BASARILI] Android AAB Bundle olusturuldu!
    echo Cikti Dizini: src-tauri\gen\android\app\build\outputs\bundle\universalRelease\
    echo ===============================================================================
)
pause
goto :MENU

:DEV_ANDROID
echo.
echo Tauri Android Gelistirme Modu (Bagli Cihaz / Emulator) baslatiliyor...
call npx tauri android dev
pause
goto :MENU

:BUILD_WEB
echo.
echo Web arayuzu derleniyor (npm run build)...
call npm run build
if errorlevel 1 (
    echo [HATA] Web derlemesi basarisiz oldu!
) else (
    echo.
    echo ===============================================================================
    echo [BASARILI] Web / dist dosyalari guncellendi!
    echo ===============================================================================
)
pause
goto :MENU

:BUILD_ALL
echo.
echo [1/3] Web arayuzu derleniyor...
call npm run build
if errorlevel 1 (
    echo [HATA] Web derlemesi basarisiz oldu!
    pause
    goto :MENU
)
echo.
echo [2/3] Windows Desktop Installer derleniyor...
call npx tauri build
if errorlevel 1 (
    echo [UYARI] Desktop derlemesi hata verdi, Android adimina geciliyor...
)
echo.
echo [3/3] Android Release APK derleniyor...
call npx tauri android build --apk
echo.
echo ===============================================================================
echo Tum derleme islemleri tamamlandi!
echo ===============================================================================
pause
goto :MENU

:SHOW_HELP
echo.
echo ===============================================================================
echo Kullanim: build.bat [secenek]
echo.
echo   desktop          : Windows Desktop Release Installer (NSIS Setup / EXE)
echo   desktop-dev      : Windows Desktop Gelistirme (Tauri Dev)
echo   android          : Android Debug APK
echo   android-release  : Android Release APK
echo   android-aab      : Android Release AAB (Google Play Bundle)
echo   android-dev      : Android Gelistirme (Cihaz / Emulator Canli)
echo   web              : Web / Dist Derleme (npm run build)
echo   all              : Hem Desktop Hem Android Release APK
echo   (Parametresiz)   : Etkilesimli Grafik/Metin Menusunu Acar
echo ===============================================================================
exit /b 0
