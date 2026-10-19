@echo off
title Codenames Telegram Bot
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

:loop
echo.
echo ==========================================
echo   [%date% %time%] Starting Codenames Bot...
echo ==========================================
"C:\Program Files\nodejs\node.exe" node_modules\tsx\dist\cli.mjs server.ts
echo.
echo [%date% %time%] Bot stopped/crashed. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
