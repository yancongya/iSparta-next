@echo off
rem Rebuild the AE/CEP panel bundle (targets/cep/ui). Fast: UI only, no installer.
rem Refreshing it matters whenever src/ or shared code changed, otherwise the
rem committed bundle silently drifts away from the sources.
setlocal
set PATH=C:\nvm4w\nodejs;C:\Users\Administrator\.local\bin;C:\WINDOWS\system32;C:\WINDOWS
cd /d "%~dp0..\.."
echo BEGIN_BUILD_CEP %DATE% %TIME% > F:\iSparta\build-cep.status
call node scripts\dev\build.js cep %* > F:\iSparta\build-cep.log 2> F:\iSparta\build-cep.err
echo EXIT_BUILD_CEP ERRORLEVEL=%ERRORLEVEL% %DATE% %TIME% >> F:\iSparta\build-cep.status
echo.
echo Done. Log: F:\iSparta\build-cep.log
