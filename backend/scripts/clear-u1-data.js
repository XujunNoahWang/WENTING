// 删除所有u1用户及其相关数据的脚本
const { query, testConnection } = require('../config/sqlite');

async function clearU1Data() {
    try {
        console.log('🔄 开始删除所有u1用户及其相关数据...');
        
        // 测试连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 查找所有名为u1的用户
        const u1Users = await query('SELECT id, app_user_id, username, display_name FROM users WHERE username = ?', ['u1']);
        console.log('📋 找到的u1用户:');
        u1Users.forEach(user => {
            console.log(`  - ID:${user.id}, App用户:${user.app_user_id}, 用户名:${user.username}, 显示名:${user.display_name}`);
        });
        
        if (u1Users.length === 0) {
            console.log('✅ 没有找到u1用户，无需清理');
            return;
        }
        
        const u1UserIds = u1Users.map(u => u.id);
        console.log(`\n🗑️ 开始删除u1用户(ID: ${u1UserIds.join(', ')})的相关数据...`);
        
        // 删除TODO完成记录
        const deletedCompletions = await query(`
            DELETE FROM todo_completions 
            WHERE user_id IN (${u1UserIds.map(() => '?').join(',')})
        `, u1UserIds);
        console.log(`  - 删除TODO完成记录: ${deletedCompletions.affectedRows} 条`);
        
        // 删除TODO删除记录（通过todos表关联）
        const deletedDeletions = await query(`
            DELETE FROM todo_deletions 
            WHERE todo_id IN (
                SELECT id FROM todos WHERE user_id IN (${u1UserIds.map(() => '?').join(',')})
            )
        `, u1UserIds);
        console.log(`  - 删除TODO删除记录: ${deletedDeletions.affectedRows} 条`);
        
        // 删除TODOs
        const deletedTodos = await query(`
            DELETE FROM todos 
            WHERE user_id IN (${u1UserIds.map(() => '?').join(',')})
        `, u1UserIds);
        console.log(`  - 删除TODOs: ${deletedTodos.affectedRows} 条`);
        
        // 删除Notes
        const deletedNotes = await query(`
            DELETE FROM notes 
            WHERE user_id IN (${u1UserIds.map(() => '?').join(',')})
        `, u1UserIds);
        console.log(`  - 删除Notes: ${deletedNotes.affectedRows} 条`);
        
        // 删除用户设置
        const deletedSettings = await query(`
            DELETE FROM user_settings 
            WHERE user_id IN (${u1UserIds.map(() => '?').join(',')})
        `, u1UserIds);
        console.log(`  - 删除用户设置: ${deletedSettings.affectedRows} 条`);
        
        // 删除用户关联（作为被监管用户）
        const deletedLinks = await query(`
            DELETE FROM user_links 
            WHERE supervised_user_id IN (${u1UserIds.map(() => '?').join(',')})
        `, u1UserIds);
        console.log(`  - 删除用户关联: ${deletedLinks.affectedRows} 条`);
        
        // 删除关联请求（作为被监管用户）
        const deletedRequests = await query(`
            DELETE FROM link_requests 
            WHERE supervised_user_id IN (${u1UserIds.map(() => '?').join(',')})
        `, u1UserIds);
        console.log(`  - 删除关联请求: ${deletedRequests.affectedRows} 条`);
        
        // 最后删除u1用户本身
        const deletedUsers = await query(`
            DELETE FROM users 
            WHERE id IN (${u1UserIds.map(() => '?').join(',')})
        `, u1UserIds);
        console.log(`  - 删除u1用户: ${deletedUsers.affectedRows} 条`);
        
        console.log('\n✅ u1用户数据清理完成！');
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
        
        // 显示剩余的用户
        console.log('\n🔒 剩余的注册用户:');
        const remainingAppUsers = await query('SELECT username, created_at FROM app_users ORDER BY username');
        remainingAppUsers.forEach(user => {
            console.log(`  - ${user.username} (创建于: ${user.created_at})`);
        });
        
        console.log('\n🔒 剩余的被添加用户:');
        const remainingUsers = await query('SELECT id, app_user_id, username, display_name FROM users ORDER BY app_user_id');
        if (remainingUsers.length === 0) {
            console.log('  - 无');
        } else {
            remainingUsers.forEach(user => {
                console.log(`  - ID:${user.id}, App用户:${user.app_user_id}, 用户名:${user.username}, 显示名:${user.display_name}`);
            });
        }
        
        console.log('\n🎉 清理完成！所有u1用户及其相关数据已删除，只保留blackblade和whiteblade的账户信息。');
        
    } catch (error) {
        console.error('❌ 清理u1数据失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    clearU1Data().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { clearU1Data };