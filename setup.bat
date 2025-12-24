@echo off
title Attendance System - Setup

echo ================================
echo Attendance System Setup
echo ================================

:: Check Node.js
node -v >nul 2>&1
IF ERRORLEVEL 1 (
    echo Node.js not found.
    echo Opening Node.js installer...
    start https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi
    echo After installation, run setup.bat again.
    pause
    exit /b
)

echo Node.js detected:
node -v

echo Installing dependencies...
npm install

echo ================================
echo Setup completed successfully
echo Now double-click start.bat
echo ================================
pause
