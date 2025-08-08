#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能构建检查脚本 - 只在需要时才构建
"""

import os
import subprocess
from pathlib import Path

def check_and_build():
    """检查是否需要构建，如果需要则自动构建"""
    print("🔍 检查是否需要重新构建前端资源...")
    
    # 运行构建检查脚本
    try:
        result = subprocess.run(['node', 'check-build.js'], 
                              capture_output=True, text=True, cwd=Path(__file__).parent)
        
        if result.returncode == 0:
            print("✅ 前端资源已是最新版本")
            return True
        else:
            print("⚠️  检测到源文件更新，开始自动构建...")
            print(result.stdout)
            
            # 运行构建
            build_result = subprocess.run(['node', 'build.js'], 
                                        capture_output=True, text=True, cwd=Path(__file__).parent)
            
            if build_result.returncode == 0:
                print("🎉 前端资源构建完成！")
                print(build_result.stdout)
                return True
            else:
                print("❌ 构建失败:")
                print(build_result.stderr)
                return False
                
    except FileNotFoundError:
        print("❌ 未找到 Node.js，请确保已安装 Node.js")
        return False
    except Exception as e:
        print(f"❌ 构建检查失败: {e}")
        return False

if __name__ == "__main__":
    success = check_and_build()
    exit(0 if success else 1)