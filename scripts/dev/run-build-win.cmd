@echo off
rem Windows installer build. Delegates to scripts/dev/build.js so the safe-delete
rem exemption and the artifact report live in exactly one place.
rem Pass-through: --backup (snapshot targets/cep/ui first) / --dry
setlocal
set PATH=C:\nvm4w\nodejs;C:\Users\Administrator\.local\bin;C:\WINDOWS\system32;C:\WINDOWS
cd /d "%~dp0..\.."
echo BEGIN_BUILD_WIN %DATE% %TIME% > F:\iSparta\build-win.status
call node scripts\dev\build.js win %* > F:\iSparta\build-win.log 2> F:\iSparta\build-win.err
echo EXIT_BUILD_WIN ERRORLEVEL=%ERRORLEVEL% %DATE% %TIME% >> F:\iSparta\build-win.status
echo.
echo Done. Log: F:\iSparta\build-win.log
