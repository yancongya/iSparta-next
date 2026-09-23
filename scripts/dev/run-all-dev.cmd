@echo off
setlocal
set PATH=C:\nvm4w\nodejs;C:\Users\Administrator\.local\bin;C:\WINDOWS\system32;C:\WINDOWS
set NODE_OPTIONS=--openssl-legacy-provider
cd /d F:\iSparta
echo BEGIN_DEV_ALL %DATE% %TIME% > F:\iSparta\dev-all.status
call node scripts\dev-all.js %*
echo EXIT_DEV_ALL ERRORLEVEL=%ERRORLEVEL% %DATE% %TIME% >> F:\iSparta\dev-all.status
echo CEP HMR on. After quit: npm run dev:cep:off
