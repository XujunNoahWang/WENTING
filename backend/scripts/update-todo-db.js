// 更新TODO数据库以支持重复任务的删除选项
const { query, testConnection } = require('../config/sqlite');

async function updateTodoDatabase() {
    try {
        console.log('🔄 开始更新TODO数据库结构...');
        
        // 测试连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 创建TODO删除例外表 - 用于记录被删除的特定日期实例
        await query(`
            CREATE TABLE IF NOT EXISTS todo_deletions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                todo_id INTEGER NOT NULL,
                deletion_date DATE NOT NULL,
                deletion_type TEXT NOT NULL CHECK(deletion_type IN ('single', 'from_date', 'all')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
                UNIQUE(todo_id, deletion_date)
            )
        `);
        
        // 添加TODO结束日期字段（用于"从某日期开始删除"的情况）
        try {
            await query('ALTER TABLE todos ADD COLUMN end_date DATE DEFAULT NULL');
            console.log('✅ 添加end_date字段成功');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('📝 end_date字段已存在，跳过');
            } else {
                throw error;
            }
        }
        
        console.log('🎉 TODO数据库结构更新完成！');
        
    } catch (error) {
        console.error('❌ TODO数据库结构更新失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    updateTodoDatabase().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { updateTodoDatabase };