// 测试完成状态同步功能
const { query } = require('../config/sqlite');
const LinkService = require('../services/linkService');

async function testCompleteSync() {
    try {
        console.log('=== 测试完成状态同步功能 ===');
        
        // 获取一个现有的TODO来测试完成状态同步
        const todos = await query('SELECT id, user_id, title FROM todos WHERE is_active = 1 LIMIT 1');
        if (todos.length === 0) {
            console.log('❌ 没有找到可测试的TODO');
            return;
        }
        
        const testTodo = todos[0];
        console.log(`🎯 测试TODO: ID ${testTodo.id}, 用户 ${testTodo.user_id}, 标题 "${testTodo.title}"`);
        
        // 模拟完成操作
        const completeData = {
            originalTodoId: testTodo.id,
            title: testTodo.title,
            date: new Date().toISOString().split('T')[0],
            notes: 'Test completion sync'
        };
        
        console.log('🔄 测试TODO完成同步...');
        
        // 先在数据库中标记为完成
        await query(`
            INSERT OR REPLACE INTO todo_completions (todo_id, user_id, completion_date, notes)
            VALUES (?, ?, ?, ?)
        `, [testTodo.id, testTodo.user_id, completeData.date, completeData.notes]);
        
        console.log(`✅ 为用户${testTodo.user_id}的TODO ${testTodo.id} 添加完成记录`);
        
        // 测试同步
        await LinkService.syncDataChange('COMPLETE', 'todos', completeData, testTodo.user_id);
        
        console.log('✅ 完成状态同步操作完成');
        
        // 检查结果
        const completions = await query(`
            SELECT tc.*, t.title, t.user_id 
            FROM todo_completions tc
            JOIN todos t ON tc.todo_id = t.id
            WHERE t.title = ? AND tc.completion_date = ?
        `, [testTodo.title, completeData.date]);
        
        console.log('\n同步后的完成记录:');
        completions.forEach(c => console.log(`  - TODO ID:${c.todo_id}, 用户ID:${c.user_id}, 标题:"${c.title}", 日期:${c.completion_date}, 备注:"${c.notes}"`));
        
        // 测试取消完成
        console.log('\n🔄 测试取消完成同步...');
        
        const uncompleteData = {
            originalTodoId: testTodo.id,
            title: testTodo.title,
            date: completeData.date
        };
        
        // 先删除原始完成记录
        await query(`
            DELETE FROM todo_completions 
            WHERE todo_id = ? AND completion_date = ?
        `, [testTodo.id, completeData.date]);
        
        console.log(`✅ 删除用户${testTodo.user_id}的TODO ${testTodo.id} 完成记录`);
        
        // 测试取消完成同步
        await LinkService.syncDataChange('UNCOMPLETE', 'todos', uncompleteData, testTodo.user_id);
        
        console.log('✅ 取消完成状态同步操作完成');
        
        // 检查最终结果
        const finalCompletions = await query(`
            SELECT tc.*, t.title, t.user_id 
            FROM todo_completions tc
            JOIN todos t ON tc.todo_id = t.id
            WHERE t.title = ? AND tc.completion_date = ?
        `, [testTodo.title, completeData.date]);
        
        console.log('\n取消完成后的完成记录:');
        if (finalCompletions.length === 0) {
            console.log('  - 无完成记录（正确）');
        } else {
            finalCompletions.forEach(c => console.log(`  - TODO ID:${c.todo_id}, 用户ID:${c.user_id}, 标题:"${c.title}", 日期:${c.completion_date}`));
        }
        
    } catch (error) {
        console.error('❌ 测试完成状态同步功能失败:', error);
    }
}

testCompleteSync().then(() => process.exit(0)).catch(console.error);