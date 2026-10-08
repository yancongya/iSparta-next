@echo off
rem Repo health check. Short-running, so output stays on screen.
rem   run-check.cmd lint | pack | ports | all
setlocal
set PATH=C:\nvm4w\nodejs;C:\Users\Administrator\.local\bin;C:\WINDOWS\system32;C:\WINDOWS
cd /d "%~dp0..\.."
if "%~1"=="" (
  call node scripts\dev\check.js --help
  goto :eof
)
call node scripts\dev\check.js %*
