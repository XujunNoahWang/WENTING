// SQLite数据库初始化脚本
const fs = require('fs').promises;
const path = require('path');
const { query, testConnection } = require('../config/sqlite');

async function initSQLiteDatabase() {
    try {
        console.log('🔄 开始初始化SQLite数据库...');
        
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
        
        console.log('📄 创建数据表...');
        
        // 创建用户表
        await query(`
            CREATE TABLE IF NOT EXISTS users (
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
        
        // 创建重复模式表
        await query(`
            CREATE TABLE IF NOT EXISTS repeat_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_type TEXT NOT NULL DEFAULT 'none' CHECK(pattern_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
                interval_value INTEGER DEFAULT 1,
                days_of_week TEXT,
                days_of_month TEXT,
                end_type TEXT DEFAULT 'never' CHECK(end_type IN ('never', 'after', 'on_date')),
                end_after_count INTEGER,
                end_date DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 创建TODO表
        await query(`
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                reminder_time TIME,
                reminder_type TEXT DEFAULT 'all_day' CHECK(reminder_type IN ('specific_time', 'all_day', 'before_meal', 'after_meal')),
                priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
                category TEXT,
                repeat_pattern_id INTEGER,
                start_date DATE NOT NULL,
                due_date DATE,
                estimated_duration INTEGER,
                emoji TEXT,
                color TEXT,
                is_template BOOLEAN DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (repeat_pattern_id) REFERENCES repeat_patterns(id) ON DELETE SET NULL
            )
        `);
        
        // 创建TODO完成记录表
        await query(`
            CREATE TABLE IF NOT EXISTS todo_completions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                todo_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                completion_date DATE NOT NULL,
                completion_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                mood TEXT CHECK(mood IN ('great', 'good', 'okay', 'bad')),
                FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(todo_id, completion_date)
            )
        `);
        
        // 创建用户设置表
        await query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                notification_enabled BOOLEAN DEFAULT 1,
                notification_time_advance INTEGER DEFAULT 10,
                theme TEXT DEFAULT 'light',
                language TEXT DEFAULT 'zh-CN',
                week_start_day INTEGER DEFAULT 1,
                settings_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        console.log('📊 插入示例数据...');
        
        // 检查是否已有用户数据
        const existingUsers = await query('SELECT COUNT(*) as count FROM users');
        if (existingUsers[0].count === 0) {
            // 插入示例用户
            await query(`
                INSERT INTO users (username, display_name, email, phone, gender, birthday, avatar_color) VALUES
                ('dad', 'Dad', 'dad@example.com', '13800138001', 'male', '1980-05-15', '#1d9bf0'),
                ('mom', 'Mom', 'mom@example.com', '13800138002', 'female', '1985-08-20', '#e91e63'),
                ('kid', 'Kid', 'kid@example.com', NULL, 'other', '2010-12-10', '#ff9800')
            `);
            
            // 插入重复模式
            await query(`
                INSERT INTO repeat_patterns (pattern_type, interval_value, end_type) VALUES
                ('daily', 1, 'never'),
                ('weekly', 1, 'never'),
                ('none', 1, 'never')
            `);
            
            // 插入示例TODO
            await query(`
                INSERT INTO todos (user_id, title, description, reminder_time, reminder_type, repeat_pattern_id, start_date, emoji) VALUES
                (1, '早上吃鱼肝油', '帮助降低肌酐，分多次饮用', '08:00', 'specific_time', 1, date('now'), '🐟'),
                (1, '吃一粒善存', '', '09:00', 'specific_time', 1, date('now'), '💊'),
                (2, '进行10分钟冥想', '可以使用冥想app引导', '07:00', 'specific_time', 1, date('now'), '🧘‍♀️'),
                (3, '吃维生素D', '', '09:00', 'specific_time', 1, date('now'), '🌞')
            `);
            
            console.log('✅ 示例数据插入完成');
        } else {
            console.log('📋 数据库已有数据，跳过示例数据插入');
        }
        
        // 验证数据
        const users = await query('SELECT COUNT(*) as count FROM users');
        const todos = await query('SELECT COUNT(*) as count FROM todos');
        const patterns = await query('SELECT COUNT(*) as count FROM repeat_patterns');
        
        console.log('📈 数据统计:');
        console.log(`  - 用户: ${users[0].count} 条`);
        console.log(`  - TODO: ${todos[0].count} 条`);
        console.log(`  - 重复模式: ${patterns[0].count} 条`);
        
        console.log('🎉 SQLite数据库初始化完成！');
        
    } catch (error) {
        console.error('❌ SQLite数据库初始化失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    initSQLiteDatabase();
}

module.exports = { initSQLiteDatabase };