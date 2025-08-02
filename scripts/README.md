# 数据库管理脚本

## 🚀 推荐: Web版清空脚本 (clear_database_web.js)

**这是推荐使用的版本**，使用Firebase Web SDK，配置简单，无需额外的服务账户密钥。

### 使用方法

1. **确保已安装依赖**
   ```bash
   # 项目已经安装了firebase依赖，无需额外安装
   ```

2. **运行脚本**
   ```bash
   cd scripts
   node clear_database_web.js
   ```

3. **确认操作**
   - 输入 `yes` 确认清空数据库
   - 输入 `no` 取消操作

### 示例输出
```
🔥 Firebase数据库清空工具 (Web版)
===================================

⚠️  警告: 此操作将永久删除数据库中的所有数据!
⚠️  此操作不可逆转!

将要清空的集合: users, households, household_members, health_records, user_profiles, invitations, notifications

确定要继续吗? (输入 'yes' 确认, 'no' 取消): yes

🚀 开始清空数据库...

🗑️  开始清空 7 个集合...
==================================================

📁 正在清空集合: users
  ✅ 删除了 3 个文档

📁 正在清空集合: households
  ✅ 删除了 1 个文档

📁 正在清空集合: household_members
  ✅ 删除了 2 个文档

==================================================
✅ 清空完成! 总共删除了 6 个文档

🎉 数据库清空完成!

👋 脚本执行完成
```

---

## Python版清空脚本 (clear_database.py)

备用版本，需要服务账户密钥配置。

这个脚本用于清空Firebase Firestore数据库中的所有测试数据，方便从头开始测试。

### 准备工作

1. **安装Python依赖**
   ```bash
   pip install firebase-admin
   ```

2. **获取Firebase服务账户密钥**
   - 登录 [Firebase Console](https://console.firebase.google.com/)
   - 选择你的项目
   - 进入 "项目设置" > "服务帐户"
   - 点击 "生成新的私钥"
   - 下载JSON文件并重命名为 `firebase-service-account.json`
   - 将文件放在项目根目录

3. **配置脚本**
   打开 `clear_database.py` 并修改以下配置：
   ```python
   SERVICE_ACCOUNT_KEY_PATH = "../firebase-service-account.json"  # 服务账户密钥路径
   PROJECT_ID = "your-project-id"  # 替换为你的Firebase项目ID
   ```

### 使用方法

1. **进入scripts目录**
   ```bash
   cd scripts
   ```

2. **运行清空脚本**
   ```bash
   python clear_database.py
   ```

3. **确认操作**
   - 脚本会显示警告信息
   - 输入 `yes` 确认清空数据库
   - 输入 `no` 取消操作

### 清空的集合

脚本会清空以下Firestore集合：
- `users` - 用户信息
- `households` - 家庭信息
- `household_members` - 家庭成员
- `health_records` - 健康记录
- `user_profiles` - 用户配置
- `invitations` - 邀请信息
- `notifications` - 通知信息

### 安全提示

⚠️ **重要警告:**
- 此操作会永久删除所有数据，无法恢复
- 建议只在开发和测试环境使用
- 生产环境请谨慎使用

### 故障排除

1. **ImportError: No module named 'firebase_admin'**
   ```bash
   pip install firebase-admin
   ```

2. **找不到服务账户密钥文件**
   - 检查文件路径是否正确
   - 确保JSON文件存在且有效

3. **权限错误**
   - 确保服务账户有Firestore读写权限
   - 检查项目ID是否正确

### 示例输出

```
🔥 Firebase数据库清空工具
==============================

⚠️  警告: 此操作将永久删除数据库中的所有数据!
⚠️  此操作不可逆转!

将要清空的集合: users, households, household_members, health_records, user_profiles, invitations, notifications

确定要继续吗? (输入 'yes' 确认, 'no' 取消): yes

🚀 开始初始化Firebase...
✅ Firebase初始化成功

🗑️  开始清空 7 个集合...
==================================================

📁 正在清空集合: users
  ✅ 删除了 5 个文档

📁 正在清空集合: households
  ✅ 删除了 2 个文档

...

==================================================
✅ 清空完成! 总共删除了 15 个文档

🎉 数据库清空完成!
```