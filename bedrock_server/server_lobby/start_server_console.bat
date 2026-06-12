@echo off
setlocal
set "ROOT=%~dp0"

if not exist "%ROOT%bedrock_server.exe" (
  echo ERROR: bedrock_server.exe tidak ditemukan di %ROOT%
  pause
  exit /b 1
)

if not exist "%ROOT%worlds\Maharlika_City" (
  echo ERROR: World Maharlika_City tidak ditemukan di %ROOT%worlds
  pause
  exit /b 1
)

echo Menjalankan server dalam console interaktif...
echo Gunakan file ini kalau kamu ingin mengetik command langsung ke console server.
cd /d "%ROOT%"
"%ROOT%bedrock_server.exe"
