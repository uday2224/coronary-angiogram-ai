@echo off
title Coronary AI - Backend Server
cd /d "%~dp0backend"
echo ========================================================
echo Starting Coronary AI Backend (Flask API on port 5000)
echo ========================================================
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run.py
) else (
    echo ERROR: Python virtual environment not found at backend\.venv
    pause
)
pause
