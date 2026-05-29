@echo off
setlocal
cd /d "%~dp0"

set PORT=4173
set URL=http://127.0.0.1:%PORT%/index.html

where python >nul 2>nul
if errorlevel 1 (
  echo Python is not installed or not available in PATH.
  echo Install Python, then run this file again.
  pause
  exit /b 1
)

echo Starting Reverse Relationship at %URL%
echo.
echo Viewer: %URL%
echo Editor: http://127.0.0.1:%PORT%/editor.html
echo.
echo Keep this window open while using the site.
echo Press Ctrl+C to stop the server.
echo.

start "" "%URL%"
python -m http.server %PORT% --bind 127.0.0.1
pause
