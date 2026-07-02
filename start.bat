@echo off
REM Start the TSP GA Visualizer on Windows

echo Starting TSP Genetic Algorithm Visualizer...
echo.

REM Try Node.js first
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting server with Node.js...
    npx http-server -p 8000 -o http://localhost:8000
    exit /b
)

REM Fall back to Python
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting server with Python...
    python -m http.server 8000
    exit /b
)

REM No server found
echo Error: Neither Node.js nor Python found.
echo Please install one of them or start the server manually:
echo   python -m http.server 8000
echo   or
echo   npx http-server -p 8000
pause
