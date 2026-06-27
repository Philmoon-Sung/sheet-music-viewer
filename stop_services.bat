@echo off
taskkill /F /IM node.exe
taskkill /F /IM ngrok.exe
echo 모든 서비스가 종료되었습니다.
pause
