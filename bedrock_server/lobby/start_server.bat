@echo off
REM Bedrock Server Launcher
REM This script starts the Minecraft Bedrock Server

REM Change to the script directory
cd /d "%~dp0"

echo Starting Bedrock Server...
echo ================================
echo Current Directory: %cd%
echo.

REM Check if bedrock_server.exe exists
if not exist "bedrock_server.exe" (
    echo ERROR: bedrock_server.exe not found!
    echo Expected location: %cd%\bedrock_server.exe
    echo Please ensure bedrock_server.exe is in this directory.
    pause
    exit /b 1
)

REM Start the server
echo Launching bedrock_server.exe...
echo.
bedrock_server.exe

REM Server closed
echo.
echo Server has stopped.
pause
