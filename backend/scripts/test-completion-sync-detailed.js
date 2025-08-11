// 详细测试完成状态同步功能
const { query } = require('../config/sqlite');
const LinkService = require('../services/linkService');

async function testCompletionSyncDetailed() {
    try {
        console.log('=== 详细测试完成状态同步功能 ===');
        
        // 1. 先创建一个测试TODO
        const testDate = '2025-08-12';
        const todoData = {
            title: 'completion sync test',
            description: 'testing completion sync on specific date',
            reminder_time: 'all_day',
            priority: 'medium',
            repeat_type: 'daily',
            repeat_interval: 1,
            start_date: testDate,
            cycle_type: 'long_term',
            sort_order: 0,
            is_completed_today: false,
            is_active: true,
            created_at: new Date().toISOString()
        };
        
        console.log('🔄 步骤1: 为用户20创建测试TODO...');
        const result = await query(`
            INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, 
                             repeat_interval, start_date, end_date, cycle_type, cycle_duration, 
                             cycle_unit, sort_order, is_completed_today, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            20, todoData.title, todoData.description, todoData.reminder_time, todoData.priority,
            todoData.repeat_type, todoData.repeat_interval, todoData.start_date, null,
            todoData.cycle_type, null, 'days', todoData.sort_order,
            todoData.is_completed_today, todoData.is_active, todoData.created_at
        ]);
        
        const todoId = result.insertId;
        console.log(`✅ 创建TODO成功，ID: ${todoId}`);
        
        // 2. 同步TODO创建
        console.log('🔄 步骤2: 同步TODO创建...');
        await LinkService.syncDataChange('CREATE', 'todos', todoData, 20);
        
        // 3. 检查同步结果
        const syncedTodos = await query('SELECT id, user_id, title FROM todos WHERE title = ? AND is_active = 1', [todoData.title]);
        console.log('同步后的TODOs:');
        syncedTodos.forEach(t => console.log(`  - ID:${t.id}, 用户ID:${t.user_id}, 标题:${t.title}`));
        
        if (syncedTodos.length !== 2) {
            console.log('❌ TODO同步失败，应该有2个TODO');
            return;
        }
        
        const user20TodoId = syncedTodos.find(t => t.user_id === 20).id;
        const user21TodoId = syncedTodos.find(t => t.user_id === 21).id;
        
        // 4. 在用户20上标记完成（8月12日）
        console.log(`🔄 步骤3: 在用户20的TODO ${user20TodoId} 上标记8月12日完成...`);
        await query(`
            INSERT OR REPLACE INTO todo_completions (todo_id, user_id, completion_date, notes)
            VALUES (?, ?, ?, ?)
        `, [user20TodoId, 20, testDate, 'Test completion on Aug 12']);
        
        // 5. 同步完成状态
        console.log('🔄 步骤4: 同步完成状态...');
        const completeData = {
            originalTodoId: user20TodoId,
            title: todoData.title,
            date: testDate,
            notes: 'Test completion on Aug 12'
        };
        
        await LinkService.syncDataChange('COMPLETE', 'todos', completeData, 20);
        
        // 6. 检查完成记录同步结果
        console.log('🔄 步骤5: 检查完成记录同步结果...');
        const completions = await query(`
            SELECT tc.*, t.title, t.user_id 
            FROM todo_completions tc
            JOIN todos t ON tc.todo_id = t.id
            WHERE t.title = ? AND tc.completion_date = ?
        `, [todoData.title, testDate]);
        
        console.log(`\n8月12日的完成记录:`)
        completions.forEach(c => console.log(`  - TODO ID:${c.todo_id}, 用户ID:${c.user_id}, 标题:"${c.title}", 日期:${c.completion_date}, 备注:"${c.notes}"`));
        
        // 7. 测试前端查询逻辑 - 模拟用户21查询8月12日的TODO
        console.log('🔄 步骤6: 模拟前端查询 - 用户21查询8月12日的TODO...');
        const Todo = require('../models/Todo');
        const user21Todos = await Todo.findByUserIdAndDate(21, testDate);
        
        console.log(`\n用户21在8月12日的TODO:`)
        user21Todos.forEach(t => console.log(`  - ID:${t.id}, 标题:"${t.title}", 完成状态:${t.is_completed_today}`));
        
        // 8. 测试其他日期 - 8月13日
        const testDate2 = '2025-08-13';
        console.log(`\n🔄 步骤7: 测试8月13日的TODO状态...`);
        
        const user21TodosAug13 = await Todo.findByUserIdAndDate(21, testDate2);
        console.log(`\n用户21在8月13日的TODO:`)
        user21TodosAug13.forEach(t => console.log(`  - ID:${t.id}, 标题:"${t.title}", 完成状态:${t.is_completed_today}`));
        
        // 9. 在8月13日也标记完成
        console.log(`🔄 步骤8: 在用户21的TODO ${user21TodoId} 上标记8月13日完成...`);
        await query(`
            INSERT OR REPLACE INTO todo_completions (todo_id, user_id, completion_date, notes)
            VALUES (?, ?, ?, ?)
        `, [user21TodoId, 21, testDate2, 'Test completion on Aug 13']);
        
        // 10. 同步8月13日的完成状态
        console.log('🔄 步骤9: 同步8月13日的完成状态...');
        const completeData2 = {
            originalTodoId: user21TodoId,
            title: todoData.title,
            date: testDate2,
            notes: 'Test completion on Aug 13'
        };
        
        await LinkService.syncDataChange('COMPLETE', 'todos', completeData2, 21);
        
        // 11. 最终检查
        console.log('🔄 步骤10: 最终检查所有完成记录...');
        const allCompletions = await query(`
            SELECT tc.*, t.title, t.user_id 
            FROM todo_completions tc
            JOIN todos t ON tc.todo_id = t.id
            WHERE t.title = ?
            ORDER BY tc.completion_date, t.user_id
        `, [todoData.title]);
        
        console.log(`\n所有完成记录:`)
        allCompletions.forEach(c => console.log(`  - TODO ID:${c.todo_id}, 用户ID:${c.user_id}, 标题:"${c.title}", 日期:${c.completion_date}, 备注:"${c.notes}"`));
        
        // 12. 测试用户20查询8月13日
        console.log(`\n🔄 步骤11: 用户20查询8月13日的TODO...`);
        const user20TodosAug13 = await Todo.findByUserIdAndDate(20, testDate2);
        console.log(`\n用户20在8月13日的TODO:`)
        user20TodosAug13.forEach(t => console.log(`  - ID:${t.id}, 标题:"${t.title}", 完成状态:${t.is_completed_today}`));
        
        // 清理测试数据
        console.log('\n🧹 清理测试数据...');
        await query('DELETE FROM todos WHERE title = ?', [todoData.title]);
        await query('DELETE FROM todo_completions WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)');
        
        console.log('✅ 详细测试完成');
        
    } catch (error) {
        console.error('❌ 详细测试失败:', error);
    }
}

testCompletionSyncDetailed().then(() => process.exit(0)).catch(console.error);