// 清理测试数据的脚本
const { query } = require('../config/sqlite');

async function cleanupTestData() {
    try {
        console.log('=== 清理测试数据 ===');
        
        // 删除测试TODOs
        const testTitles = [
            'test sync todo',
            'new sync test todo', 
            'reverse sync test todo'
        ];
        
        for (const title of testTitles) {
            const result = await query('DELETE FROM todos WHERE title = ?', [title]);
            console.log(`🗑️ 删除测试TODO "${title}": ${result.affectedRows} 条`);
        }
        
        // 删除相关的完成记录
        await query(`
            DELETE FROM todo_completions 
            WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)
        `);
        console.log('🗑️ 清理孤立的完成记录');
        
        // 删除相关的删除记录
        await query(`
            DELETE FROM todo_deletions 
            WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)
        `);
        console.log('🗑️ 清理孤立的删除记录');
        
        console.log('\n=== 清理后的数据状态 ===');
        
        // 检查最终状态
        const todos = await query('SELECT id, user_id, title FROM todos WHERE is_active = 1 ORDER BY user_id, id');
        console.log('\n剩余的TODOs:');
        todos.forEach(t => console.log(`  - ID:${t.id}, 用户ID:${t.user_id}, 标题:${t.title}`));
        
        const completions = await query('SELECT COUNT(*) as count FROM todo_completions');
        const deletions = await query('SELECT COUNT(*) as count FROM todo_deletions');
        
        console.log(`\n数据统计:`);
        console.log(`  - TODOs: ${todos.length} 条`);
        console.log(`  - 完成记录: ${completions[0].count} 条`);
        console.log(`  - 删除记录: ${deletions[0].count} 条`);
        
        console.log('\n✅ 测试数据清理完成');
        
    } catch (error) {
        console.error('❌ 清理测试数据失败:', error);
    }
}

cleanupTestData().then(() => process.exit(0)).catch(console.error);