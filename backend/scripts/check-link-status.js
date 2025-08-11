// 检查关联状态的脚本
const { query } = require('../config/sqlite');

async function checkLinkStatus() {
    try {
        console.log('=== 检查关联状态 ===');
        
        // 检查app_users
        const appUsers = await query('SELECT username FROM app_users');
        console.log('注册用户:', appUsers.map(u => u.username));
        
        // 检查users表
        const users = await query('SELECT id, app_user_id, username, display_name, is_linked, supervised_app_user FROM users');
        console.log('\n被添加用户:');
        users.forEach(u => console.log(`  - ID:${u.id}, App用户:${u.app_user_id}, 用户名:${u.username}, 关联状态:${u.is_linked}, 监管者:${u.supervised_app_user}`));
        
        // 检查user_links表
        const links = await query('SELECT * FROM user_links');
        console.log('\n用户关联:');
        links.forEach(l => console.log(`  - ID:${l.id}, 管理员:${l.manager_app_user}, 被关联:${l.linked_app_user}, 监管用户ID:${l.supervised_user_id}, 状态:${l.status}`));
        
        // 检查link_requests表
        const requests = await query('SELECT * FROM link_requests');
        console.log('\n关联请求:');
        requests.forEach(r => console.log(`  - ID:${r.id}, 发起:${r.from_app_user}, 接收:${r.to_app_user}, 监管用户ID:${r.supervised_user_id}, 状态:${r.status}`));
        
        // 检查todos表
        const todos = await query('SELECT id, user_id, title FROM todos WHERE is_active = 1');
        console.log('\nTODOs:');
        todos.forEach(t => console.log(`  - ID:${t.id}, 用户ID:${t.user_id}, 标题:${t.title}`));
        
    } catch (error) {
        console.error('❌ 检查关联状态失败:', error);
    }
}

checkLinkStatus().then(() => process.exit(0)).catch(console.error);