#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
雯婷应用启动脚本
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
    
    # 源文件列表
    source_files = [
        'js/config.js', 'js/utils.js', 'js/deviceManager.js',
        'js/apiClient.js', 'js/websocketClient.js', 'js/globalUserState.js',
        'js/dateManager.js', 'js/todoManager.js', 'js/notesManager.js',
        'js/userManager.js', 'js/weatherManager.js', 'js/app.js',
        'styles/main.css', 'styles/mobile.css', 'styles/components.css'
    ]
    
    # 构建文件
    build_files = ['build/app.min.js', 'build/app.min.css']
    
    # 检查构建文件是否存在
    missing_files = [f for f in build_files if not Path(f).exists()]
    if missing_files:
        safe_print(f"构建文件缺失: {missing_files}")
        return True
    
    try:
        # 获取构建文件的最早修改时间
        build_times = []
        for build_file in build_files:
            if Path(build_file).exists():
                build_times.append(Path(build_file).stat().st_mtime)
        
        if not build_times:
            return True
            
        min_build_time = min(build_times)
        
        # 检查源文件是否比构建文件新
        for source_file in source_files:
            source_path = Path(source_file)
            if source_path.exists():
                source_time = source_path.stat().st_mtime
                if source_time > min_build_time:
                    safe_print(f"检测到源文件更新: {source_file}")
                    return True
        
        safe_print("前端资源已是最新版本")
        return False
        
    except Exception as e:
        safe_print(f"构建检查异常: {e}")
        return True  # 出错时假设需要构建

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
    
    # 确保在backend目录下执行
    original_dir = os.getcwd()
    os.chdir(str(backend_dir))
    
    try:
        # 直接使用原始的start_simple.py中的成功方法
        cmd = 'start "Backend Server" cmd /k "npm run dev"'
        subprocess.run(cmd, shell=True)
        safe_print("后端服务启动中...")
        return True
    except Exception as e:
        safe_print(f"后端启动失败: {e}")
        return False
    finally:
        os.chdir(original_dir)

def start_cloudflared():
    """启动cloudflared"""
    exe_path = Path(__file__).parent / "cloudflared.exe"
    if not exe_path.exists():
        safe_print("未找到 cloudflared.exe")
        return None
    
    safe_print("启动 Cloudflare Tunnel...")
    
    try:
        # 使用与start_simple.py相同的方法
        cmd = [str(exe_path), 'tunnel', '--url', 'http://localhost:3001']
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, 
                                 stderr=subprocess.STDOUT, text=True, errors='ignore')
        https_url = None
        line_count = 0
        
        for line in process.stdout:
            line_count += 1
            line = line.rstrip()
            if line:
                safe_print(f"[cloudflared] {line}")
            
            if 'https://' in line and 'trycloudflare.com' in line:
                for word in line.split():
                    if word.startswith('https://') and 'trycloudflare.com' in word:
                        https_url = word.strip().rstrip('.,;')
                        safe_print(f"检测到访问地址: {https_url}")
                        break
            
            if https_url or line_count >= 30:
                break
        
        return https_url
    except Exception as e:
        safe_print(f"Cloudflare Tunnel 启动失败: {e}")
        return None

def wait_backend_ready():
    """等待后端就绪"""
    safe_print("等待后端服务启动...")
    
    for i in range(20):
        try:
            result = run_command_safe('netstat -ano | findstr :3001', capture_output=True)
            if result and 'LISTENING' in result:
                # 测试API是否可用
                try:
                    import urllib.request
                    with urllib.request.urlopen('http://localhost:3001/health', timeout=3) as response:
                        if response.status == 200:
                            safe_print("后端服务已启动")
                            return True
                except:
                    pass
        except:
            pass
        
        safe_print(f"等待中... ({i+1}/20)")
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
        
        # 4. 启动cloudflared
        cf_url = start_cloudflared()
        
        # 5. 等待后端就绪
        wait_backend_ready()
        
        # 6. 打开浏览器
        if cf_url and cf_url.startswith('https://'):
            safe_print(f"打开浏览器: {cf_url}")
            try:
                webbrowser.open(cf_url)
            except:
                safe_print("无法自动打开浏览器")
        
        safe_print("\n" + "=" * 40)
        safe_print("启动完成！")
        safe_print("=" * 40)
        if cf_url and cf_url.startswith('https://'):
            safe_print(f"外网访问: {cf_url}")
        safe_print("本地访问: http://localhost:3001")
        safe_print("=" * 40)
        
        input("\n按 Enter 键退出脚本...")
        
    except KeyboardInterrupt:
        safe_print("\n用户中断退出")
    except Exception as e:
        safe_print(f"\n启动异常: {e}")
        input("按 Enter 键退出...")

if __name__ == "__main__":
    main()