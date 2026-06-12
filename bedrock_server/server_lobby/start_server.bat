@echo off
setlocal
set "ROOT=%~dp0"
set "LOGS=%ROOT%logs"
if not exist "%LOGS%" mkdir "%LOGS%"

if not exist "%ROOT%bedrock_server.exe" (
  echo ERROR: bedrock_server.exe tidak ditemukan di %ROOT%
  echo Silakan letakkan `bedrock_server.exe` di folder ini.
  pause
  exit /b 1
)

if not exist "%ROOT%worlds\Maharlika_City" (
  echo ERROR: World `Maharlika_City` tidak ditemukan di %ROOT%worlds
  echo Pastikan folder world sudah ada sebelum menjalankan server.
  pause
  exit /b 1
)

echo Menjalankan server...
cd /d "%ROOT%"
"%ROOT%bedrock_server.exe" > "%LOGS%\server.log" 2>&1
