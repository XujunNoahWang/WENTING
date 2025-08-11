// 检查bbb TODO的数据库状态
const { query } = require('../config/sqlite');

async function checkBbbTodo() {
    try {
        console.log('=== 检查数据库中的TODO数据 ===');
        
        // 检查所有活跃的TODOs
        const todos = await query('SELECT id, user_id, title, description, start_date, created_at FROM todos WHERE is_active = 1 ORDER BY created_at DESC');
        console.log('\n所有活跃的TODOs:');
        todos.forEach(t => {
            const createTime = new Date(t.created_at).toLocaleString();
            console.log(`  - ID:${t.id}, 用户:${t.user_id}, 标题:"${t.title}", 描述:"${t.description}", 开始日期:${t.start_date}, 创建时间:${createTime}`);
        });
        
        // 特别检查标题为'bbb'的TODO
        const bbbTodos = await query('SELECT id, user_id, title, description, start_date, created_at FROM todos WHERE title = ? AND is_active = 1', ['bbb']);
        console.log('\n标题为"bbb"的TODOs:');
        if (bbbTodos.length === 0) {
            console.log('  - 没有找到标题为"bbb"的TODO');
        } else {
            bbbTodos.forEach(t => {
                const createTime = new Date(t.created_at).toLocaleString();
                console.log(`  - ID:${t.id}, 用户:${t.user_id}, 标题:"${t.title}", 描述:"${t.description}", 开始日期:${t.start_date}, 创建时间:${createTime}`);
            });
        }
        
        // 检查用户信息
        console.log('\n用户信息:');
        const users = await query('SELECT id, app_user_id, username FROM users WHERE is_active = 1');
        users.forEach(u => console.log(`  - ID:${u.id}, App用户:${u.app_user_id}, 用户名:${u.username}`));
        
        // 检查最近创建的TODOs（最近10个）
        const recentTodos = await query(`
            SELECT id, user_id, title, description, start_date, created_at 
            FROM todos 
            WHERE is_active = 1 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        console.log('\n最近创建的TODOs:');
        recentTodos.forEach(t => {
            const createTime = new Date(t.created_at).toLocaleString();
            console.log(`  - ID:${t.id}, 用户:${t.user_id}, 标题:"${t.title}", 开始日期:${t.start_date}, 创建时间:${createTime}`);
        });
        
        // 检查是否有同步问题 - 查看是否有只属于一个用户的TODO
        console.log('\n分析同步状态:');
        const todoTitles = await query(`
            SELECT title, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
            FROM todos 
            WHERE is_active = 1 
            GROUP BY title
            ORDER BY created_at DESC
        `);
        
        todoTitles.forEach(t => {
            const userCount = t.count;
            const userIds = t.user_ids.split(',');
            if (userCount === 1) {
                console.log(`  ⚠️ "${t.title}" 只存在于用户 ${t.user_ids} 中 (可能同步失败)`);
            } else if (userCount === 2) {
                console.log(`  ✅ "${t.title}" 存在于用户 ${t.user_ids} 中 (同步正常)`);
            } else {
                console.log(`  🤔 "${t.title}" 存在于 ${userCount} 个用户中: ${t.user_ids}`);
            }
        });
        
        console.log('\n✅ 数据库检查完成');
        
    } catch (error) {
        console.error('❌ 数据库检查失败:', error);
    }
}

checkBbbTodo().then(() => process.exit(0)).catch(console.error);