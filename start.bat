@echo off
echo ========================================
echo           文婷1.0 启动脚本
echo ========================================
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到Node.js
    echo 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 已安装

:: 检查MySQL是否运行
echo 🔄 检查MySQL服务...
sc query mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  警告: MySQL服务未运行
    echo 请确保MySQL已安装并启动
    echo.
)

:: 进入后端目录
cd backend

:: 检查是否已安装依赖
if not exist node_modules (
    echo 🔄 安装后端依赖...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 安装依赖失败
        echo.
        echo 💡 建议:
        echo 1. 检查网络连接
        echo 2. 尝试使用淘宝镜像: npm config set registry https://registry.npmmirror.com
        echo 3. 或运行 install.bat 脚本
        pause
        exit /b 1
    )
    echo ✅ 后端依赖安装完成
) else (
    echo ✅ 后端依赖已安装
)

:: 检查环境配置文件
if not exist .env (
    echo 🔄 创建环境配置文件...
    copy .env.example .env
    echo ⚠️  请编辑 backend\.env 文件配置数据库连接信息
    echo.
)

:: 初始化数据库
echo 🔄 初始化数据库...
npm run init-db
if %errorlevel% neq 0 (
    echo ❌ 数据库初始化失败
    echo 请检查数据库连接配置
    pause
    exit /b 1
)

echo ✅ 数据库初始化完成

:: 启动后端服务
echo 🚀 启动后端服务...
start "文婷1.0 后端服务" npm run dev

:: 等待后端启动
timeout /t 3 /nobreak >nul

:: 返回根目录
cd ..

:: 启动前端（使用Python的简单HTTP服务器）
echo 🌐 启动前端服务...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 使用Python启动前端服务...
    start "文婷1.0 前端服务" python -m http.server 3000
    echo.
    echo 🎉 服务启动完成！
    echo.
    echo 📱 前端地址: http://localhost:3000
    echo 🔧 后端地址: http://localhost:3001
    echo 📊 健康检查: http://localhost:3001/health
    echo.
    echo 按任意键打开浏览器...
    pause >nul
    start http://localhost:3000
) else (
    echo ⚠️  Python未安装，请手动打开 index.html 文件
    echo 或安装Python后重新运行此脚本
    echo.
    echo 🔧 后端服务已启动: http://localhost:3001
    pause
)