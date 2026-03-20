@echo off

rem elevate process
:checkstatus
net session >nul 2>&1
if %errorLevel% == 0 (
    goto build
) else (
    goto becomealmighty
)

:becomealmighty
echo we need admin folk
powershell -Command "Start-Process -FilePath '%~f0' -Verb runAs"
exit /B

:build
cd /d "%~dp0"

rem clear old dist!
if exist dist rmdir /s /q dist

rem build new one np
call npx electron-builder --win --x64

echo we're done here bud
pause