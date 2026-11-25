@echo off
title Coronary AI - Frontend Server
cd /d "%~dp0frontend"
set PATH=C:\Program Files\nodejs;%PATH%
echo ========================================================
echo Starting Coronary AI Frontend (React / Vite on port 5173)
echo ========================================================
call npm.cmd run dev
pause
