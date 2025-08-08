#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
雯婷应用安全启动脚本 - 修复编码问题
"""

import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path

# 设置控制台编码为UTF-8（Windows）
if sys.platform == 'win32':
    os.system('chcp 65001 >nul 2>&1')

def run_command_safe(cmd, shell=True, capture_output=False):
    """安全执行命令，处理编码问题"""
    try:
        if capture_output:
            # 使用系统默认编码，忽略错误
            result = subprocess.run(cmd, shell=shell, capture_output=True, 
                                  text=True, errors='ignore')
            return result.stdout.strip() if result.stdout else ""
        else:
            subprocess.run(cmd, shell=shell, check=True)
            return True
    except subprocess.CalledProcessError as e:
        print(f"命令执行失败: {cmd}")
        return False
    except Exception as e:
        print(f"执行错误: {e}")
        return False

def check_build_needed():
    """检查是否需要构建"""
    print("🔍 检查前端资源...")
    
    # 检查构建文件是否存在
    build_files = ['build/app.min.js', 'build/app.min.css']
    missing_files = [f for f in build_files if not Path(f).exists()]
    
    if missing_files:
        print(f"❌ 构建文件缺失: {missing_files}")
        return True
    
    try:
        # 尝试运行Node.js检查
        result = subprocess.run(['node', 'check-build.js'], 
                              capture_output=True, text=True, 
                              errors='ignore', timeout=10)
        
        if result.returncode == 0:
            print("✅ 前端资源已是最新版本")
            return False
        else:
            print("🔧 检测到源文件更新")
            return True
            
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print("⚠️  无法运行构建检查，假设需要构建")
        return True
    except Exception as e:
        print(f"⚠️  构建检查异常: {e}")
        return False

def build_frontend():
    """构建前端资源"""
    print("🔨 构建前端资源...")
    
    try:
        result = subprocess.run(['node', 'build.js'], 
                              capture_output=True, text=True, 
                              errors='ignore', timeout=60)
        
        if result.returncode == 0:
            print("✅ 前端资源构建完成")
            return True
        else:
            print("❌ 构建失败")
            if result.stderr:
                print(f"错误信息: {result.stderr[:200]}...")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ 构建超时")
        return False
    except FileNotFoundError:
        print("❌ 未找到 Node.js")
        return False
    except Exception as e:
        print(f"❌ 构建异常: {e}")
        return False

def kill_port_processes():
    """清理端口占用"""
    print("🧹 清理端口占用...")
    
    try:
        # 查找占用3001端口的进程
        result = run_command_safe('netstat -ano | findstr :3001', capture_output=True)
        
        if result and 'LISTENING' in result:
            lines = result.split('\n')
            pids = set()
            
            for line in lines:
                if 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) >= 5 and parts[-1].isdigit():
                        pids.add(parts[-1])
            
            for pid in pids:
                print(f"🔄 终止进程 PID {pid}")
                run_command_safe(f'taskkill /PID {pid} /F')
        
        print("✅ 端口清理完成")
        time.sleep(1)
        
    except Exception as e:
        print(f"⚠️  端口清理异常: {e}")

def start_backend():
    """启动后端服务"""
    print("🚀 启动后端服务...")
    
    backend_dir = Path(__file__).parent / "backend"
    if not backend_dir.exists():
        print("❌ 后端目录不存在")
        return False
    
    try:
        os.chdir(backend_dir)
        # 在新窗口中启动后端
        subprocess.Popen(['cmd', '/c', 'start', '雯婷后端服务', 'npm', 'run', 'dev'],
                        creationflags=subprocess.CREATE_NEW_CONSOLE)
        print("✅ 后端服务启动中...")
        return True
    except Exception as e:
        print(f"❌ 后端启动失败: {e}")
        return False

def start_cloudflared_safe():
    """安全启动cloudflared"""
    exe_path = Path(__file__).parent / "cloudflared.exe"
    if not exe_path.exists():
        print("❌ 未找到 cloudflared.exe")
        return None
    
    print("🌐 启动 Cloudflare Tunnel...")
    
    try:
        # 直接在新窗口启动，不捕获输出避免编码问题
        subprocess.Popen([str(exe_path), 'tunnel', '--url', 'http://localhost:3001'],
                        creationflags=subprocess.CREATE_NEW_CONSOLE)
        
        print("✅ Cloudflare Tunnel 已在新窗口中启动")
        print("📌 请从 cloudflared 窗口中查找 https://xxxxx.trycloudflare.com 地址")
        
        # 等待用户输入地址
        print("\n" + "="*50)
        cf_url = input("🌐 请输入 cloudflare 地址（或按回车跳过）: ").strip()
        
        if cf_url and cf_url.startswith('https://'):
            return cf_url
        else:
            return "手动输入地址"
            
    except Exception as e:
        print(f"❌ Cloudflare Tunnel 启动失败: {e}")
        return None

def wait_backend_ready():
    """等待后端就绪"""
    print("⏳ 等待后端服务启动...")
    
    for i in range(20):  # 最多等待40秒
        try:
            result = run_command_safe('netstat -ano | findstr :3001', capture_output=True)
            if result and 'LISTENING' in result:
                print("✅ 后端服务已启动")
                return True
        except:
            pass
        
        print(f"🔄 等待中... ({i+1}/20)")
        time.sleep(2)
    
    print("⚠️  后端服务启动超时，但继续执行")
    return False

def main():
    """主函数"""
    print("=" * 50)
    print("🎯 雯婷应用安全启动")
    print("=" * 50)
    
    try:
        # 1. 检查和构建前端资源
        if check_build_needed():
            if not build_frontend():
                print("❌ 前端构建失败，请手动运行: node build.js")
        
        # 2. 清理端口
        kill_port_processes()
        
        # 3. 启动后端
        if not start_backend():
            print("❌ 后端启动失败")
            return
        
        # 4. 等待后端就绪
        wait_backend_ready()
        
        # 5. 启动cloudflared
        cf_url = start_cloudflared_safe()
        
        # 6. 打开浏览器
        if cf_url and cf_url.startswith('https://'):
            print(f"🌐 打开浏览器: {cf_url}")
            try:
                webbrowser.open(cf_url)
            except:
                print("❌ 无法自动打开浏览器")
        
        print("\n" + "=" * 50)
        print("✅ 启动完成！")
        print("=" * 50)
        if cf_url and cf_url.startswith('https://'):
            print(f"🌍 外网访问: {cf_url}")
        print("🏠 本地访问: http://localhost:3001")
        print("=" * 50)
        
        input("\n按 Enter 键退出脚本...")
        
    except KeyboardInterrupt:
        print("\n👋 用户中断退出")
    except Exception as e:
        print(f"\n❌ 启动异常: {e}")
        input("按 Enter 键退出...")

if __name__ == "__main__":
    main()