// Link功能数据库迁移脚本
const { query, testConnection } = require('../config/sqlite');

// 创建用户关联关系表
async function createUserLinksTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS user_links (
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
        )
    `);
    console.log('✅ 创建 user_links 表');
}

// 创建关联请求表
async function createLinkRequestsTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS link_requests (
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
        )
    `);
    console.log('✅ 创建 link_requests 表');
}

// 为users表添加关联字段
async function addLinkFieldsToUsersTable() {
    try {
        // 检查字段是否已存在 - 使用更安全的方法
        try {
            await query(`SELECT supervised_app_user FROM users LIMIT 1`);
            console.log('ℹ️  users 表已存在 supervised_app_user 字段');
        } catch (error) {
            // 字段不存在，添加它
            await query(`ALTER TABLE users ADD COLUMN supervised_app_user TEXT`);
            console.log('✅ 为 users 表添加 supervised_app_user 字段');
        }
        
        try {
            await query(`SELECT is_linked FROM users LIMIT 1`);
            console.log('ℹ️  users 表已存在 is_linked 字段');
        } catch (error) {
            // 字段不存在，添加它
            await query(`ALTER TABLE users ADD COLUMN is_linked BOOLEAN DEFAULT FALSE`);
            console.log('✅ 为 users 表添加 is_linked 字段');
        }
    } catch (error) {
        console.error('❌ 添加字段失败:', error);
        throw error;
    }
}

// 创建Link功能相关的索引
async function createLinkIndexes() {
    try {
        // user_links表索引
        await query('CREATE INDEX IF NOT EXISTS idx_user_links_manager ON user_links(manager_app_user, status)');
        await query('CREATE INDEX IF NOT EXISTS idx_user_links_linked ON user_links(linked_app_user, status)');
        await query('CREATE INDEX IF NOT EXISTS idx_user_links_supervised ON user_links(supervised_user_id)');
        
        // link_requests表索引
        await query('CREATE INDEX IF NOT EXISTS idx_link_requests_to_user ON link_requests(to_app_user, status)');
        await query('CREATE INDEX IF NOT EXISTS idx_link_requests_from_user ON link_requests(from_app_user, status)');
        await query('CREATE INDEX IF NOT EXISTS idx_link_requests_expires ON link_requests(expires_at, status)');
        
        // users表关联字段索引 - 只有在字段存在时才创建
        try {
            await query('CREATE INDEX IF NOT EXISTS idx_users_supervised_app_user ON users(supervised_app_user)');
        } catch (error) {
            console.log('⚠️  跳过 supervised_app_user 索引创建');
        }
        
        try {
            await query('CREATE INDEX IF NOT EXISTS idx_users_is_linked ON users(is_linked)');
        } catch (error) {
            console.log('⚠️  跳过 is_linked 索引创建');
        }
        
        console.log('✅ 创建Link功能索引');
    } catch (error) {
        console.error('❌ 创建索引失败:', error);
        throw error;
    }
}

// 主迁移函数
async function migrateLinkTables() {
    try {
        console.log('🔄 开始Link功能数据库迁移...');
        
        // 测试连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 创建新表
        await createUserLinksTable();
        await createLinkRequestsTable();
        
        // 修改现有表
        await addLinkFieldsToUsersTable();
        
        // 创建索引
        await createLinkIndexes();
        
        // 验证迁移结果
        const userLinksCount = await query('SELECT COUNT(*) as count FROM user_links');
        const linkRequestsCount = await query('SELECT COUNT(*) as count FROM link_requests');
        
        console.log('📈 迁移统计:');
        console.log(`  - user_links 表: ${userLinksCount[0].count} 条记录`);
        console.log(`  - link_requests 表: ${linkRequestsCount[0].count} 条记录`);
        
        console.log('🎉 Link功能数据库迁移完成！');
        
    } catch (error) {
        console.error('❌ Link功能数据库迁移失败:', error);
        throw error;
    }
}

// 回滚函数（用于开发测试）
async function rollbackLinkTables() {
    try {
        console.log('🔄 开始回滚Link功能数据库更改...');
        
        // 删除索引
        await query('DROP INDEX IF EXISTS idx_user_links_manager');
        await query('DROP INDEX IF EXISTS idx_user_links_linked');
        await query('DROP INDEX IF EXISTS idx_user_links_supervised');
        await query('DROP INDEX IF EXISTS idx_link_requests_to_user');
        await query('DROP INDEX IF EXISTS idx_link_requests_from_user');
        await query('DROP INDEX IF EXISTS idx_link_requests_expires');
        await query('DROP INDEX IF EXISTS idx_users_supervised_app_user');
        await query('DROP INDEX IF EXISTS idx_users_is_linked');
        
        // 删除表
        await query('DROP TABLE IF EXISTS link_requests');
        await query('DROP TABLE IF EXISTS user_links');
        
        // 注意：SQLite不支持DROP COLUMN，所以无法删除添加的字段
        // 如果需要完全回滚，需要重建整个users表
        
        console.log('🎉 Link功能数据库回滚完成！');
        console.log('⚠️  注意：users表的新字段无法删除（SQLite限制）');
        
    } catch (error) {
        console.error('❌ Link功能数据库回滚失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'rollback') {
        rollbackLinkTables().then(() => {
            process.exit(0);
        }).catch(error => {
            console.error(error);
            process.exit(1);
        });
    } else {
        migrateLinkTables().then(() => {
            process.exit(0);
        }).catch(error => {
            console.error(error);
            process.exit(1);
        });
    }
}

module.exports = { migrateLinkTables, rollbackLinkTables };