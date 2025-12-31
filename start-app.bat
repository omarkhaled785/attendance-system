@echo off
title نظام الحضور والانصراف - إصدار سريع
chcp 65001 >nul

echo ========================================
echo جاري تشغيل نظام الحضور والانصراف
echo ========================================

:: Set performance flags
set ELECTRON_DISABLE_GPU=1
set ELECTRON_ENABLE_LOGGING=1
set NODE_ENV=production
set ELECTRON_NO_ASAR=1
set ELECTRON_NO_ATTACH_CONSOLE=1
set ELECTRON_ENABLE_HIGH_DPI_SCALING=1
set ELECTRON_DEFAULT_ERROR_MODE=1

:: Check for existing process
tasklist /FI "IMAGENAME eq electron.exe" 2>NUL | find /I /N "electron.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ⚠️  النظام يعمل بالفعل!
    pause
    exit /b
)

:: Start the application
echo ✅ بدء التشغيل... يرجى الانتظار
call npm run electron:dev

if %ERRORLEVEL% neq 0 (
    echo ❌ حدث خطأ في التشغيل
    pause
)