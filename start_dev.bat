@echo off
title Coronary AI - All-in-One Dev Launcher
echo ========================================================
echo Launching Coronary AI Workstation (Backend + Frontend)
echo ========================================================
echo Starting Backend (Flask on port 5000)...
start "Coronary AI - Backend (Flask API)" cmd /k "%~dp0start_backend.bat"

echo Starting Frontend (Vite on port 5173)...
start "Coronary AI - Frontend (React / Vite)" cmd /k "%~dp0start_frontend.bat"

echo.
echo ========================================================
echo Dev environment successfully initialized!
echo   - Backend API: http://127.0.0.1:5000
echo   - Frontend:    http://localhost:5173
echo.
echo Check the two opened terminal windows for live server logs.
echo ========================================================
echo.
pause
