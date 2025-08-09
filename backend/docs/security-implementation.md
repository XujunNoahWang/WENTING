# 安全实现文档

## 概述

本文档描述了用户关联功能的安全实现，包括权限验证、频率限制、数据访问控制和安全审计等功能。

## 安全组件

### 1. LinkSecurity 中间件 (`backend/middleware/linkSecurity.js`)

#### 功能
- 用户权限验证
- 关联请求频率限制
- 关联请求权限验证
- 关联关系权限验证
- 输入数据验证
- IP地址频率限制

#### 主要方法
- `validateUserPermission()` - 验证用户对被监管用户的操作权限
- `rateLimitLinkRequests()` - 限制用户关联请求频率（每小时5次）
- `ipRateLimit()` - 限制IP请求频率（每10分钟20次）
- `validateLinkRequestData()` - 验证关联请求输入数据
- `validateLinkRequestPermission()` - 验证关联请求处理权限
- `validateLinkPermission()` - 验证关联关系操作权限

#### 安全规则
- 用户名格式：只允许小写字母和数字，长度1-10字符
- 消息长度限制：最多200字符
- 防止自关联：不允许用户关联自己
- 请求过期检查：自动检查关联请求是否过期

### 2. DataAccessSecurity 中间件 (`backend/middleware/dataAccess.js`)

#### 功能
- 数据访问权限验证
- TODO操作权限验证
- 笔记操作权限验证
- 用户设置访问权限验证
- 数据创建权限验证

#### 主要方法
- `validateDataAccess()` - 验证用户对被监管用户数据的访问权限
- `validateTodoAccess()` - 验证TODO操作权限
- `validateNoteAccess()` - 验证笔记操作权限
- `validateUserSettingsAccess()` - 验证用户设置访问权限
- `validateCreateDataAccess()` - 验证数据创建权限

#### 权限验证逻辑
- 检查用户是否为被监管用户的管理员
- 检查用户是否与被监管用户建立了有效关联
- 验证关联关系状态为活跃状态
- 记录所有数据访问事件

### 3. SecurityAudit 中间件 (`backend/middleware/securityAudit.js`)

#### 功能
- 安全事件记录
- 权限拒绝日志
- 频率限制日志
- 可疑活动检测
- 安全统计分析

#### 主要方法
- `logSecurityEvent()` - 记录安全事件到数据库和控制台
- `logPermissionDenied()` - 记录权限拒绝事件
- `logRateLimitExceeded()` - 记录频率限制事件
- `logLinkOperation()` - 记录关联操作事件
- `logDataAccess()` - 记录数据访问事件
- `detectSuspiciousActivity()` - 检测可疑活动
- `getSecurityStats()` - 获取安全统计信息

#### 可疑活动检测阈值
- 权限拒绝：1小时内10次以上
- 认证失败：1小时内5次以上
- 关联操作：1小时内20次以上

## 数据库安全

### 安全日志表 (`security_logs`)

```sql
CREATE TABLE security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    details TEXT,
    client_ip TEXT,
    user_agent TEXT,
    app_user TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 索引
- `idx_security_logs_event_type` - 事件类型索引
- `idx_security_logs_created_at` - 创建时间索引
- `idx_security_logs_app_user` - 用户索引
- `idx_security_logs_client_ip` - IP地址索引

## API路由安全

### Link路由安全 (`backend/routes/links.js`)

#### 应用的中间件
- `SecurityAudit.logPermissionDenied` - 记录权限拒绝
- `SecurityAudit.logRateLimitExceeded` - 记录频率限制
- `LinkSecurity.ipRateLimit` - IP频率限制
- `LinkSecurity.validateLinkRequestData` - 输入数据验证
- `LinkSecurity.validateUserPermission` - 用户权限验证
- `LinkSecurity.rateLimitLinkRequests` - 用户频率限制
- `LinkSecurity.validateLinkRequestPermission` - 请求权限验证
- `LinkSecurity.validateLinkPermission` - 关联权限验证

### TODO路由安全 (`backend/routes/todos.js`)

#### 应用的中间件
- `SecurityAudit.logPermissionDenied` - 记录权限拒绝
- `SecurityAudit.logRateLimitExceeded` - 记录频率限制
- `DataAccessSecurity.validateDataAccess` - 数据访问权限验证
- `DataAccessSecurity.validateTodoAccess` - TODO操作权限验证
- `DataAccessSecurity.validateCreateDataAccess` - 数据创建权限验证

## 安全管理API (`backend/routes/security.js`)

### 端点
- `GET /security/stats/:timeRange?` - 获取安全统计信息
- `GET /security/suspicious-activity` - 检测可疑活动
- `POST /security/cleanup-rate-limits` - 清理频率限制记录
- `GET /security/config` - 获取安全配置
- `POST /security/log-event` - 手动记录安全事件
- `GET /security/health` - 安全系统健康检查

## 安全配置

### 频率限制
- **用户关联请求**：每小时最多5次
- **IP请求**：每10分钟最多20次
- **清理周期**：每小时自动清理过期记录

### 输入验证
- **用户名格式**：`^[a-z0-9]{1,10}$`
- **消息最大长度**：200字符
- **防止自关联**：启用

### 审计配置
- **日志保留期**：30天（建议）
- **记录所有事件**：启用
- **可疑活动阈值**：
  - 权限拒绝：10次/小时
  - 认证失败：5次/小时
  - 关联操作：20次/小时

## 安全事件类型

### 系统事件
- `SYSTEM_INIT` - 系统初始化
- `PERMISSION_DENIED` - 权限拒绝
- `RATE_LIMIT_EXCEEDED` - 频率限制超出
- `AUTH_FAILURE` - 认证失败

### 关联事件
- `LINK_OPERATION` - 关联操作
- `LINK_REQUEST_CREATED` - 关联请求创建
- `LINK_REQUEST_ACCEPTED` - 关联请求接受
- `LINK_REQUEST_REJECTED` - 关联请求拒绝
- `LINK_CANCELLED` - 关联取消

### 数据访问事件
- `DATA_ACCESS` - 数据访问
- `TODO_ACCESS` - TODO访问
- `NOTE_ACCESS` - 笔记访问
- `CREATE_PERMISSION` - 创建权限验证

## 测试和验证

### 测试脚本
- `backend/scripts/test-security-implementation.js` - 安全实现测试
- `backend/scripts/create-security-logs-table.js` - 安全日志表创建

### 测试覆盖
- ✅ 用户名格式验证
- ✅ 权限验证逻辑
- ✅ 安全事件记录
- ✅ 频率限制机制
- ✅ 安全统计功能
- ✅ 可疑活动检测
- ✅ 数据访问权限

## 最佳实践

### 部署建议
1. 定期监控安全日志
2. 设置可疑活动告警
3. 定期清理过期日志
4. 监控系统性能影响
5. 定期更新安全配置

### 监控指标
- 权限拒绝频率
- 频率限制触发次数
- 可疑活动检测结果
- 系统响应时间
- 数据库查询性能

### 故障排除
- 检查安全日志表是否存在
- 验证中间件加载顺序
- 检查数据库连接状态
- 监控内存使用情况
- 验证索引性能

## 安全更新日志

### v1.0.0 (2025-08-09)
- ✅ 实现基础权限验证系统
- ✅ 添加频率限制机制
- ✅ 实现安全审计日志
- ✅ 创建数据访问权限控制
- ✅ 添加可疑活动检测
- ✅ 实现安全管理API
- ✅ 创建安全测试套件

## 联系信息

如有安全相关问题或建议，请联系开发团队。