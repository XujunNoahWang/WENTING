// TODO数据库初始化脚本 - 完全重写版本
const fs = require('fs').promises;
const path = require('path');
const { query, testConnection } = require('../config/sqlite');

// 创建用户表
async function createUsersTable() {
    await query(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            display_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            gender TEXT CHECK(gender IN ('male', 'female', 'other')),
            birthday DATE,
            avatar_color TEXT DEFAULT '#1d9bf0',
            timezone TEXT DEFAULT 'Asia/Shanghai',
            device_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            UNIQUE(username, device_id)
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
            
        } else {
            console.log('📄 删除旧表并创建新表...');
            
            // 删除旧表（如果存在）
            await query('DROP TABLE IF EXISTS todo_deletions');
            await query('DROP TABLE IF EXISTS todo_completions');
            await query('DROP TABLE IF EXISTS todos');
            await query('DROP TABLE IF EXISTS notes');
            await query('DROP TABLE IF EXISTS repeat_patterns');
            await query('DROP TABLE IF EXISTS user_settings');
            await query('DROP TABLE IF EXISTS users');
            
            // 创建所有表
            await createUsersTable();
            await createTodosTable();
            await createNotesTable();
            await createTodoCompletionsTable();
            await createTodoDeletionsTable();
            await createUserSettingsTable();
        }
        
        // 创建优化性能的索引
        console.log('🔍 创建数据库索引...');
        
        // 用户查询优化索引
        await query('CREATE INDEX idx_users_username_device ON users(username, device_id)');
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
        
        console.log('✅ 数据库索引创建完成');
        console.log('📊 跳过示例数据插入，创建干净的数据库...');
        
        // 验证数据
        const users = await query('SELECT COUNT(*) as count FROM users');
        const todos = await query('SELECT COUNT(*) as count FROM todos');
        const notes = await query('SELECT COUNT(*) as count FROM notes');
        
        console.log('📈 数据统计:');
        console.log(`  - 用户: ${users[0].count} 条`);
        console.log(`  - TODO: ${todos[0].count} 条`);
        console.log(`  - Notes: ${notes[0].count} 条`);
        
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