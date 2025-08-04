// TODO数据库初始化脚本 - 完全重写版本
const fs = require('fs').promises;
const path = require('path');
const { query, testConnection } = require('../config/sqlite');

async function initTodoDatabase() {
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
        
        console.log('📄 删除旧表并创建新表...');
        
        // 删除旧表（如果存在）
        await query('DROP TABLE IF EXISTS todo_completions');
        await query('DROP TABLE IF EXISTS todos');
        await query('DROP TABLE IF EXISTS repeat_patterns');
        await query('DROP TABLE IF EXISTS user_settings');
        await query('DROP TABLE IF EXISTS users');
        
        // 创建用户表
        await query(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                email TEXT UNIQUE,
                phone TEXT,
                gender TEXT CHECK(gender IN ('male', 'female', 'other')),
                birthday DATE,
                avatar_color TEXT DEFAULT '#1d9bf0',
                timezone TEXT DEFAULT 'Asia/Shanghai',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        `);
        
        // 创建TODO表 - 包含end_date字段
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
                is_active BOOLEAN DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // 创建TODO完成记录表
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
        
        // 创建用户设置表
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
        
        console.log('📊 跳过示例数据插入，创建干净的数据库...');
        
        // 验证数据
        const users = await query('SELECT COUNT(*) as count FROM users');
        const todos = await query('SELECT COUNT(*) as count FROM todos');
        
        console.log('📈 数据统计:');
        console.log(`  - 用户: ${users[0].count} 条`);
        console.log(`  - TODO: ${todos[0].count} 条`);
        
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