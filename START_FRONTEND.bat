@echo off
echo ====================================
echo GIS Apps Frontend Server
echo ====================================
echo.

echo Starting Frontend Development Server...
echo.

:: Check if Python is installed for simple HTTP server
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python from https://python.org/
    pause
    exit /b 1
)

:: Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Node.js not found, using Python HTTP server
    echo.
    echo ====================================
    echo Frontend starting on http://localhost:3000
    echo ====================================
    echo.
    echo Make sure backend is running on http://localhost:8081
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    
    :: Start Python HTTP server
    python -m http.server 3000
) else (
    echo [INFO] Node.js found, you can use any frontend dev server
    echo Example: npx serve . -p 3000
    echo.
    
    :: Start with Node.js serve if available
    npx serve . -p 3000
)

pause
