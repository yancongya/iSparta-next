@echo off
set PATH=C:\nvm4w\nodejs;C:\Users\Administrator\.local\bin;C:\WINDOWS\system32;C:\WINDOWS
cd /d F:\iSparta
echo BEGIN_DEV_CEP %DATE% %TIME% > F:\iSparta\dev-cep.status
call npm run dev:cep > F:\iSparta\dev-cep.log 2> F:\iSparta\dev-cep.err
echo EXIT_DEV_CEP ERRORLEVEL=%ERRORLEVEL% %DATE% %TIME% >> F:\iSparta\dev-cep.status
