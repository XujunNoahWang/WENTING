#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
雯婷应用简化启动脚本
"""

import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path
import json

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
    print("清理端口占用...")
    
    ports = [3001]  # 只需要清理后端端口
    for port in ports:
        print(f"检查端口 {port}...")
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
            
            for pid in pids:
                print(f"终止进程 PID {pid}...")
                run_command(f'taskkill /PID {pid} /F')
        print(f"端口 {port} 已清理")
    print("端口清理完成")
    time.sleep(2)

def start_backend():
    """启动后端服务"""
    print("启动后端服务...")
    backend_dir = Path(__file__).parent / "backend"
    if not backend_dir.exists():
        print("后端目录不存在")
        return False
    
    os.chdir(backend_dir)
    cmd = 'start "Backend Server" cmd /k "npm run dev"'
    run_command(cmd)
    print("后端服务启动中...")
    return True

def start_frontend():
    """检查前端文件"""
    print("检查前端文件...")
    project_root = Path(__file__).parent
    os.chdir(project_root)
    print(f"当前工作目录: {os.getcwd()}")
    
    key_files = ['index.html', 'js/apiClient.js', 'js/websocketClient.js', 'js/app.js']
    for file in key_files:
        if not Path(file).exists():
            print(f"关键文件不存在: {file}")
            return False
        else:
            print(f"关键文件存在: {file}")
    
    print("前端文件检查完成，将通过后端服务器提供")
    return True

def write_cloudflared_config():
    """生成cloudflared配置 - 暂时不使用，使用Quick Tunnel模式"""
    # 不再需要配置文件，Quick Tunnel会直接代理到指定端口
    print("使用Quick Tunnel模式，无需配置文件")
    return None

def start_cloudflared():
    """启动cloudflared tunnel"""
    exe_path = str(Path(__file__).parent / "cloudflared.exe")
    if not Path(exe_path).exists():
        print("未找到 cloudflared.exe，请将其放在脚本目录下")
        return None
    
    print("启动 Cloudflare Tunnel...")
    
    # 使用 Quick Tunnel 模式，代理到后端服务器（提供前端+API）
    cmd = [exe_path, 'tunnel', '--url', 'http://localhost:3001']
    print(f"执行命令: {' '.join(cmd)}")
    
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    https_url = None
    line_count = 0
    max_lines = 30
    
    for line in process.stdout:
        line_count += 1
        print(f"[cloudflared] {line.rstrip()}")
        
        if 'https://' in line and 'trycloudflare.com' in line:
            for word in line.split():
                if word.startswith('https://') and 'trycloudflare.com' in word:
                    https_url = word.strip().rstrip('.,;')
                    print(f"[cloudflared] 检测到访问地址: {https_url}")
                    break
        
        if https_url or line_count >= max_lines:
            break
    
    return https_url

def wait_for_services():
    """等待服务启动"""
    print("等待服务启动完成...")
    max_attempts = 20
    
    for attempt in range(max_attempts):
        # 检查后端服务
        backend_result = run_command('netstat -ano | findstr :3001', capture_output=True)
        backend_ready = 'LISTENING' in backend_result if backend_result else False
        
        # 测试后端API和WebSocket
        backend_api_ready = False
        websocket_ready = False
        if backend_ready:
            try:
                import urllib.request
                # 测试HTTP API
                with urllib.request.urlopen('http://localhost:3001/health', timeout=3) as response:
                    if response.status == 200:
                        backend_api_ready = True
                
                # 简单检查WebSocket端口（间接方式）
                # WebSocket运行在同一个端口上，如果HTTP可用则WebSocket应该也可用
                websocket_ready = backend_api_ready
            except:
                pass
        
        if backend_ready and backend_api_ready and websocket_ready:
            print("后端服务启动完成 (HTTP + WebSocket)")
            return True
        
        status = f"后端端口:{'OK' if backend_ready else 'NO'} API:{'OK' if backend_api_ready else 'NO'} WebSocket:{'OK' if websocket_ready else 'NO'}"
        print(f"等待中... ({attempt + 1}/{max_attempts}) {status}")
        time.sleep(2)
    
    print("服务启动超时，但继续执行")
    return False

def main():
    """主函数"""
    print("=" * 50)
    print("雯婷应用启动脚本")
    print("=" * 50)
    
    try:
        # 1. 清理端口
        kill_processes_on_ports()
        
        # 2. 检查前端文件
        if not start_frontend():
            print("前端文件检查失败")
            return
        
        # 3. 启动后端（同时提供前端和API服务）
        if not start_backend():
            print("后端服务启动失败")
            return
        
        # 4. 启动cloudflared
        cf_url = start_cloudflared()
        
        # 5. 等待服务
        wait_for_services()
        
        # 6. 打开浏览器
        if cf_url:
            print(f"打开浏览器: {cf_url}")
            webbrowser.open(cf_url)
        
        print("\n" + "=" * 50)
        print("雯婷应用启动完成！")
        print("=" * 50)
        if cf_url:
            print(f"🌐 外网访问地址: {cf_url}")
            print(f"📡 API地址: {cf_url}/api")
            print(f"🔌 WebSocket地址: {cf_url.replace('https://', 'wss://')}/ws")
        print(f"🏠 本地访问地址: http://localhost:3001")
        print(f"📡 本地API地址: http://localhost:3001/api") 
        print(f"🔌 本地WebSocket地址: ws://localhost:3001/ws")
        print("=" * 50)
        print("📋 功能说明:")
        print("  • HTTP API: 用于数据传输")
        print("  • WebSocket: 用于实时通信和多设备同步")
        print("  • 前端文件: 通过后端服务器提供")
        print("=" * 50)
        print("⚠️  提示: 关闭此窗口不会停止服务")
        print("=" * 50)
        
        input("\n按Enter键退出脚本...")
        
    except KeyboardInterrupt:
        print("\n用户中断，脚本退出")
    except Exception as e:
        print(f"\n启动失败: {e}")
        input("按Enter键退出...")

if __name__ == "__main__":
    main()