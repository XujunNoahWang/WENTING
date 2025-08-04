// 清理数据库脚本 - 删除所有数据，创建干净的数据库
const fs = require('fs').promises;
const path = require('path');
const { query, testConnection } = require('../config/sqlite');

async function clearDatabase() {
    try {
        console.log('🔄 开始清理数据库...');
        
        // 测试连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        console.log('🗑️ 删除所有数据...');
        
        // 删除所有数据（保留表结构）
        await query('DELETE FROM todo_completions');
        await query('DELETE FROM todo_deletions');
        await query('DELETE FROM todos');
        await query('DELETE FROM user_settings');
        await query('DELETE FROM users');
        
        // 重置自增ID
        await query('DELETE FROM sqlite_sequence WHERE name IN ("users", "todos", "todo_completions", "todo_deletions", "user_settings")');
        
        console.log('✅ 数据库清理完成！');
        console.log('📊 当前数据统计:');
        
        // 验证清理结果
        const users = await query('SELECT COUNT(*) as count FROM users');
        const todos = await query('SELECT COUNT(*) as count FROM todos');
        const completions = await query('SELECT COUNT(*) as count FROM todo_completions');
        const deletions = await query('SELECT COUNT(*) as count FROM todo_deletions');
        
        console.log(`  - 用户: ${users[0].count} 条`);
        console.log(`  - TODO: ${todos[0].count} 条`);
        console.log(`  - 完成记录: ${completions[0].count} 条`);
        console.log(`  - 删除记录: ${deletions[0].count} 条`);
        
        console.log('🎉 数据库现在是完全干净的！');
        
    } catch (error) {
        console.error('❌ 清理数据库失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    clearDatabase().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { clearDatabase };