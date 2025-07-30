# Firebase 集成设置指南

本文档介绍如何为 WENTING 健康管理应用设置和配置 Firebase。

## 🚀 快速开始

### 1. 创建 Firebase 项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 点击 "添加项目"
3. 输入项目名称：`wenting-health-app`
4. 选择是否启用 Google Analytics（推荐）
5. 创建项目

### 2. 启用 Authentication

1. 在 Firebase 控制台中，点击 "Authentication"
2. 点击 "开始使用"
3. 在 "Sign-in method" 标签页中启用以下登录方式：
   - ✅ Email/Password
   - ✅ Google
   - ✅ 手机号码（可选）

### 3. 设置 Firestore Database

1. 点击 "Firestore Database"
2. 点击 "创建数据库"
3. 选择 "生产模式"（稍后我们会设置安全规则）
4. 选择数据库位置（推荐选择离用户最近的区域）

### 4. 配置 Web 应用

1. 在项目设置中，点击 Web 图标 `</>`
2. 注册应用：输入名称 "WENTING"
3. 复制配置对象并更新 `src/config/firebase.ts` 文件：

```typescript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 5. 设置 React Native 应用（Android/iOS）

#### Android 配置

1. 在 Firebase 控制台中，点击 Android 图标
2. 输入包名：`com.wenting.healthapp`
3. 下载 `google-services.json` 文件
4. 将文件放置在 `android/app/` 目录下

#### iOS 配置

1. 在 Firebase 控制台中，点击 iOS 图标
2. 输入包 ID：`com.wenting.healthapp`
3. 下载 `GoogleService-Info.plist` 文件
4. 将文件添加到 Xcode 项目中

### 6. 部署 Firestore 安全规则

将 `firestore.rules` 文件中的规则部署到 Firebase：

```bash
# 安装 Firebase CLI
npm install -g firebase-tools

# 登录到 Firebase
firebase login

# 初始化项目
firebase init firestore

# 部署安全规则
firebase deploy --only firestore:rules
```

## 🔐 安全配置

### Firestore 安全规则

我们的安全规则确保：
- 用户只能访问自己的数据
- 家庭成员可以访问共享的家庭数据
- 管理员有额外的权限
- 所有操作都需要身份验证

### 域名授权

在 Firebase 控制台 > Authentication > Settings > Authorized domains 中添加：
- `localhost` (开发环境)
- `your-domain.com` (生产环境)

## 🏗️ 项目架构

### 跨平台支持

我们的 Firebase 集成支持：
- **Web**: 使用 Firebase Web SDK v9+
- **React Native**: 使用 React Native Firebase
- **离线支持**: 本地 SQLite + Firebase 同步

### 服务层

```
src/config/firebase.ts          # Firebase 配置和初始化
src/services/auth/AuthService.ts            # 认证服务
src/services/database/FirebaseDatabaseService.ts  # 数据库服务
```

### 数据流

```
用户操作 → AuthService → Firebase Auth → 本地存储
           ↓
     DatabaseService → Firestore → 本地 SQLite (离线缓存)
```

## 🧪 测试

运行 Firebase 集成测试：

```bash
npm test src/__tests__/firebase-integration.test.ts
```

测试包括：
- Firebase 初始化
- 认证流程
- 数据库操作
- 错误处理
- 跨平台兼容性

## 📱 使用方法

### 认证

```typescript
import { firebaseAuthService } from '@config/firebase';

// 邮箱登录
const result = await firebaseAuthService.signInWithEmail(email, password);

// Google 登录
const result = await firebaseAuthService.signInWithGoogle();

// 注册
const result = await firebaseAuthService.createUserWithEmail(email, password, displayName);
```

### 数据库操作

```typescript
import FirebaseDatabaseService from '@services/database/FirebaseDatabaseService';

// 创建用户
await FirebaseDatabaseService.createUser(userData);

// 获取健康记录
const records = await FirebaseDatabaseService.getHealthRecords(
  householdId, 
  userId, 
  userRole, 
  encryptionKey
);
```

## 🔒 数据加密

敏感的健康数据在存储前会进行加密：
- 使用 AES-256 加密算法
- 每个用户有独立的加密密钥
- 密钥安全存储在设备本地

## 🌐 环境配置

### 开发环境

```bash
# .env.development
GOOGLE_WEB_CLIENT_ID=your-web-client-id
GOOGLE_IOS_CLIENT_ID=your-ios-client-id
```

### 生产环境

```bash
# .env.production
GOOGLE_WEB_CLIENT_ID=your-production-web-client-id
GOOGLE_IOS_CLIENT_ID=your-production-ios-client-id
```

## 🚨 故障排除

### 常见问题

1. **Firebase 初始化失败**
   - 检查 Firebase 配置是否正确
   - 确认网络连接
   - 检查控制台错误信息

2. **Google 登录失败**
   - 验证 OAuth 客户端 ID 配置
   - 检查包名/Bundle ID 是否匹配
   - 确认 SHA1 指纹（Android）

3. **Firestore 权限错误**
   - 检查安全规则是否正确部署
   - 确认用户已通过身份验证
   - 验证数据结构是否符合规则

### 调试模式

启用 Firebase 调试日志：

```typescript
// 在开发环境中启用
if (__DEV__) {
  console.log('Firebase debugging enabled');
}
```

## 📊 监控和分析

### Performance Monitoring

在 Firebase 控制台中启用 Performance Monitoring 来监控：
- 应用启动时间
- 网络请求性能
- 自定义性能指标

### Crashlytics

启用 Crashlytics 来跟踪和修复崩溃：
- 实时崩溃报告
- 详细的错误堆栈
- 用户影响分析

## 🔄 数据同步策略

### 在线模式
- 直接操作 Firestore
- 实时数据同步
- 自动冲突解决

### 离线模式
- 使用本地 SQLite 缓存
- 后台同步队列
- 网络恢复时自动同步

## 📋 部署清单

发布前确保：
- [ ] Firebase 配置已更新为生产环境值
- [ ] Firestore 安全规则已部署
- [ ] Google 登录配置正确
- [ ] 所有测试通过
- [ ] 性能监控已启用
- [ ] 崩溃报告已配置

## 📚 相关文档

- [Firebase 官方文档](https://firebase.google.com/docs)
- [React Native Firebase](https://rnfirebase.io/)
- [Firestore 安全规则](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)

---

需要帮助？请查看我们的 [开发文档](./WENTING-Development-Guide.md) 或创建一个 issue。