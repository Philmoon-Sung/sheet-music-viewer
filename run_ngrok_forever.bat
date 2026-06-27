@echo off
cd /d "%~dp0"
:loop
echo [%DATE% %TIME%] Starting ngrok... >> ngrok_run.log
"C:\Users\user\AppData\Local\ngrok\ngrok.exe" http --domain=francesco-prowed-beckie.ngrok-free.dev 9000 --config="C:\Users\user\AppData\Local\ngrok\ngrok.yml" --log="C:\Users\user\AppData\Local\ngrok\ngrok_agent.log"
echo [%DATE% %TIME%] Ngrok stopped. Restarting in 5 seconds... >> ngrok_run.log
ping 127.0.0.1 -n 6 >nul
goto loop



