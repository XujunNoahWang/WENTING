// 清空数据库但保留指定账户的脚本
const { query, testConnection } = require('../config/sqlite');

async function clearDatabaseKeepAccounts() {
    try {
        console.log('🔄 开始清理数据库，保留blackblade和whiteblade账户...');
        
        // 测试连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 首先查看当前的app_users数据
        console.log('📋 当前注册用户:');
        const currentAppUsers = await query('SELECT username, created_at FROM app_users');
        currentAppUsers.forEach(user => {
            console.log(`  - ${user.username} (创建于: ${user.created_at})`);
        });
        
        // 获取要保留的用户ID
        const keepUsers = await query('SELECT username FROM app_users WHERE username IN (?, ?)', ['blackblade', 'whiteblade']);
        console.log(`\n🔒 将保留的账户: ${keepUsers.map(u => u.username).join(', ')}`);
        
        if (keepUsers.length === 0) {
            console.log('⚠️ 警告: 没有找到blackblade或whiteblade账户！');
            console.log('继续清理所有数据...');
        }
        
        console.log('\n🗑️ 开始删除数据...');
        
        // 删除关联请求
        const deletedRequests = await query('DELETE FROM link_requests WHERE from_app_user NOT IN (?, ?) OR to_app_user NOT IN (?, ?)', 
            ['blackblade', 'whiteblade', 'blackblade', 'whiteblade']);
        console.log(`  - 删除关联请求: ${deletedRequests.affectedRows} 条`);
        
        // 删除用户关联
        const deletedLinks = await query('DELETE FROM user_links WHERE manager_app_user NOT IN (?, ?) OR linked_app_user NOT IN (?, ?)', 
            ['blackblade', 'whiteblade', 'blackblade', 'whiteblade']);
        console.log(`  - 删除用户关联: ${deletedLinks.affectedRows} 条`);
        
        // 删除TODO完成记录（通过users表关联）
        const deletedCompletions = await query(`
            DELETE FROM todo_completions 
            WHERE user_id IN (
                SELECT id FROM users WHERE app_user_id NOT IN (?, ?)
            )
        `, ['blackblade', 'whiteblade']);
        console.log(`  - 删除TODO完成记录: ${deletedCompletions.affectedRows} 条`);
        
        // 删除TODO删除记录（通过todos和users表关联）
        const deletedDeletions = await query(`
            DELETE FROM todo_deletions 
            WHERE todo_id IN (
                SELECT t.id FROM todos t 
                JOIN users u ON t.user_id = u.id 
                WHERE u.app_user_id NOT IN (?, ?)
            )
        `, ['blackblade', 'whiteblade']);
        console.log(`  - 删除TODO删除记录: ${deletedDeletions.affectedRows} 条`);
        
        // 删除TODOs
        const deletedTodos = await query(`
            DELETE FROM todos 
            WHERE user_id IN (
                SELECT id FROM users WHERE app_user_id NOT IN (?, ?)
            )
        `, ['blackblade', 'whiteblade']);
        console.log(`  - 删除TODOs: ${deletedTodos.affectedRows} 条`);
        
        // 删除Notes
        const deletedNotes = await query(`
            DELETE FROM notes 
            WHERE user_id IN (
                SELECT id FROM users WHERE app_user_id NOT IN (?, ?)
            )
        `, ['blackblade', 'whiteblade']);
        console.log(`  - 删除Notes: ${deletedNotes.affectedRows} 条`);
        
        // 删除用户设置
        const deletedSettings = await query(`
            DELETE FROM user_settings 
            WHERE user_id IN (
                SELECT id FROM users WHERE app_user_id NOT IN (?, ?)
            )
        `, ['blackblade', 'whiteblade']);
        console.log(`  - 删除用户设置: ${deletedSettings.affectedRows} 条`);
        
        // 删除被添加用户（除了blackblade和whiteblade的）
        const deletedUsers = await query('DELETE FROM users WHERE app_user_id NOT IN (?, ?)', 
            ['blackblade', 'whiteblade']);
        console.log(`  - 删除被添加用户: ${deletedUsers.affectedRows} 条`);
        
        // 删除注册用户（除了blackblade和whiteblade）
        const deletedAppUsers = await query('DELETE FROM app_users WHERE username NOT IN (?, ?)', 
            ['blackblade', 'whiteblade']);
        console.log(`  - 删除注册用户: ${deletedAppUsers.affectedRows} 条`);
        
        console.log('\n✅ 数据库清理完成！');
        console.log('📊 清理后数据统计:');
        
        // 验证清理结果
        const appUsers = await query('SELECT COUNT(*) as count FROM app_users');
        const users = await query('SELECT COUNT(*) as count FROM users');
        const todos = await query('SELECT COUNT(*) as count FROM todos');
        const notes = await query('SELECT COUNT(*) as count FROM notes');
        const completions = await query('SELECT COUNT(*) as count FROM todo_completions');
        const deletions = await query('SELECT COUNT(*) as count FROM todo_deletions');
        const userLinks = await query('SELECT COUNT(*) as count FROM user_links');
        const linkRequests = await query('SELECT COUNT(*) as count FROM link_requests');
        const userSettings = await query('SELECT COUNT(*) as count FROM user_settings');
        
        console.log(`  - 注册用户: ${appUsers[0].count} 条`);
        console.log(`  - 被添加用户: ${users[0].count} 条`);
        console.log(`  - TODOs: ${todos[0].count} 条`);
        console.log(`  - Notes: ${notes[0].count} 条`);
        console.log(`  - 完成记录: ${completions[0].count} 条`);
        console.log(`  - 删除记录: ${deletions[0].count} 条`);
        console.log(`  - 用户关联: ${userLinks[0].count} 条`);
        console.log(`  - 关联请求: ${linkRequests[0].count} 条`);
        console.log(`  - 用户设置: ${userSettings[0].count} 条`);
        
        // 显示保留的用户
        console.log('\n🔒 保留的注册用户:');
        const remainingAppUsers = await query('SELECT username, created_at FROM app_users ORDER BY username');
        remainingAppUsers.forEach(user => {
            console.log(`  - ${user.username} (创建于: ${user.created_at})`);
        });
        
        console.log('\n🎉 清理完成！只保留了blackblade和whiteblade的账户信息。');
        
    } catch (error) {
        console.error('❌ 清理数据库失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    clearDatabaseKeepAccounts().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { clearDatabaseKeepAccounts };