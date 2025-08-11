// 检查剩余数据的脚本
const { query } = require('../config/sqlite');

async function checkRemainingData() {
    try {
        console.log('=== 检查剩余数据 ===');
        
        // 检查被添加用户
        const users = await query('SELECT id, app_user_id, username, display_name FROM users');
        console.log('\n被添加用户:');
        users.forEach(u => console.log(`  - ID:${u.id}, App用户:${u.app_user_id}, 用户名:${u.username}, 显示名:${u.display_name}`));
        
        // 检查TODOs
        const todos = await query('SELECT id, user_id, title FROM todos');
        console.log('\nTODOs:');
        todos.forEach(t => console.log(`  - ID:${t.id}, 用户ID:${t.user_id}, 标题:${t.title}`));
        
        // 检查完成记录
        const completions = await query('SELECT id, todo_id, user_id, completion_date FROM todo_completions');
        console.log('\n完成记录:');
        completions.forEach(c => console.log(`  - ID:${c.id}, TODO ID:${c.todo_id}, 用户ID:${c.user_id}, 完成日期:${c.completion_date}`));
        
        // 检查删除记录
        const deletions = await query('SELECT id, todo_id, deletion_date FROM todo_deletions');
        console.log('\n删除记录:');
        deletions.forEach(d => console.log(`  - ID:${d.id}, TODO ID:${d.todo_id}, 删除日期:${d.deletion_date}`));
        
        // 检查用户关联
        const links = await query('SELECT id, manager_app_user, linked_app_user, supervised_user_id FROM user_links');
        console.log('\n用户关联:');
        links.forEach(l => console.log(`  - ID:${l.id}, 管理员:${l.manager_app_user}, 被关联:${l.linked_app_user}, 监管用户ID:${l.supervised_user_id}`));
        
        // 检查关联请求
        const requests = await query('SELECT id, from_app_user, to_app_user, supervised_user_id, status FROM link_requests');
        console.log('\n关联请求:');
        requests.forEach(r => console.log(`  - ID:${r.id}, 发起:${r.from_app_user}, 接收:${r.to_app_user}, 监管用户ID:${r.supervised_user_id}, 状态:${r.status}`));
        
        // 检查用户设置
        const settings = await query('SELECT id, user_id FROM user_settings');
        console.log('\n用户设置:');
        settings.forEach(s => console.log(`  - ID:${s.id}, 用户ID:${s.user_id}`));
        
    } catch (error) {
        console.error('❌ 检查数据失败:', error);
    }
}

checkRemainingData().then(() => process.exit(0)).catch(console.error);