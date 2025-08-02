#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库清空脚本
用于测试时清空Firebase Firestore数据库中的所有数据

使用方法:
1. 确保已安装firebase-admin: pip install firebase-admin
2. 确保有Firebase服务账户密钥文件
3. 运行: python clear_database.py
"""

import os
import sys
from typing import List

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ 错误: 请先安装firebase-admin")
    print("运行: pip install firebase-admin")
    sys.exit(1)

# Firebase配置
SERVICE_ACCOUNT_KEY_PATH = "../firebase-service-account.json"  # 请根据实际路径调整
PROJECT_ID = "your-project-id"  # 请替换为你的Firebase项目ID

# 需要清空的集合列表
COLLECTIONS_TO_CLEAR = [
    'users',
    'households', 
    'household_members',
    'health_records',
    'user_profiles',
    'invitations',
    'notifications'
]

def initialize_firebase():
    """初始化Firebase"""
    try:
        # 检查服务账户密钥文件是否存在
        if not os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
            print(f"❌ 错误: 找不到服务账户密钥文件: {SERVICE_ACCOUNT_KEY_PATH}")
            print("请确保Firebase服务账户密钥文件存在")
            return None
            
        # 初始化Firebase
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        firebase_admin.initialize_app(cred, {
            'projectId': PROJECT_ID,
        })
        
        db = firestore.client()
        print("✅ Firebase初始化成功")
        return db
        
    except Exception as e:
        print(f"❌ Firebase初始化失败: {str(e)}")
        return None

def delete_collection(db, collection_name: str, batch_size: int = 100):
    """删除指定集合中的所有文档"""
    try:
        collection_ref = db.collection(collection_name)
        
        # 获取所有文档
        docs = collection_ref.limit(batch_size).stream()
        deleted = 0
        
        for doc in docs:
            doc.reference.delete()
            deleted += 1
            
        if deleted > 0:
            print(f"  ✅ 删除了 {deleted} 个文档")
            # 如果还有更多文档，递归删除
            if deleted == batch_size:
                return delete_collection(db, collection_name, batch_size)
        else:
            print(f"  ℹ️  集合为空")
            
        return deleted
        
    except Exception as e:
        print(f"  ❌ 删除失败: {str(e)}")
        return 0

def clear_all_collections(db, collections: List[str]):
    """清空所有指定的集合"""
    total_deleted = 0
    
    print(f"\n🗑️  开始清空 {len(collections)} 个集合...")
    print("=" * 50)
    
    for collection_name in collections:
        print(f"\n📁 正在清空集合: {collection_name}")
        deleted = delete_collection(db, collection_name)
        total_deleted += deleted
        
    print("=" * 50)
    print(f"✅ 清空完成! 总共删除了 {total_deleted} 个文档")

def confirm_action():
    """确认用户是否真的要清空数据库"""
    print("⚠️  警告: 此操作将永久删除数据库中的所有数据!")
    print("⚠️  此操作不可逆转!")
    print(f"\n将要清空的集合: {', '.join(COLLECTIONS_TO_CLEAR)}")
    
    while True:
        response = input("\n确定要继续吗? (输入 'yes' 确认, 'no' 取消): ").lower().strip()
        if response == 'yes':
            return True
        elif response == 'no':
            return False
        else:
            print("请输入 'yes' 或 'no'")

def main():
    """主函数"""
    print("🔥 Firebase数据库清空工具")
    print("=" * 30)
    
    # 确认操作
    if not confirm_action():
        print("❌ 操作已取消")
        return
    
    print("\n🚀 开始初始化Firebase...")
    
    # 初始化Firebase
    db = initialize_firebase()
    if not db:
        print("❌ 无法连接到数据库，操作终止")
        return
    
    try:
        # 清空所有集合
        clear_all_collections(db, COLLECTIONS_TO_CLEAR)
        print("\n🎉 数据库清空完成!")
        
    except Exception as e:
        print(f"\n❌ 清空过程中发生错误: {str(e)}")
    
    finally:
        # 清理Firebase连接
        try:
            firebase_admin.delete_app(firebase_admin.get_app())
        except:
            pass

if __name__ == "__main__":
    main()