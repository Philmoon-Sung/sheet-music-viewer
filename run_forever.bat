@echo off
cd /d "%~dp0"
:loop
echo [%DATE% %TIME%] Starting server... >> server_run.log
"C:\Program Files\nodejs\node.exe" server.js >> server_run.log 2>&1
echo [%DATE% %TIME%] Server crashed or stopped. Restarting in 5 seconds... >> server_run.log
ping 127.0.0.1 -n 6 >nul
goto loop

