@echo off
:: 현재 배치 파일이 있는 디렉토리로 이동
cd /d "%~dp0"

:: 로컬 서버 시작 (새 창에서 실행)
start "Sheet Music Server" cmd /k "npm start"

:: Ngrok 터널 시작 (새 창에서 실행)
:: 3000번 포트를 외부로 공유
start "Ngrok Tunnel" cmd /k "ngrok http --domain=francesco-prowed-beckie.ngrok-free.dev 9000"

echo 서버와 Ngrok가 실행되었습니다.
