@echo off
REM Starts the Day Tour Video Maker laptop server and opens it in your browser.
setlocal
cd /d "%~dp0"
if not exist .venv (
  py -3 -m venv .venv || python -m venv .venv || goto :err
  call .venv\Scripts\activate.bat
  pip install -r requirements.txt || goto :err
) else (
  call .venv\Scripts\activate.bat
)
start "" http://localhost:8765/
python tour_server.py %*
goto :eof
:err
echo Setup failed. Install Python 3.10+ from python.org and try again. & exit /b 1
