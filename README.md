# WENTING - 家庭健康监督应用

一款智能的移动端家庭健康管理应用，致力于守护全家人的健康。

## 功能特点

### 核心功能（MVP版本）

- **多方式登录认证**
  - 邮箱/密码登录
  - 手机号验证登录
  - Google账号登录
  - 生物识别认证

- **家庭管理系统**
  - 创建和管理家庭
  - 邀请家庭成员
  - 角色权限管理（Admin/Member）
  - 隐私保护机制

- **智能健康档案**
  - 手动录入健康信息
  - 拍照上传医疗文档
  - AI智能识别医疗内容（Google Gemini）
  - 用户审核确认机制

- **智能提醒系统**
  - 个性化用药提醒
  - 多用户通知支持
  - 基于天气的健康提醒
  - 季节性健康建议

- **健康日历**
  - 体检预约管理
  - 复查提醒
  - 日程冲突检测
  - Google Calendar集成（规划中）

### 安全特性

- **HIPAA合规设计**
  - AES-256端到端加密
  - 字段级数据加密
  - 完整审计日志
  - 数据匿名化处理

- **隐私保护**
  - 生物识别身份验证
  - 加密存储
  - 角色权限控制
  - 安全会话管理

## 技术架构

### 技术栈

- **前端**: React Native 0.73+ (TypeScript)
- **状态管理**: Redux Toolkit + RTK Query
- **导航**: React Navigation 6.x
- **数据库**: SQLite (加密存储)
- **AI服务**: Google Gemini API
- **认证**: Firebase Auth + 生物识别
- **通知**: Firebase Cloud Messaging
- **UI组件**: 自定义组件库 + React Native Vector Icons

### 项目结构

```
WENTING/
├── src/
│   ├── components/          # 可重用UI组件
│   │   ├── common/         # 通用组件
│   │   ├── forms/          # 表单组件
│   │   ├── health/         # 健康相关组件
│   │   └── household/      # 家庭管理组件
│   ├── screens/            # 页面组件
│   │   ├── auth/          # 认证页面
│   │   ├── household/     # 家庭管理
│   │   ├── health/        # 健康档案
│   │   ├── calendar/      # 健康日历
│   │   └── profile/       # 个人中心
│   ├── services/           # 业务逻辑层
│   │   ├── api/           # API服务
│   │   ├── database/      # 数据库操作
│   │   ├── gemini/        # AI集成
│   │   ├── notifications/ # 通知服务
│   │   └── security/      # 安全服务
│   ├── store/             # Redux状态管理
│   ├── utils/             # 工具函数
│   ├── types/             # TypeScript类型定义
│   ├── constants/         # 应用常量
│   └── navigation/        # 导航配置
├── __tests__/             # 测试文件
└── docs/                  # 文档
```

## 开发指南

### 环境要求

- Node.js >= 16
- React Native CLI
- iOS开发环境（Xcode）
- Android开发环境（可选）

### 安装依赖

```bash
# 安装依赖
npm install

# iOS依赖（仅iOS）
cd ios && pod install && cd ..
```

### 环境配置

1. 复制环境变量文件：
```bash
cp .env.example .env
```

2. 配置API密钥：
```
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_API_KEY=your_firebase_api_key
# ... 其他配置
```

### 运行应用

```bash
# 启动Metro
npm start

# 运行iOS
npm run ios

# 运行Android
npm run android
```

### 开发命令

```bash
# 代码检查
npm run lint
npm run lint:fix

# 类型检查
npm run type-check

# 运行测试
npm test
npm run test:coverage

# 构建生产版本
npm run ios:build
npm run android:build
```

## API集成

### Google Gemini AI

用于医疗文档识别和智能健康建议生成：

- 医疗文档OCR识别
- 药物信息提取
- 个性化健康建议
- 天气相关健康提醒

### Firebase服务

- **Authentication**: 用户认证管理
- **Cloud Messaging**: 推送通知服务
- **Analytics**: 应用分析（可选）

## 数据库设计

### 核心表结构

- `users` - 用户信息
- `households` - 家庭信息
- `household_members` - 家庭成员关系
- `health_records` - 健康档案（加密）
- `reminders` - 提醒设置
- `health_calendar` - 健康日历事件
- `audit_logs` - 审计日志

## 安全考虑

### 数据保护

- 所有健康数据都经过AES-256加密
- 用户密钥基于生物识别或密码生成
- 支持字段级加密
- 完整的审计追踪

### 隐私合规

- 遵循HIPAA数据处理标准
- 数据匿名化处理
- 用户数据完全控制
- 安全的数据导出功能

## 测试

### 测试覆盖

- 单元测试：服务层和工具函数
- 集成测试：数据库操作
- 组件测试：UI组件
- E2E测试：关键用户流程

```bash
# 运行所有测试
npm test

# 查看测试覆盖率
npm run test:coverage

# 监听模式
npm run test:watch
```

## 部署

### iOS App Store

1. 配置Xcode项目
2. 设置签名证书
3. 构建Archive
4. 上传到App Store Connect

### 版本管理

- 遵循语义化版本控制
- 使用Conventional Commits
- 自动化版本发布

## 贡献指南

### 开发流程

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

### 代码规范

- 使用TypeScript
- 遵循ESLint规则
- 组件和函数注释
- 测试覆盖新功能

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目主页：[GitHub Repository]
- 问题反馈：[Issues]
- 邮箱：team@wenting.app

---

**WENTING** - 用智能科技守护家人健康 ❤️