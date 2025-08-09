// TODO数据库初始化脚本 - 完全重写版本
const fs = require('fs').promises;
const path = require('path');
const { query, testConnection } = require('../config/sqlite');

// 创建注册用户表（应用的实际用户）
async function createAppUsersTable() {
    await query(`
        CREATE TABLE app_users (
            username VARCHAR(10) PRIMARY KEY,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT username_format CHECK (
                username GLOB '[a-z0-9]*' AND
                length(username) <= 10 AND
                length(username) > 0
            )
        )
    `);
}

// 创建被添加用户表（注册用户管理的用户）
async function createUsersTable() {
    await query(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_user_id VARCHAR(10) NOT NULL,
            username TEXT NOT NULL,
            display_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            gender TEXT CHECK(gender IN ('male', 'female', 'other')),
            birthday DATE,
            avatar_color TEXT DEFAULT '#1d9bf0',
            timezone TEXT DEFAULT 'Asia/Shanghai',
            device_id TEXT NOT NULL,
            supervised_app_user TEXT,                 -- 关联的app_user用户名
            is_linked BOOLEAN DEFAULT FALSE,          -- 是否已关联
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (app_user_id) REFERENCES app_users(username) ON DELETE CASCADE,
            UNIQUE(username, device_id, app_user_id)
        )
    `);
}

// 创建TODO表
async function createTodosTable() {
    await query(`
        CREATE TABLE todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            reminder_time TEXT DEFAULT 'all_day',
            priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
            repeat_type TEXT DEFAULT 'none' CHECK(repeat_type IN ('none', 'daily', 'every_other_day', 'weekly', 'monthly', 'yearly', 'custom')),
            repeat_interval INTEGER DEFAULT 1,
            start_date DATE NOT NULL DEFAULT (date('now')),
            end_date DATE DEFAULT NULL,
            cycle_type TEXT DEFAULT 'long_term' CHECK(cycle_type IN ('long_term', 'custom')),
            cycle_duration INTEGER DEFAULT NULL,
            cycle_unit TEXT DEFAULT 'days' CHECK(cycle_unit IN ('days', 'weeks', 'months')),
            is_active BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
}

// 创建Notes表
async function createNotesTable() {
    await query(`
        CREATE TABLE notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            precautions TEXT DEFAULT '',
            ai_suggestions TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
}

// 创建TODO完成记录表
async function createTodoCompletionsTable() {
    await query(`
        CREATE TABLE todo_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            todo_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            completion_date DATE NOT NULL,
            completion_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT DEFAULT '',
            FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(todo_id, completion_date)
        )
    `);
}

// 创建TODO删除记录表
async function createTodoDeletionsTable() {
    await query(`
        CREATE TABLE todo_deletions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            todo_id INTEGER NOT NULL,
            deletion_date DATE NOT NULL,
            deletion_type TEXT DEFAULT 'single' CHECK(deletion_type IN ('single', 'from_date')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
            UNIQUE(todo_id, deletion_date)
        )
    `);
}

// 创建用户设置表
async function createUserSettingsTable() {
    await query(`
        CREATE TABLE user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            notification_enabled BOOLEAN DEFAULT 1,
            theme TEXT DEFAULT 'light',
            language TEXT DEFAULT 'zh-CN',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
}

// 创建用户关联关系表
async function createUserLinksTable() {
    await query(`
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
        )
    `);
}

// 创建关联请求表
async function createLinkRequestsTable() {
    await query(`
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
        )
    `);
}

async function initTodoDatabase(preserveData = false) {
    try {
        console.log('🔄 开始初始化TODO数据库...');
        
        // 确保data目录存在
        const dataDir = path.join(__dirname, '../data');
        try {
            await fs.mkdir(dataDir, { recursive: true });
        } catch (err) {
            // 目录已存在，忽略错误
        }
        
        // 测试连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        if (preserveData) {
            console.log('🔄 检查并创建缺失的表...');
            
            // 检查表是否存在，不存在才创建
            const checkTableExists = async (tableName) => {
                const result = await query("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName]);
                return result.length > 0;
            };
            
            const appUsersExists = await checkTableExists('app_users');
            if (!appUsersExists) {
                console.log('📄 创建 app_users 表...');
                await createAppUsersTable();
            }
            
            const usersExists = await checkTableExists('users');
            if (!usersExists) {
                console.log('📄 创建 users 表...');
                await createUsersTable();
            }
            
            const todosExists = await checkTableExists('todos');
            if (!todosExists) {
                console.log('📄 创建 todos 表...');
                await createTodosTable();
            }
            
            const notesExists = await checkTableExists('notes');
            if (!notesExists) {
                console.log('📄 创建 notes 表...');
                await createNotesTable();
            }
            
            const completionsExists = await checkTableExists('todo_completions');
            if (!completionsExists) {
                console.log('📄 创建 todo_completions 表...');
                await createTodoCompletionsTable();
            }
            
            const deletionsExists = await checkTableExists('todo_deletions');
            if (!deletionsExists) {
                console.log('📄 创建 todo_deletions 表...');
                await createTodoDeletionsTable();
            }
            
            const settingsExists = await checkTableExists('user_settings');
            if (!settingsExists) {
                console.log('📄 创建 user_settings 表...');
                await createUserSettingsTable();
            }
            
            const userLinksExists = await checkTableExists('user_links');
            if (!userLinksExists) {
                console.log('📄 创建 user_links 表...');
                await createUserLinksTable();
            }
            
            const linkRequestsExists = await checkTableExists('link_requests');
            if (!linkRequestsExists) {
                console.log('📄 创建 link_requests 表...');
                await createLinkRequestsTable();
            }
            
        } else {
            console.log('📄 删除旧表并创建新表...');
            
            // 删除旧表（如果存在）- 注意删除顺序，先删除依赖表
            await query('DROP TABLE IF EXISTS link_requests');
            await query('DROP TABLE IF EXISTS user_links');
            await query('DROP TABLE IF EXISTS todo_deletions');
            await query('DROP TABLE IF EXISTS todo_completions');
            await query('DROP TABLE IF EXISTS todos');
            await query('DROP TABLE IF EXISTS notes');
            await query('DROP TABLE IF EXISTS user_settings');
            await query('DROP TABLE IF EXISTS users');
            await query('DROP TABLE IF EXISTS repeat_patterns');
            await query('DROP TABLE IF EXISTS app_users');
            
            // 创建所有表 - 注意创建顺序，先创建被引用的表
            await createAppUsersTable();
            await createUsersTable();
            await createTodosTable();
            await createNotesTable();
            await createTodoCompletionsTable();
            await createTodoDeletionsTable();
            await createUserSettingsTable();
            await createUserLinksTable();
            await createLinkRequestsTable();
        }
        
        // 创建优化性能的索引
        console.log('🔍 创建数据库索引...');
        
        // 注册用户索引
        await query('CREATE INDEX idx_app_users_created ON app_users(created_at)');
        
        // 被添加用户查询优化索引
        await query('CREATE INDEX idx_users_app_user ON users(app_user_id, is_active)');
        await query('CREATE INDEX idx_users_username_device ON users(username, device_id, app_user_id)');
        await query('CREATE INDEX idx_users_active ON users(is_active)');
        
        // TODO查询优化索引 - 针对日期查询优化
        await query('CREATE INDEX idx_todos_user_date ON todos(user_id, start_date, is_active)');
        await query('CREATE INDEX idx_todos_user_active ON todos(user_id, is_active)');
        await query('CREATE INDEX idx_todos_date_range ON todos(start_date, end_date, is_active)');
        await query('CREATE INDEX idx_todos_repeat ON todos(repeat_type, is_active)');
        
        // TODO完成记录优化索引
        await query('CREATE INDEX idx_completions_todo_date ON todo_completions(todo_id, completion_date)');
        await query('CREATE INDEX idx_completions_user_date ON todo_completions(user_id, completion_date)');
        
        // TODO删除记录优化索引  
        await query('CREATE INDEX idx_deletions_todo_date ON todo_deletions(todo_id, deletion_date)');
        
        // Notes查询优化索引
        await query('CREATE INDEX idx_notes_user ON notes(user_id)');
        
        // Link功能索引
        await query('CREATE INDEX idx_user_links_manager ON user_links(manager_app_user, status)');
        await query('CREATE INDEX idx_user_links_linked ON user_links(linked_app_user, status)');
        await query('CREATE INDEX idx_user_links_supervised ON user_links(supervised_user_id)');
        await query('CREATE INDEX idx_link_requests_to_user ON link_requests(to_app_user, status)');
        await query('CREATE INDEX idx_link_requests_from_user ON link_requests(from_app_user, status)');
        await query('CREATE INDEX idx_link_requests_expires ON link_requests(expires_at, status)');
        await query('CREATE INDEX idx_users_supervised_app_user ON users(supervised_app_user)');
        await query('CREATE INDEX idx_users_is_linked ON users(is_linked)');
        
        console.log('✅ 数据库索引创建完成');
        console.log('📊 跳过示例数据插入，创建干净的数据库...');
        
        // 验证数据
        const appUsers = await query('SELECT COUNT(*) as count FROM app_users');
        const users = await query('SELECT COUNT(*) as count FROM users');
        const todos = await query('SELECT COUNT(*) as count FROM todos');
        const notes = await query('SELECT COUNT(*) as count FROM notes');
        const userLinks = await query('SELECT COUNT(*) as count FROM user_links');
        const linkRequests = await query('SELECT COUNT(*) as count FROM link_requests');
        
        console.log('📈 数据统计:');
        console.log(`  - 注册用户: ${appUsers[0].count} 条`);
        console.log(`  - 被添加用户: ${users[0].count} 条`);
        console.log(`  - TODO: ${todos[0].count} 条`);
        console.log(`  - Notes: ${notes[0].count} 条`);
        console.log(`  - 用户关联: ${userLinks[0].count} 条`);
        console.log(`  - 关联请求: ${linkRequests[0].count} 条`);
        
        console.log('🎉 TODO数据库初始化完成！');
        
    } catch (error) {
        console.error('❌ TODO数据库初始化失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    initTodoDatabase().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { initTodoDatabase };