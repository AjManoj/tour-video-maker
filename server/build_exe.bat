@echo off
REM Builds dist\TourMaker.exe (Windows). Run from the server\ folder.
setlocal
cd /d "%~dp0"
if not exist .venv (
  py -3 -m venv .venv || python -m venv .venv || goto :err
)
call .venv\Scripts\activate.bat || goto :err
python -m pip install --upgrade pip
pip install -r requirements.txt -r requirements-exe.txt || goto :err
pyinstaller --noconfirm --onefile --windowed --name TourMaker ^
  --add-data "..\web;web" --add-data "..\config;config" ^
  --collect-all imageio_ffmpeg --hidden-import tour_server ^
  launcher.py || goto :err
echo.
echo Built: %cd%\dist\TourMaker.exe
goto :eof
:err
echo Build failed. & exit /b 1
