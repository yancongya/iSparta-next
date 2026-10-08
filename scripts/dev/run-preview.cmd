@echo off
rem Preview entry: guide / landing / web / desktop / cep
rem Output intentionally NOT redirected - the ready URL and the spinner must stay visible.
rem Only the exit code is recorded, for callers that need to check it later.
setlocal
set PATH=C:\nvm4w\nodejs;C:\Users\Administrator\.local\bin;C:\WINDOWS\system32;C:\WINDOWS
set NODE_OPTIONS=--openssl-legacy-provider
cd /d F:\iSparta
if "%~1"=="" (
  echo Usage: run-preview.cmd guide^|landing^|web^|desktop^|cep  [--port N] [--no-open]
  echo.
  call node scripts\dev\preview.js --help
  goto :eof
)
echo BEGIN_PREVIEW %DATE% %TIME% > F:\iSparta\preview.status
call node scripts\dev\preview.js %*
echo EXIT_PREVIEW ERRORLEVEL=%ERRORLEVEL% %DATE% %TIME% >> F:\iSparta\preview.status
