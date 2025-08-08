#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
雯婷应用Windows兼容启动脚本
"""

import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path

def safe_print(text):
    """安全打印，处理编码问题"""
    try:
        print(text)
    except UnicodeEncodeError:
        # 移除emoji，只保留文字
        clean_text = ''.join(c for c in text if ord(c) < 128 or c.isalnum() or c in ' -_.,!?()[]{}:;')
        print(clean_text)

def run_command_safe(cmd, shell=True, capture_output=False):
    """安全执行命令"""
    try:
        if capture_output:
            result = subprocess.run(cmd, shell=shell, capture_output=True, 
                                  text=True, errors='ignore')
            return result.stdout.strip() if result.stdout else ""
        else:
            subprocess.run(cmd, shell=shell, check=True)
            return True
    except Exception as e:
        safe_print(f"执行错误: {e}")
        return False

def check_build_needed():
    """检查是否需要构建"""
    safe_print("检查前端资源...")
    
    # 检查构建文件是否存在
    build_files = ['build/app.min.js', 'build/app.min.css']
    missing_files = [f for f in build_files if not Path(f).exists()]
    
    if missing_files:
        safe_print(f"构建文件缺失: {missing_files}")
        return True
    
    try:
        result = subprocess.run(['node', 'check-build.js'], 
                              capture_output=True, text=True, 
                              errors='ignore', timeout=10)
        
        if result.returncode == 0:
            safe_print("前端资源已是最新版本")
            return False
        else:
            safe_print("检测到源文件更新")
            return True
            
    except (FileNotFoundError, subprocess.TimeoutExpired):
        safe_print("无法运行构建检查，假设需要构建")
        return True
    except Exception as e:
        safe_print(f"构建检查异常: {e}")
        return False

def build_frontend():
    """构建前端资源"""
    safe_print("构建前端资源...")
    
    try:
        result = subprocess.run(['node', 'build.js'], 
                              capture_output=True, text=True, 
                              errors='ignore', timeout=60)
        
        if result.returncode == 0:
            safe_print("前端资源构建完成")
            return True
        else:
            safe_print("构建失败")
            if result.stderr:
                safe_print(f"错误信息: {result.stderr[:200]}...")
            return False
            
    except subprocess.TimeoutExpired:
        safe_print("构建超时")
        return False
    except FileNotFoundError:
        safe_print("未找到 Node.js")
        return False
    except Exception as e:
        safe_print(f"构建异常: {e}")
        return False

def kill_port_processes():
    """清理端口占用"""
    safe_print("清理端口占用...")
    
    try:
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
                safe_print(f"终止进程 PID {pid}")
                run_command_safe(f'taskkill /PID {pid} /F')
        
        safe_print("端口清理完成")
        time.sleep(1)
        
    except Exception as e:
        safe_print(f"端口清理异常: {e}")

def start_backend():
    """启动后端服务"""
    safe_print("启动后端服务...")
    
    backend_dir = Path(__file__).parent / "backend"
    if not backend_dir.exists():
        safe_print("后端目录不存在")
        return False
    
    try:
        os.chdir(backend_dir)
        subprocess.Popen(['cmd', '/c', 'start', '雯婷后端服务', 'npm', 'run', 'dev'],
                        creationflags=subprocess.CREATE_NEW_CONSOLE)
        safe_print("后端服务启动中...")
        return True
    except Exception as e:
        safe_print(f"后端启动失败: {e}")
        return False

def start_cloudflared_simple():
    """简单启动cloudflared"""
    exe_path = Path(__file__).parent / "cloudflared.exe"
    if not exe_path.exists():
        safe_print("未找到 cloudflared.exe")
        return None
    
    safe_print("启动 Cloudflare Tunnel...")
    
    try:
        subprocess.Popen([str(exe_path), 'tunnel', '--url', 'http://localhost:3001'],
                        creationflags=subprocess.CREATE_NEW_CONSOLE)
        
        safe_print("Cloudflare Tunnel 已在新窗口中启动")
        safe_print("请从 cloudflared 窗口中查找 https://xxxxx.trycloudflare.com 地址")
        
        return "请手动获取地址"
        
    except Exception as e:
        safe_print(f"Cloudflare Tunnel 启动失败: {e}")
        return None

def wait_backend_ready():
    """等待后端就绪"""
    safe_print("等待后端服务启动...")
    
    for i in range(15):
        try:
            result = run_command_safe('netstat -ano | findstr :3001', capture_output=True)
            if result and 'LISTENING' in result:
                safe_print("后端服务已启动")
                return True
        except:
            pass
        
        safe_print(f"等待中... ({i+1}/15)")
        time.sleep(2)
    
    safe_print("后端服务启动超时，但继续执行")
    return False

def main():
    """主函数"""
    safe_print("=" * 40)
    safe_print("雯婷应用启动脚本")
    safe_print("=" * 40)
    
    try:
        # 1. 检查和构建前端资源
        if check_build_needed():
            if not build_frontend():
                safe_print("前端构建失败，请手动运行: node build.js")
        
        # 2. 清理端口
        kill_port_processes()
        
        # 3. 启动后端
        if not start_backend():
            safe_print("后端启动失败")
            return
        
        # 4. 等待后端就绪
        wait_backend_ready()
        
        # 5. 启动cloudflared
        cf_result = start_cloudflared_simple()
        
        safe_print("\n" + "=" * 40)
        safe_print("启动完成！")
        safe_print("=" * 40)
        safe_print("本地访问: http://localhost:3001")
        safe_print("外网访问: 请查看cloudflared窗口获取地址")
        safe_print("=" * 40)
        safe_print("提示:")
        safe_print("- 修改前端代码后会自动检测并重新构建")
        safe_print("- 如需手动构建: node build.js")
        safe_print("=" * 40)
        
        input("\n按 Enter 键退出脚本...")
        
    except KeyboardInterrupt:
        safe_print("\n用户中断退出")
    except Exception as e:
        safe_print(f"\n启动异常: {e}")
        input("按 Enter 键退出...")

if __name__ == "__main__":
    main()