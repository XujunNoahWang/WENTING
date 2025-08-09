# 设计文档

## 概述

用户关联功能是一个数据同步系统，允许已注册的app_users与被监管用户(users)建立关联关系。当关联建立后，两个用户将共享特定被监管用户的所有数据（todos、notes等），并实现实时双向同步。

## 架构

### 数据流架构
```
管理员(妈妈) -> 发起关联请求 -> 目标用户(爸爸)
     ↓                           ↓
  选择被监管用户              接收通知确认
     ↓                           ↓
  填写app_user用户名          确认/拒绝关联
     ↓                           ↓
  发送关联请求               建立关联关系
     ↓                           ↓
  等待确认                   数据同步开始
```

### 同步架构
```
用户A数据库 ←→ 关联关系表 ←→ 用户B数据库
     ↓              ↓              ↓
  操作监听      同步触发器      操作监听
     ↓              ↓              ↓
  数据变更      实时同步       数据变更
```

## 组件和接口

### 1. 数据库组件

#### 新增表结构

**user_links表** - 存储用户关联关系
```sql
CREATE TABLE user_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_app_user TEXT NOT NULL,           -- 管理员的app_user用户名
    linked_app_user TEXT NOT NULL,            -- 被关联的app_user用户名
    supervised_user_id INTEGER NOT NULL,      -- 被监管用户ID
    status TEXT DEFAULT 'pending',            -- 状态: pending, active, rejected, cancelled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supervised_user_id) REFERENCES users(id),
    UNIQUE(manager_app_user, linked_app_user, supervised_user_id)
);
```

**link_requests表** - 存储关联请求
```sql
CREATE TABLE link_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_app_user TEXT NOT NULL,              -- 发起请求的用户
    to_app_user TEXT NOT NULL,                -- 接收请求的用户
    supervised_user_id INTEGER NOT NULL,      -- 被监管用户ID
    supervised_user_name TEXT NOT NULL,       -- 被监管用户名称（用于显示）
    message TEXT,                             -- 请求消息
    status TEXT DEFAULT 'pending',            -- 状态: pending, accepted, rejected, expired
    expires_at DATETIME,                      -- 过期时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supervised_user_id) REFERENCES users(id)
);
```

#### 修改现有表结构

**users表** - 添加关联字段
```sql
ALTER TABLE users ADD COLUMN supervised_app_user TEXT;  -- 关联的app_user用户名
ALTER TABLE users ADD COLUMN is_linked BOOLEAN DEFAULT FALSE;  -- 是否已关联
```

### 2. 后端API组件

#### LinkController类
```javascript
class LinkController {
    // 发起关联请求
    static async createLinkRequest(req, res)
    
    // 获取待处理的关联请求
    static async getPendingRequests(req, res)
    
    // 处理关联请求（接受/拒绝）
    static async handleLinkRequest(req, res)
    
    // 获取用户的关联关系
    static async getUserLinks(req, res)
    
    // 取消关联关系
    static async cancelLink(req, res)
}
```

#### LinkService类
```javascript
class LinkService {
    // 创建关联请求
    static async createRequest(fromUser, toUser, supervisedUserId)
    
    // 建立关联关系
    static async establishLink(requestId)
    
    // 同步用户数据
    static async syncUserData(supervisedUserId, fromAppUser, toAppUser)
    
    // 实时同步数据变更
    static async syncDataChange(operation, table, data, supervisedUserId)
}
```

### 3. 前端组件

#### LinkPage组件
- 位置：`link.html`
- 功能：关联管理界面
- 布局：顶部天气 + 左侧用户列表 + 右侧用户信息 + 底部功能栏

#### LinkManager类
```javascript
class LinkManager {
    // 初始化关联管理器
    constructor()
    
    // 加载用户列表
    async loadUsers()
    
    // 显示用户信息
    displayUserInfo(user)
    
    // 发起关联请求
    async sendLinkRequest(supervisedUserId, targetUsername)
    
    // 处理关联请求响应
    async handleLinkResponse(requestId, action)
}
```

#### LinkNotification组件
```javascript
class LinkNotification {
    // 显示关联请求通知
    static showLinkRequest(request)
    
    // 显示关联状态通知
    static showLinkStatus(status, message)
}
```

### 4. WebSocket组件

#### 实时通知系统
```javascript
// 关联请求通知
{
    type: 'link_request',
    data: {
        requestId: 123,
        fromUser: 'mama',
        supervisedUserName: '爸爸',
        message: '妈妈想要与您关联爸爸的健康数据'
    }
}

// 关联状态更新
{
    type: 'link_status',
    data: {
        status: 'accepted',
        message: '关联请求已被接受'
    }
}

// 数据同步通知
{
    type: 'data_sync',
    data: {
        operation: 'update',
        table: 'todos',
        supervisedUserId: 456
    }
}
```

## 数据模型

### 关联请求流程
1. **发起请求**：管理员选择被监管用户，填入目标app_user用户名
2. **验证用户**：系统验证目标用户是否存在
3. **创建请求**：在link_requests表中创建请求记录
4. **发送通知**：通过WebSocket向目标用户发送通知
5. **用户响应**：目标用户接受或拒绝请求
6. **建立关联**：如果接受，创建user_links记录并同步数据

### 数据同步模型
```javascript
// 同步数据结构
{
    supervisedUserId: 123,
    linkedUsers: ['mama', 'papa'],
    syncTables: ['todos', 'notes', 'user_settings'],
    lastSyncTime: '2025-01-09T10:30:00Z'
}
```

### 权限模型
- **管理员权限**：可以发起关联请求，管理被监管用户
- **关联用户权限**：可以查看和操作已关联的被监管用户数据
- **数据隔离**：只同步特定被监管用户的数据，其他用户数据保持隔离

## 错误处理

### 关联请求错误
- 目标用户不存在
- 重复关联请求
- 请求过期
- 用户拒绝关联

### 数据同步错误
- 网络连接失败
- 数据冲突解决
- 同步超时处理
- 数据完整性验证

### 错误恢复机制
```javascript
// 同步失败重试机制
const syncRetryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2
};

// 数据冲突解决策略
const conflictResolution = {
    strategy: 'timestamp_based',  // 基于时间戳的冲突解决
    fallback: 'manual_review'     // 手动审查作为后备方案
};
```

## 测试策略

### 单元测试
- LinkService类的所有方法
- 数据同步逻辑
- 权限验证逻辑
- 错误处理机制

### 集成测试
- 完整的关联请求流程
- 数据同步端到端测试
- WebSocket通信测试
- 数据库事务测试

### 用户界面测试
- 关联页面交互测试
- 通知显示测试
- 响应式设计测试
- 错误状态显示测试

### 性能测试
- 大量数据同步性能
- 并发用户关联测试
- WebSocket连接稳定性
- 数据库查询优化验证

## 安全考虑

### 数据安全
- 关联请求需要双方确认
- 数据传输加密
- 敏感信息脱敏
- 访问权限控制

### 防护措施
- 关联请求频率限制
- 用户身份验证
- 数据完整性校验
- 异常操作监控

## 部署考虑

### 数据库迁移
- 新表创建脚本
- 现有表结构修改
- 数据迁移脚本
- 回滚方案

### 向后兼容性
- 现有功能不受影响
- 渐进式功能启用
- 配置开关控制
- 平滑升级路径