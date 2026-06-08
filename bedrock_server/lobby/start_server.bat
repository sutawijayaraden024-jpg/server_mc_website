@echo off
REM Bedrock Server Launcher
REM This script starts the Minecraft Bedrock Server

echo Starting Bedrock Server...
echo ================================
echo.

REM Check if bedrock_server.exe exists
if not exist "bedrock_server.exe" (
    echo ERROR: bedrock_server.exe not found!
    echo Please ensure bedrock_server.exe is in this directory.
    pause
    exit /b 1
)

REM Start the server
echo Launching bedrock_server.exe...
bedrock_server.exe

REM Server closed
echo.
echo Server has stopped.
pause
