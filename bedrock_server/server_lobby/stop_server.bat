@echo off
rem stop_server.bat - Stop Bedrock server process if running
cd /d %~dp0

echo Mencari proses bedrock_server...
powershell -NoProfile -Command "try { $p = Get-Process -Name 'bedrock_server' -ErrorAction Stop; $p | Stop-Process -Force; Write-Host 'Stopped bedrock_server (PID:' $p.Id ')'; exit 0 } catch { Write-Host 'bedrock_server not running'; exit 1 }"

if %ERRORLEVEL% equ 0 (
  echo Server dihentikan.
) else (
  echo Tidak ada proses server yang ditemukan.
)

pause
