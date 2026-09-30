@echo off
set PATH=C:\nvm4w\nodejs;C:\Users\Administrator\.local\bin;C:\WINDOWS\system32;C:\WINDOWS
cd /d F:\iSparta
echo BEGIN_BUILD_WIN %DATE% %TIME% > F:\iSparta\build-win.status
call npm run build:windows > F:\iSparta\build-win.log 2> F:\iSparta\build-win.err
echo EXIT_BUILD_WIN ERRORLEVEL=%ERRORLEVEL% %DATE% %TIME% >> F:\iSparta\build-win.status
