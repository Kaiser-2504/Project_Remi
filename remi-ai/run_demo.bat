@echo off
rem Bam dup vao file nay de chay demo tren Windows.
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py demo.py %*
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    python demo.py %*
  ) else (
    echo Chua thay Python. Hay cai Python 3 tai https://www.python.org roi bam dup lai file nay.
  )
)
echo.
pause
