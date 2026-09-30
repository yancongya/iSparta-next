@echo off
set PATH=C:\nvm4w\nodejs;C:\Users\Administrator\.local\bin;C:\WINDOWS\system32;C:\WINDOWS
cd /d F:\iSparta
echo BEGIN_LANDING %DATE% %TIME% > F:\iSparta\landing-serve.status
call npm run landing:serve > F:\iSparta\landing-serve.log 2> F:\iSparta\landing-serve.err
echo EXIT_LANDING ERRORLEVEL=%ERRORLEVEL% %DATE% %TIME% >> F:\iSparta\landing-serve.status
