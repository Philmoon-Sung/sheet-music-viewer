@echo off
:loop
echo [%DATE% %TIME%] Starting cloudflared tunnel... >> cloudflared.log
:: Use quick tunnel and append output (including URL in stderr) to log
.\cloudflared.exe tunnel --url http://localhost:9000 >> cloudflared.log 2>&1
echo [%DATE% %TIME%] Cloudflared stopped. Restarting in 5 seconds... >> cloudflared.log
timeout /t 5 /nobreak >nul
goto loop

