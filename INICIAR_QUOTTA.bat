@echo off
setlocal
cd /d "%~dp0"
title QUOTTA Club - Servidor Local
where node >nul 2>&1
if errorlevel 1 (echo [ERRO] Instale Node.js 22 LTS.& pause & exit /b 1)
if not exist ".env.local" (
 if exist ".env.example" copy ".env.example" ".env.local" >nul
 echo Configure a URL e a chave PUBLICA do Supabase em .env.local.
 notepad ".env.local"
 pause
)
if not exist "node_modules\next" (
 call npm.cmd install
 if errorlevel 1 (echo [ERRO] Falha ao instalar dependencias.& pause & exit /b 1)
)
echo Iniciando o QUOTTA Club...
start "QUOTTA - Abrir navegador" /min powershell -NoProfile -Command "$url='http://127.0.0.1:3000'; for($i=0;$i -lt 90;$i++){try{$r=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -ge 200){Start-Process $url; break}}catch{}; Start-Sleep -Seconds 2}"
call npm.cmd run dev
if errorlevel 1 echo [ERRO] O servidor encerrou com erro.
pause
