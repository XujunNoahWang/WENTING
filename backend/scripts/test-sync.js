// 测试同步功能的脚本
const { query } = require('../config/sqlite');
const LinkService = require('../services/linkService');

async function testSync() {
    try {
        console.log('=== 测试同步功能 ===');
        
        // 模拟一个TODO创建操作
        const todoData = {
            title: 'test sync todo',
            description: 'testing sync functionality',
            reminder_time: 'all_day',
            priority: 'medium',
            repeat_type: 'daily',
            repeat_interval: 1,
            start_date: new Date().toISOString().split('T')[0],
            cycle_type: 'long_term',
            sort_order: 0,
            is_completed_today: false,
            is_active: true,
            created_at: new Date().toISOString()
        };
        
        console.log('🔄 测试同步TODO创建操作...');
        console.log('数据:', todoData);
        
        // 测试用户ID 20 (blackblade的u1)
        const supervisedUserId = 20;
        
        // 调用同步函数
        await LinkService.syncDataChange('CREATE', 'todos', todoData, supervisedUserId);
        
        console.log('✅ 同步操作完成');
        
        // 检查结果
        const todos = await query('SELECT id, user_id, title FROM todos WHERE title = ? AND is_active = 1', [todoData.title]);
        console.log('\n同步后的TODOs:');
        todos.forEach(t => console.log(`  - ID:${t.id}, 用户ID:${t.user_id}, 标题:${t.title}`));
        
    } catch (error) {
        console.error('❌ 测试同步功能失败:', error);
    }
}

testSync().then(() => process.exit(0)).catch(console.error);