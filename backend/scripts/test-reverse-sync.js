// 测试反向同步功能
const { query } = require('../config/sqlite');
const LinkService = require('../services/linkService');

async function testReverseSync() {
    try {
        console.log('=== 测试反向同步功能 ===');
        
        // 模拟从用户21（whiteblade的u1）创建TODO
        const todoData = {
            title: 'reverse sync test todo',
            description: 'testing reverse sync from whiteblade to blackblade',
            reminder_time: '09:00',
            priority: 'low',
            repeat_type: 'weekly',
            repeat_interval: 1,
            start_date: new Date().toISOString().split('T')[0],
            cycle_type: 'long_term',
            sort_order: 0,
            is_completed_today: false,
            is_active: true,
            created_at: new Date().toISOString()
        };
        
        console.log('🔄 测试反向同步TODO创建操作...');
        console.log('数据:', todoData);
        
        // 先为用户21创建TODO
        const result = await query(`
            INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, 
                             repeat_interval, start_date, end_date, cycle_type, cycle_duration, 
                             cycle_unit, sort_order, is_completed_today, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            21, todoData.title, todoData.description, todoData.reminder_time, todoData.priority,
            todoData.repeat_type, todoData.repeat_interval, todoData.start_date, null,
            todoData.cycle_type, null, 'days', todoData.sort_order,
            todoData.is_completed_today, todoData.is_active, todoData.created_at
        ]);
        
        console.log(`✅ 为用户21创建TODO，ID: ${result.insertId}`);
        
        // 测试反向同步
        await LinkService.syncDataChange('CREATE', 'todos', todoData, 21);
        
        console.log('✅ 反向同步操作完成');
        
        // 检查结果
        const todos = await query('SELECT id, user_id, title FROM todos WHERE title = ? AND is_active = 1', [todoData.title]);
        console.log('\n反向同步后的TODOs:');
        todos.forEach(t => console.log(`  - ID:${t.id}, 用户ID:${t.user_id}, 标题:${t.title}`));
        
        // 检查所有TODOs
        console.log('\n=== 所有TODOs ===');
        const allTodos = await query('SELECT id, user_id, title FROM todos WHERE is_active = 1 ORDER BY user_id, id');
        allTodos.forEach(t => console.log(`  - ID:${t.id}, 用户ID:${t.user_id}, 标题:${t.title}`));
        
    } catch (error) {
        console.error('❌ 测试反向同步功能失败:', error);
    }
}

testReverseSync().then(() => process.exit(0)).catch(console.error);