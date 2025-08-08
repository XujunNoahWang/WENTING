#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
雯婷应用智能启动脚本 - 带自动构建检测
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

def smart_build_check():
    """智能构建检查"""
    print("🔍 检查前端资源是否需要重新构建...")
    
    try:
        # 检查是否需要构建，使用UTF-8编码
        result = subprocess.run(['node', 'check-build.js'], 
                              capture_output=True, text=True, encoding='utf-8', errors='ignore')
        
        if result.returncode == 0:
            print("✅ 前端资源已是最新版本")
            return True
        else:
            print("🔧 检测到源文件更新，自动构建中...")
            
            # 自动构建，使用UTF-8编码
            build_result = subprocess.run(['node', 'build.js'], 
                                        capture_output=True, text=True, encoding='utf-8', errors='ignore')
            
            if build_result.returncode == 0:
                print("✅ 前端资源构建完成")
                return True
            else:
                print("❌ 自动构建失败，请手动运行: node build.js")
                if build_result.stderr:
                    print(build_result.stderr)
                return False
                
    except FileNotFoundError:
        print("⚠️  未找到 Node.js，跳过构建检查")
        print("📌 如果修改了前端代码，请手动运行: node build.js")
        return True
    except Exception as e:
        print(f"⚠️  构建检查失败: {e}")
        return True  # 继续启动，但提醒用户

def kill_processes_on_ports():
    """清理占用3001端口的进程"""
    print("🧹 清理端口占用...")
    
    ports = [3001]
    for port in ports:
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
                print(f"🔄 终止进程 PID {pid}...")
                run_command(f'taskkill /PID {pid} /F')
        print(f"✅ 端口 {port} 已清理")
    time.sleep(1)

def start_backend():
    """启动后端服务"""
    print("🚀 启动后端服务...")
    backend_dir = Path(__file__).parent / "backend"
    if not backend_dir.exists():
        print("❌ 后端目录不存在")
        return False
    
    os.chdir(backend_dir)
    cmd = 'start "雯婷后端服务" cmd /k "npm run dev"'
    run_command(cmd)
    print("✅ 后端服务启动中...")
    return True

def start_cloudflared():
    """启动cloudflared tunnel"""
    exe_path = str(Path(__file__).parent / "cloudflared.exe")
    if not Path(exe_path).exists():
        print("❌ 未找到 cloudflared.exe")
        return None
    
    print("🌐 启动 Cloudflare Tunnel...")
    cmd = [exe_path, 'tunnel', '--url', 'http://localhost:3001']
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, 
                                 stderr=subprocess.STDOUT, text=True, 
                                 encoding='utf-8', errors='ignore')
        https_url = None
        line_count = 0
        
        for line in process.stdout:
            line_count += 1
            line = line.rstrip()
            if line:  # 只打印非空行
                print(f"[cloudflared] {line}")
            
            if 'https://' in line and 'trycloudflare.com' in line:
                for word in line.split():
                    if word.startswith('https://') and 'trycloudflare.com' in word:
                        https_url = word.strip().rstrip('.,;')
                        print(f"🎯 检测到访问地址: {https_url}")
                        break
            
            if https_url or line_count >= 30:
                break
        
        return https_url
    except UnicodeDecodeError as e:
        print(f"⚠️  编码错误: {e}")
        print("🔄 尝试使用备用方法启动 cloudflared...")
        
        # 备用方法：不捕获输出，直接启动
        try:
            subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
            print("✅ Cloudflare Tunnel 已在新窗口中启动")
            print("📌 请从 cloudflared 窗口中查找访问地址")
            return "请查看cloudflared窗口获取地址"
        except Exception as e:
            print(f"❌ 启动失败: {e}")
            return None

def wait_for_backend():
    """等待后端服务启动"""
    print("⏳ 等待后端服务启动...")
    
    for attempt in range(15):
        backend_result = run_command('netstat -ano | findstr :3001', capture_output=True)
        if backend_result and 'LISTENING' in backend_result:
            try:
                import urllib.request
                with urllib.request.urlopen('http://localhost:3001/health', timeout=3) as response:
                    if response.status == 200:
                        print("✅ 后端服务启动完成")
                        return True
            except:
                pass
        
        print(f"🔄 等待中... ({attempt + 1}/15)")
        time.sleep(2)
    
    print("⚠️  后端服务启动超时，但继续执行")
    return True

def main():
    """主函数"""
    print("=" * 60)
    print("🎯 雯婷应用智能启动 (带自动构建检测)")
    print("=" * 60)
    
    try:
        # 1. 智能构建检查
        if not smart_build_check():
            print("❌ 构建检查失败，但继续启动...")
        
        # 2. 清理端口
        kill_processes_on_ports()
        
        # 3. 启动后端
        if not start_backend():
            print("❌ 后端服务启动失败")
            return
        
        # 4. 等待后端
        wait_for_backend()
        
        # 5. 启动cloudflared
        cf_url = start_cloudflared()
        
        # 6. 打开浏览器
        if cf_url:
            print(f"🌐 打开浏览器: {cf_url}")
            webbrowser.open(cf_url)
        
        print("\n" + "=" * 60)
        print("✅ 雯婷应用启动完成！")
        print("=" * 60)
        if cf_url:
            print(f"🌍 外网访问: {cf_url}")
        print(f"🏠 本地访问: http://localhost:3001")
        print("=" * 60)
        print("💡 提示:")
        print("  • 修改前端代码后会自动检测并重新构建")
        print("  • 如需手动构建: node build.js")
        print("  • 如需强制重构建: 删除 build/ 目录后重新启动")
        print("=" * 60)
        
        input("\n按 Enter 键退出脚本...")
        
    except KeyboardInterrupt:
        print("\n👋 用户中断，脚本退出")
    except Exception as e:
        print(f"\n❌ 启动失败: {e}")
        input("按 Enter 键退出...")

if __name__ == "__main__":
    main()