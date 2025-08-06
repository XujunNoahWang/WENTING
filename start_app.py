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
import threading
import yaml
import urllib.request

CLOUDFLARE_CONFIG_PATH = str(Path(__file__).parent / 'cloudflared_config.yml')
def write_cloudflared_config():
    """生成 cloudflared ingress 配置文件，/api/* 代理 3001，其他全部代理 3000"""
    config = {
        'ingress': [
            {
                'path': '/api/*', 
                'service': 'http://localhost:3001'
            },
            {
                'service': 'http://localhost:3000'
            }
        ],
        # 添加一些性能和安全配置
        'originRequest': {
            'connectTimeout': '30s',
            'tlsTimeout': '10s',
            'tcpKeepAlive': '30s',
            'noHappyEyeballs': False,
            'keepAliveTimeout': '90s',
            'keepAliveConnections': 100
        }
    }
    
    with open(CLOUDFLARE_CONFIG_PATH, 'w', encoding='utf-8') as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False)
    
    print(f"✅ 已生成 cloudflared 配置文件: {CLOUDFLARE_CONFIG_PATH}")
    
    # 显示配置内容用于调试
    print("📋 配置文件内容:")
    with open(CLOUDFLARE_CONFIG_PATH, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            print(f"  {line_num:2d}: {line.rstrip()}")

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
    
    # 使用start命令在新窗口中启动，使用dev模式获得更好的错误信息
    cmd = 'start "Backend Server" cmd /k "npm run dev"'
    run_command(cmd)
    
    print("✅ 后端服务启动中...")
    return True

def start_frontend():
    """启动前端服务"""
    print("🌐 启动前端服务...")
    project_root = Path(__file__).parent
    os.chdir(project_root)  # 强制切换到项目根目录
    print(f"[调试] 当前前端服务工作目录: {os.getcwd()}")
    
    # 检查关键文件是否存在
    key_files = ['index.html', 'js/apiClient.js', 'js/app.js']
    for file in key_files:
        if not Path(file).exists():
            print(f"❌ 关键文件不存在: {file}")
            return False
        else:
            print(f"✅ 关键文件存在: {file}")
    
    # 启动前端服务
    cmd = 'start "Frontend Server" cmd /k "python -m http.server 3000"'
    run_command(cmd)
    
    print("✅ 前端服务启动中...")
    return True

def start_cloudflared_ingress():
    """同步启动 cloudflared tunnel 并捕获 HTTPS 地址"""
    exe_path = str(Path(__file__).parent / "cloudflared.exe")
    if not Path(exe_path).exists():
        print(f"❌ 未找到 cloudflared.exe，请将 cloudflared.exe 放在脚本目录下！")
        return None
    
    print("🌐 启动 Cloudflare Tunnel...")
    print(f"📁 配置文件路径: {CLOUDFLARE_CONFIG_PATH}")
    
    # 使用 ingress 配置启动
    cmd = [exe_path, 'tunnel', '--config', CLOUDFLARE_CONFIG_PATH]
    print(f"🔧 执行命令: {' '.join(cmd)}")
    
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    https_url = None
    line_count = 0
    max_lines = 50  # 最多读取50行，避免无限等待
    
    for line in process.stdout:
        line_count += 1
        print(f"[cloudflared] {line.rstrip()}")
        
        if 'https://' in line and 'trycloudflare.com' in line:
            # 提取 https 地址
            for word in line.split():
                if word.startswith('https://') and 'trycloudflare.com' in word:
                    https_url = word.strip().rstrip('.,;')  # 移除末尾标点符号
                    print(f"[cloudflared] 🚀 检测到访问地址: {https_url}")
                    break
        
        if https_url or line_count >= max_lines:
            break
    
    # cloudflared 进程继续后台运行
    threading.Thread(target=process.communicate, daemon=True).start()
    
    if https_url:
        print(f"✅ Cloudflare Tunnel 启动成功: {https_url}")
    else:
        print("⚠️ 未能获取 cloudflare HTTPS 地址，请检查 cloudflared 输出")
        print("💡 如果 cloudflared 正在运行，请手动查看其输出窗口获取访问地址")
    
    return https_url

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
        
        # 如果后端已启动，尝试测试API连接
        backend_api_ready = False
        if backend_ready:
            try:
                import urllib.request
                with urllib.request.urlopen('http://localhost:3001/health', timeout=3) as response:
                    if response.status == 200:
                        backend_api_ready = True
            except:
                pass  # API还没准备好
        
        if backend_ready and frontend_ready and backend_api_ready:
            print("✅ 所有服务启动完成")
            print("✅ 后端API健康检查通过")
            return True
        
        status = f"后端端口:{'✅' if backend_ready else '❌'} 后端API:{'✅' if backend_api_ready else '❌'} 前端:{'✅' if frontend_ready else '❌'}"
        print(f"  等待中... ({attempt + 1}/{max_attempts}) {status}")
        time.sleep(2)
    
    print("⚠️ 服务启动超时，但将继续执行")
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

def check_static_resource():
    url = 'http://localhost:3000/js/apiClient.js'
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            if resp.status == 200 and 'javascript' in resp.getheader('Content-Type', ''):
                print(f"✅ 本地静态资源可用: {url}")
                return True
            else:
                print(f"❌ 静态资源 Content-Type 异常: {resp.getheader('Content-Type', '')}")
                return False
    except Exception as e:
        print(f"❌ 无法访问本地静态资源: {url}\n错误: {e}")
        return False

def main():
    """主函数"""
    # 设置控制台编码
    import sys
    if sys.platform == 'win32':
        import os
        os.system('chcp 65001 > nul')  # 设置为UTF-8编码
    
    print("=" * 50)
    print("雯婷应用启动脚本")
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
        
        # 3.5 检查静态资源
        print("⏳ 检查本地静态资源可用性...")
        time.sleep(3)  # 等待前端服务完全启动
        if not check_static_resource():
            print("❌ 本地静态资源不可用，终止启动。请检查前端服务目录和 js 目录结构！")
            return
        
        # 4. 生成 cloudflared 配置并启动 tunnel
        write_cloudflared_config()
        cf_url = start_cloudflared_ingress()
        
        # 5. 等待服务启动
        wait_for_services()
        
        # 6. 打开浏览器
        if cf_url:
            print(f"🌐 打开 cloudflare 浏览器地址: {cf_url}")
            webbrowser.open(cf_url)
        else:
            print("❌ 未能获取 cloudflare 地址，未自动打开浏览器。请手动检查 cloudflared 日志。")
        
        print("\n" + "=" * 50)
        print("应用启动完成！")
        print("=" * 50)
        if cf_url:
            print(f"外网访问地址: {cf_url}")
            print(f"手机/电脑通过此地址访问: {cf_url}")
            print(f"API 地址: {cf_url}/api")
            print(f"本地访问地址: http://localhost:3000")
        else:
            print("本地访问地址: http://localhost:3000")
            print("后端API地址: http://localhost:3001")
            print("警告: 未获取到 Cloudflare 地址，仅本地可访问")
        print("=" * 50)
        print("功能说明:")
        print("  - 每个设备都有独立的数据存储")
        print("  - 支持地理位置获取和天气显示")
        print("  - 多用户 TODO 管理系统")
        print("=" * 50)
        print("提示: 关闭此窗口不会停止服务")
        print("要停止服务，请关闭对应的服务器窗口")
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