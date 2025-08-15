# 命名规范修复计划

## 🎯 修复目标

统一项目中的命名规范，消除前后端数据转换的开销，提升代码可读性和维护性。

## 📋 发现的命名问题

### 1. 常量命名不统一 (应使用 UPPER_SNAKE_CASE)

#### WebSocket相关常量
```javascript
// ❌ 当前命名 (camelCase)
maxReconnectAttempts: 5,
reconnectInterval: 2000,
heartbeatInterval: null,

// ✅ 修复后 (UPPER_SNAKE_CASE)
MAX_RECONNECT_ATTEMPTS: 5,
RECONNECT_INTERVAL: 2000,
HEARTBEAT_INTERVAL: null,
```

#### 其他常量
```javascript
// ❌ 当前命名
const maxWaitTime = 5000;
const maxAttempts = 10;
const maxRetries = 3;
const checkInterval = 500;

// ✅ 修复后
const MAX_WAIT_TIME = 5000;
const MAX_ATTEMPTS = 10;
const MAX_RETRIES = 3;
const CHECK_INTERVAL = 500;
```

### 2. 事件名称不统一 (应使用 UPPER_SNAKE_CASE)

#### 当前事件命名混乱
```javascript
// ❌ 混合使用多种命名方式
'USER_REGISTRATION_RESPONSE'  // ✅ 已经正确
'TODO_SYNC_UPDATE'           // ✅ 已经正确
'NOTES_SYNC_UPDATE'          // ✅ 已经正确
'userChanged'                // ❌ camelCase
'notes-updated'              // ❌ kebab-case
```

### 3. 数据库字段命名转换问题

#### 当前状态：需要大量转换代码
```javascript
// 数据库字段 (snake_case)
user_id, todo_id, created_at, updated_at, is_active, is_completed, 
start_date, end_date, reminder_time, completion_date, display_name,
supervised_user_id, app_user_id

// 前端期望 (camelCase) - 需要转换
userId, todoId, createdAt, updatedAt, isActive, isCompleted,
startDate, endDate, reminderTime, completionDate, displayName,
supervisedUserId, appUserId
```

## 🔧 修复方案

### 阶段1: 统一JavaScript常量命名

#### 1.1 修复 websocketClient.js
```javascript
// 将所有配置常量改为UPPER_SNAKE_CASE
const WebSocketClient = {
    ws: null,
    isConnected: false,
    reconnectAttempts: 0,
    MAX_RECONNECT_ATTEMPTS: 5,        // ✅ 修复
    RECONNECT_INTERVAL: 2000,         // ✅ 修复
    HEARTBEAT_INTERVAL: null,         // ✅ 修复
    RESPONSE_TIMEOUT: 30000,          // ✅ 新增
    messageHandlers: new Map(),
    // ...
};
```

#### 1.2 修复其他文件中的常量
- `todoManager.js`: MAX_WAIT_TIME, MAX_RETRIES
- `notesManager.js`: MAX_WAIT_TIME
- `app.js`: MAX_ATTEMPTS, CHECK_INTERVAL
- `apiClient.js`: MAX_ATTEMPTS

### 阶段2: 统一数据库字段命名策略

#### 方案A: 数据库改为camelCase (推荐)
```sql
-- 重命名数据库字段为camelCase
ALTER TABLE users RENAME COLUMN user_id TO userId;
ALTER TABLE users RENAME COLUMN created_at TO createdAt;
ALTER TABLE users RENAME COLUMN updated_at TO updatedAt;
ALTER TABLE users RENAME COLUMN display_name TO displayName;
ALTER TABLE users RENAME COLUMN app_user_id TO appUserId;
ALTER TABLE users RENAME COLUMN supervised_user_id TO supervisedUserId;

ALTER TABLE todos RENAME COLUMN todo_id TO todoId;
ALTER TABLE todos RENAME COLUMN user_id TO userId;
ALTER TABLE todos RENAME COLUMN created_at TO createdAt;
ALTER TABLE todos RENAME COLUMN updated_at TO updatedAt;
ALTER TABLE todos RENAME COLUMN is_active TO isActive;
ALTER TABLE todos RENAME COLUMN is_completed TO isCompleted;
ALTER TABLE todos RENAME COLUMN start_date TO startDate;
ALTER TABLE todos RENAME COLUMN end_date TO endDate;
ALTER TABLE todos RENAME COLUMN reminder_time TO reminderTime;
ALTER TABLE todos RENAME COLUMN completion_date TO completionDate;
ALTER TABLE todos RENAME COLUMN app_user_id TO appUserId;
ALTER TABLE todos RENAME COLUMN supervised_user_id TO supervisedUserId;

-- 类似地修改其他表...
```

#### 方案B: 前端改为snake_case (不推荐)
这会让JavaScript代码看起来不自然，不建议采用。

### 阶段3: 清理字段转换代码

修复后可以删除大量的字段转换代码：
```javascript
// ❌ 当前需要的转换代码
const convertToDatabase = (obj) => {
    return {
        user_id: obj.userId,
        created_at: obj.createdAt,
        updated_at: obj.updatedAt,
        // ... 更多转换
    };
};

// ✅ 修复后直接使用，无需转换
const saveUser = (userData) => {
    return query('INSERT INTO users SET ?', userData);
};
```

## 📝 具体修复步骤

### Step 1: 修复JavaScript常量命名

1. **websocketClient.js**
   - maxReconnectAttempts → MAX_RECONNECT_ATTEMPTS
   - reconnectInterval → RECONNECT_INTERVAL
   - heartbeatInterval → HEARTBEAT_INTERVAL

2. **todoManager.js**
   - maxWaitTime → MAX_WAIT_TIME
   - maxRetries → MAX_RETRIES

3. **notesManager.js**
   - maxWaitTime → MAX_WAIT_TIME

4. **app.js**
   - maxAttempts → MAX_ATTEMPTS
   - checkInterval → CHECK_INTERVAL

5. **apiClient.js**
   - maxAttempts → MAX_ATTEMPTS

### Step 2: 数据库字段重命名

创建数据库迁移脚本：
```sql
-- migration_001_rename_fields_to_camelcase.sql
-- 用户表
ALTER TABLE users RENAME COLUMN app_user_id TO appUserId;
ALTER TABLE users RENAME COLUMN display_name TO displayName;
ALTER TABLE users RENAME COLUMN device_id TO deviceId;
ALTER TABLE users RENAME COLUMN created_at TO createdAt;
ALTER TABLE users RENAME COLUMN updated_at TO updatedAt;

-- TODO表
ALTER TABLE todos RENAME COLUMN app_user_id TO appUserId;
ALTER TABLE todos RENAME COLUMN supervised_user_id TO supervisedUserId;
ALTER TABLE todos RENAME COLUMN is_active TO isActive;
ALTER TABLE todos RENAME COLUMN start_date TO startDate;
ALTER TABLE todos RENAME COLUMN end_date TO endDate;
ALTER TABLE todos RENAME COLUMN reminder_time TO reminderTime;
ALTER TABLE todos RENAME COLUMN sort_order TO sortOrder;
ALTER TABLE todos RENAME COLUMN created_at TO createdAt;
ALTER TABLE todos RENAME COLUMN updated_at TO updatedAt;

-- TODO完成记录表
ALTER TABLE todo_completions RENAME COLUMN todo_id TO todoId;
ALTER TABLE todo_completions RENAME COLUMN completion_date TO completionDate;
ALTER TABLE todo_completions RENAME COLUMN created_at TO createdAt;

-- 笔记表
ALTER TABLE notes RENAME COLUMN app_user_id TO appUserId;
ALTER TABLE notes RENAME COLUMN supervised_user_id TO supervisedUserId;
ALTER TABLE notes RENAME COLUMN created_at TO createdAt;
ALTER TABLE notes RENAME COLUMN updated_at TO updatedAt;

-- 用户关联表
ALTER TABLE user_links RENAME COLUMN manager_app_user TO managerAppUser;
ALTER TABLE user_links RENAME COLUMN supervised_user_id TO supervisedUserId;
ALTER TABLE user_links RENAME COLUMN created_at TO createdAt;
ALTER TABLE user_links RENAME COLUMN updated_at TO updatedAt;

-- 关联请求表
ALTER TABLE link_requests RENAME COLUMN from_app_user TO fromAppUser;
ALTER TABLE link_requests RENAME COLUMN to_app_user TO toAppUser;
ALTER TABLE link_requests RENAME COLUMN supervised_user_id TO supervisedUserId;
ALTER TABLE link_requests RENAME COLUMN supervised_user_name TO supervisedUserName;
ALTER TABLE link_requests RENAME COLUMN expires_at TO expiresAt;
ALTER TABLE link_requests RENAME COLUMN created_at TO createdAt;
ALTER TABLE link_requests RENAME COLUMN updated_at TO updatedAt;

-- 应用用户表
ALTER TABLE app_users RENAME COLUMN created_at TO createdAt;
ALTER TABLE app_users RENAME COLUMN updated_at TO updatedAt;
```

### Step 3: 更新所有SQL查询

更新所有后端文件中的SQL查询，使用新的字段名。

### Step 4: 清理转换代码

删除所有字段名转换相关的代码。

## ⚠️ 注意事项

1. **数据备份**: 执行数据库迁移前必须备份数据
2. **测试验证**: 每个步骤后都要进行功能测试
3. **分步执行**: 不要一次性修改所有文件，分模块逐步修复
4. **版本控制**: 每个修复步骤都要提交到版本控制

## 🎯 预期收益

1. **性能提升**: 消除字段转换开销，提升数据处理速度
2. **代码简化**: 删除大量转换代码，减少代码量15-20%
3. **维护性提升**: 统一命名规范，降低认知负担
4. **开发效率**: 减少命名相关的bug和困惑
5. **团队协作**: 统一的代码风格，提升团队协作效率

## 📅 预计时间

- **Step 1** (JS常量): 2-3小时
- **Step 2** (数据库迁移): 1-2小时
- **Step 3** (SQL查询更新): 4-6小时
- **Step 4** (清理转换代码): 2-3小时
- **测试验证**: 2-3小时

**总计**: 11-17小时 (约2-3个工作日)