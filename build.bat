@echo off
echo 🚀 开始构建优化版本...
node build.js
if %errorlevel% equ 0 (
    echo ✅ 构建成功完成！
    echo 📁 构建文件已生成到 build/ 目录
    echo 🔧 HTML文件已更新为使用压缩版本
) else (
    echo ❌ 构建失败，请检查错误信息
)
pause