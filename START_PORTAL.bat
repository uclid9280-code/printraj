@echo off
title Aadhaar Operations ^& Tracking Portal Launcher
cd /d "%~dp0"
echo Starting Aadhaar Operations Portal server...
start "" http://localhost:5173
node server.js
pause
