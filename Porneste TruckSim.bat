@echo off
rem Starts the TruckSim bridge (the "brain" on the PC). Double-click to run.
rem Keep this window open while you play; close it to stop the bridge.
chcp 65001 >nul
title TruckSim bridge
cd /d "%~dp0"
node apps\bridge\src\main.ts --port 8788
echo.
echo Bridge-ul s-a oprit. Apasa o tasta ca sa inchizi fereastra.
pause >nul
