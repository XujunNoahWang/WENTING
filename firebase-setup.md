# Firebase Authentication 实现指南

## 步骤 1: 创建 Firebase 项目

1. 访问 https://console.firebase.google.com/
2. 点击"添加项目"
3. 输入项目名称：`wenting-health-app`
4. 启用 Google Analytics（可选）
5. 创建项目

## 步骤 2: 启用 Authentication

1. 在项目控制台中，点击 "Authentication"
2. 点击 "开始使用"
3. 在 "Sign-in method" 标签页中启用：
   - Email/Password
   - Google
   - 其他需要的登录方式

## 步骤 3: 获取配置信息

1. 点击项目设置 ⚙️
2. 选择"项目设置"
3. 滚动到"您的应用"部分
4. 点击 Web 图标 `</>`
5. 注册应用：输入名称 "WENTING"
6. 复制配置对象：

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## 步骤 4: 安装依赖

```bash
npm install firebase
npm install react-firebase-hooks  # 可选的 React hooks
```

## 步骤 5: 实现代码

参考项目中的 `src/services/auth/AuthService.ts` 文件，已包含完整的实现。

## Web 平台特殊配置

### 域名授权
在 Firebase 控制台 > Authentication > Settings > Authorized domains 中添加：
- localhost (开发)
- your-domain.com (生产)

### Google 登录配置
需要在 Google Cloud Console 中配置 OAuth 客户端 ID。

## 安全规则示例

```javascript
// Firestore 安全规则
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 用户只能访问自己的数据
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 家庭成员可以访问家庭数据
    match /households/{householdId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/household_members/$(request.auth.uid + '_' + householdId));
    }
  }
}
```

## 邮箱验证模板自定义

在 Firebase 控制台 > Authentication > Templates 中可以自定义：
- 邮箱验证邮件
- 密码重置邮件
- 邮箱变更通知

支持中文模板和自定义品牌。