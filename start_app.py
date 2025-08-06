#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
雯婷应用启动脚本
自动清理端口、启动前后端服务、打开浏览器
"""

import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path

def run_command(cmd, shell=True, capture_output=False):
    """执行命令"""
    try:
        if capture_output:
            result = subprocess.run(cmd, shell=shell, capture_output=True, text=True)
            return result.stdout.strip()
        else:
            subprocess.run(cmd, shell=shell, check=True)
            return True
    except subprocess.CalledProcessError as e:
        print(f"命令执行失败: {cmd}")
        print(f"错误: {e}")
        return False

def kill_processes_on_ports():
    """清理占用3000和3001端口的进程"""
    print("🧹 清理端口占用...")
    
    ports = [3000, 3001]
    for port in ports:
        print(f"  检查端口 {port}...")
        
        # 查找占用端口的进程
        result = run_command(f'netstat -ano | findstr :{port}', capture_output=True)
        if result:
            lines = result.split('\n')
            pids = set()
            
            for line in lines:
                if 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = parts[-1]
                        if pid.isdigit():
                            pids.add(pid)
            
            # 终止进程
            for pid in pids:
                print(f"  终止进程 PID {pid}...")
                run_command(f'taskkill /PID {pid} /F')
        
        print(f"  端口 {port} 已清理")
    
    print("✅ 端口清理完成")
    time.sleep(2)

def start_backend():
    """启动后端服务"""
    print("🚀 启动后端服务...")
    
    backend_dir = Path(__file__).parent / "backend"
    if not backend_dir.exists():
        print("❌ 后端目录不存在")
        return False
    
    # 切换到后端目录并启动服务
    os.chdir(backend_dir)
    
    # 使用start命令在新窗口中启动，避免阻塞
    cmd = 'start "Backend Server" cmd /k "npm start"'
    run_command(cmd)
    
    print("✅ 后端服务启动中...")
    return True

def start_frontend():
    """启动前端服务"""
    print("🌐 启动前端服务...")
    
    # 回到项目根目录
    project_root = Path(__file__).parent
    os.chdir(project_root)
    
    # 启动Python HTTP服务器
    cmd = 'start "Frontend Server" cmd /k "python -m http.server 3000"'
    run_command(cmd)
    
    print("✅ 前端服务启动中...")
    return True

def wait_for_services():
    """等待服务启动完成"""
    print("⏳ 等待服务启动完成...")
    
    max_attempts = 30
    for attempt in range(max_attempts):
        # 检查后端服务
        backend_result = run_command('netstat -ano | findstr :3001', capture_output=True)
        backend_ready = 'LISTENING' in backend_result if backend_result else False
        
        # 检查前端服务
        frontend_result = run_command('netstat -ano | findstr :3000', capture_output=True)
        frontend_ready = 'LISTENING' in frontend_result if frontend_result else False
        
        if backend_ready and frontend_ready:
            print("✅ 所有服务启动完成")
            return True
        
        print(f"  等待中... ({attempt + 1}/{max_attempts}) 后端:{'✅' if backend_ready else '❌'} 前端:{'✅' if frontend_ready else '❌'}")
        time.sleep(2)
    
    print("⚠️ 服务启动超时，但将继续打开浏览器")
    return False

def open_browser():
    """打开浏览器"""
    print("🌐 打开浏览器...")
    
    url = "http://localhost:3000"
    try:
        webbrowser.open(url)
        print(f"✅ 浏览器已打开: {url}")
    except Exception as e:
        print(f"❌ 打开浏览器失败: {e}")
        print(f"请手动访问: {url}")

def main():
    """主函数"""
    print("=" * 50)
    print("🎯 雯婷应用启动脚本")
    print("=" * 50)
    
    try:
        # 1. 清理端口
        kill_processes_on_ports()
        
        # 2. 启动后端服务
        if not start_backend():
            print("❌ 后端服务启动失败")
            return
        
        # 3. 启动前端服务
        if not start_frontend():
            print("❌ 前端服务启动失败")
            return
        
        # 4. 等待服务启动
        wait_for_services()
        
        # 5. 打开浏览器
        open_browser()
        
        print("\n" + "=" * 50)
        print("🎉 应用启动完成！")
        print("📱 前端地址: http://localhost:3000")
        print("🔧 后端地址: http://localhost:3001")
        print("💡 提示: 关闭此窗口不会停止服务")
        print("🛑 要停止服务，请关闭对应的服务器窗口")
        print("=" * 50)
        
        # 保持脚本运行，显示状态
        input("\n按 Enter 键退出脚本（服务将继续运行）...")
        
    except KeyboardInterrupt:
        print("\n\n👋 用户中断，脚本退出")
    except Exception as e:
        print(f"\n❌ 启动过程中出现错误: {e}")
        input("按 Enter 键退出...")

if __name__ == "__main__":
    main()