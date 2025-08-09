# Link功能数据库架构文档

## 概述

Link功能为WENTING1.0应用添加了用户关联功能，允许已注册的app_users与被监管用户建立关联关系，实现数据同步。

## 新增表结构

### 1. user_links表 - 用户关联关系

存储已建立的用户关联关系。

```sql
CREATE TABLE user_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_app_user TEXT NOT NULL,           -- 管理员的app_user用户名
    linked_app_user TEXT NOT NULL,            -- 被关联的app_user用户名
    supervised_user_id INTEGER NOT NULL,      -- 被监管用户ID
    status TEXT DEFAULT 'active' CHECK(status IN ('pending', 'active', 'rejected', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_app_user) REFERENCES app_users(username) ON DELETE CASCADE,
    FOREIGN KEY (linked_app_user) REFERENCES app_users(username) ON DELETE CASCADE,
    FOREIGN KEY (supervised_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(manager_app_user, linked_app_user, supervised_user_id)
);
```

**字段说明：**
- `manager_app_user`: 发起关联的管理员用户名
- `linked_app_user`: 被关联的目标用户名
- `supervised_user_id`: 被监管用户的ID
- `status`: 关联状态（active=活跃, cancelled=已取消）

### 2. link_requests表 - 关联请求

存储关联请求的历史记录。

```sql
CREATE TABLE link_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_app_user TEXT NOT NULL,              -- 发起请求的用户
    to_app_user TEXT NOT NULL,                -- 接收请求的用户
    supervised_user_id INTEGER NOT NULL,      -- 被监管用户ID
    supervised_user_name TEXT NOT NULL,       -- 被监管用户名称（用于显示）
    message TEXT DEFAULT '',                  -- 请求消息
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'expired')),
    expires_at DATETIME DEFAULT (datetime('now', '+7 days')), -- 7天后过期
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_app_user) REFERENCES app_users(username) ON DELETE CASCADE,
    FOREIGN KEY (to_app_user) REFERENCES app_users(username) ON DELETE CASCADE,
    FOREIGN KEY (supervised_user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**字段说明：**
- `from_app_user`: 发起请求的用户名
- `to_app_user`: 接收请求的用户名
- `supervised_user_name`: 被监管用户的显示名称
- `message`: 可选的请求消息
- `expires_at`: 请求过期时间（默认7天）

## 修改的表结构

### users表 - 添加关联字段

为现有的users表添加了两个新字段：

```sql
ALTER TABLE users ADD COLUMN supervised_app_user TEXT;  -- 关联的app_user用户名
ALTER TABLE users ADD COLUMN is_linked BOOLEAN DEFAULT FALSE;  -- 是否已关联
```

**新字段说明：**
- `supervised_app_user`: 当前被监管用户关联到的app_user用户名
- `is_linked`: 标识该被监管用户是否已建立关联关系

## 索引

为了优化查询性能，创建了以下索引：

```sql
-- user_links表索引
CREATE INDEX idx_user_links_manager ON user_links(manager_app_user, status);
CREATE INDEX idx_user_links_linked ON user_links(linked_app_user, status);
CREATE INDEX idx_user_links_supervised ON user_links(supervised_user_id);

-- link_requests表索引
CREATE INDEX idx_link_requests_to_user ON link_requests(to_app_user, status);
CREATE INDEX idx_link_requests_from_user ON link_requests(from_app_user, status);
CREATE INDEX idx_link_requests_expires ON link_requests(expires_at, status);

-- users表关联字段索引
CREATE INDEX idx_users_supervised_app_user ON users(supervised_app_user);
CREATE INDEX idx_users_is_linked ON users(is_linked);
```

## 数据关系

```
app_users (注册用户)
    ↓ (1:N)
users (被监管用户)
    ↓ (1:N)
user_links (关联关系)
    ↑ (N:1)
app_users (目标用户)

link_requests (关联请求)
    ↑ (N:1)
app_users (发起用户)
    ↑ (N:1)  
app_users (目标用户)
    ↑ (N:1)
users (被监管用户)
```

## 使用场景

1. **发起关联请求**：管理员选择被监管用户，输入目标用户名，创建link_requests记录
2. **处理关联请求**：目标用户接受请求后，创建user_links记录，更新users表的关联字段
3. **查询关联关系**：通过user_links表查询用户的所有关联关系
4. **数据同步**：基于user_links表确定需要同步数据的用户对

## 迁移脚本

- **迁移脚本**: `backend/scripts/migrate-link-tables.js`
- **回滚脚本**: `backend/scripts/migrate-link-tables.js rollback`
- **测试脚本**: `backend/scripts/test-link-tables.js`

## 注意事项

1. 外键约束确保数据完整性
2. 唯一约束防止重复关联
3. 请求过期机制避免长期未处理的请求
4. 级联删除确保数据一致性
5. SQLite不支持DROP COLUMN，回滚时无法删除添加的字段