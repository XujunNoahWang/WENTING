// 测试真实使用场景的脚本
const { query } = require('../config/sqlite');
const LinkService = require('../services/linkService');
const Todo = require('../models/Todo');

async function testRealScenario() {
    try {
        console.log('=== 测试真实使用场景 ===');
        
        // 场景：blackblade在8月12日创建一个TODO，whiteblade在8月11日，然后切换到8月12日应该能看到
        
        const testDate = '2025-08-12';
        const otherDate = '2025-08-11';
        
        console.log('🔄 步骤1: 清理现有测试数据...');
        await query('DELETE FROM todos WHERE title LIKE ?', ['real_test_%']);
        await query('DELETE FROM todo_completions WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)');
        
        console.log('🔄 步骤2: blackblade(用户20)在8月12日创建TODO...');
        
        // 模拟通过API创建TODO
        const todoData = {
            user_id: 20,
            title: 'real_test_todo_aug12',
            description: 'Created by blackblade on Aug 12',
            reminder_time: '09:00',
            priority: 'high',
            repeat_type: 'daily',
            repeat_interval: 1,
            start_date: testDate,
            cycle_type: 'long_term'
        };
        
        const newTodo = await Todo.create(todoData);
        console.log(`✅ 创建TODO成功，ID: ${newTodo.id}`);
        
        // 触发同步
        await LinkService.syncDataChange('CREATE', 'todos', todoData, 20);
        console.log('✅ 同步完成');
        
        console.log('🔄 步骤3: 检查whiteblade(用户21)在8月12日能否看到TODO...');
        const user21TodosAug12 = await Todo.findByUserIdAndDate(21, testDate);
        const syncedTodo = user21TodosAug12.find(t => t.title === todoData.title);
        
        if (syncedTodo) {
            console.log(`✅ whiteblade在8月12日能看到同步的TODO: "${syncedTodo.title}"`);
        } else {
            console.log('❌ whiteblade在8月12日看不到同步的TODO');
            console.log('所有TODO:', user21TodosAug12.map(t => t.title));
        }
        
        console.log('🔄 步骤4: 检查whiteblade(用户21)在8月11日能否看到TODO...');
        const user21TodosAug11 = await Todo.findByUserIdAndDate(21, otherDate);
        const syncedTodoAug11 = user21TodosAug11.find(t => t.title === todoData.title);
        
        if (syncedTodoAug11) {
            console.log(`✅ whiteblade在8月11日也能看到同步的TODO: "${syncedTodoAug11.title}" (因为是daily重复)`);
        } else {
            console.log('❌ whiteblade在8月11日看不到同步的TODO');
            console.log('所有TODO:', user21TodosAug11.map(t => t.title));
        }
        
        console.log('🔄 步骤5: blackblade在8月12日完成TODO...');
        await Todo.markCompleted(newTodo.id, 20, testDate, 'Completed by blackblade');
        
        // 触发完成状态同步
        const completeData = {
            originalTodoId: newTodo.id,
            title: todoData.title,
            date: testDate,
            notes: 'Completed by blackblade'
        };
        await LinkService.syncDataChange('COMPLETE', 'todos', completeData, 20);
        console.log('✅ 完成状态同步完成');
        
        console.log('🔄 步骤6: 检查whiteblade在8月12日能否看到完成状态...');
        const user21TodosAug12After = await Todo.findByUserIdAndDate(21, testDate);
        const completedTodo = user21TodosAug12After.find(t => t.title === todoData.title);
        
        if (completedTodo) {
            console.log(`✅ whiteblade在8月12日看到TODO: "${completedTodo.title}", 完成状态: ${completedTodo.is_completed_today}`);
        } else {
            console.log('❌ whiteblade在8月12日看不到TODO');
        }
        
        console.log('🔄 步骤7: 检查whiteblade在8月11日的完成状态...');
        const user21TodosAug11After = await Todo.findByUserIdAndDate(21, otherDate);
        const todoAug11After = user21TodosAug11After.find(t => t.title === todoData.title);
        
        if (todoAug11After) {
            console.log(`✅ whiteblade在8月11日看到TODO: "${todoAug11After.title}", 完成状态: ${todoAug11After.is_completed_today} (应该是false)`);
        } else {
            console.log('❌ whiteblade在8月11日看不到TODO');
        }
        
        console.log('🔄 步骤8: whiteblade在8月11日也完成TODO...');
        
        // 找到whiteblade的对应TODO
        const whitebladeAllTodos = await query('SELECT id FROM todos WHERE user_id = 21 AND title = ? AND is_active = 1', [todoData.title]);
        if (whitebladeAllTodos.length > 0) {
            const whitebladeToDoId = whitebladeAllTodos[0].id;
            await Todo.markCompleted(whitebladeToDoId, 21, otherDate, 'Completed by whiteblade on Aug 11');
            
            // 触发完成状态同步
            const completeData2 = {
                originalTodoId: whitebladeToDoId,
                title: todoData.title,
                date: otherDate,
                notes: 'Completed by whiteblade on Aug 11'
            };
            await LinkService.syncDataChange('COMPLETE', 'todos', completeData2, 21);
            console.log('✅ whiteblade的完成状态同步完成');
            
            console.log('🔄 步骤9: 检查blackblade在8月11日能否看到whiteblade的完成状态...');
            const user20TodosAug11Final = await Todo.findByUserIdAndDate(20, otherDate);
            const blackbladeTodoAug11 = user20TodosAug11Final.find(t => t.title === todoData.title);
            
            if (blackbladeTodoAug11) {
                console.log(`✅ blackblade在8月11日看到TODO: "${blackbladeTodoAug11.title}", 完成状态: ${blackbladeTodoAug11.is_completed_today} (应该是true)`);
            } else {
                console.log('❌ blackblade在8月11日看不到TODO');
            }
        }
        
        console.log('🔄 步骤10: 最终检查所有完成记录...');
        const allCompletions = await query(`
            SELECT tc.*, t.title, t.user_id 
            FROM todo_completions tc
            JOIN todos t ON tc.todo_id = t.id
            WHERE t.title = ?
            ORDER BY tc.completion_date, t.user_id
        `, [todoData.title]);
        
        console.log('\n所有完成记录:');
        allCompletions.forEach(c => console.log(`  - 用户${c.user_id}, 日期:${c.completion_date}, 备注:"${c.notes}"`));
        
        console.log('\n=== 测试总结 ===');
        console.log('✅ 如果以上所有步骤都显示正确结果，说明后端同步逻辑完全正常');
        console.log('❌ 如果前端仍然有问题，那么问题在于:');
        console.log('   1. WebSocket连接或消息处理');
        console.log('   2. 前端缓存清理');
        console.log('   3. 前端日期切换逻辑');
        console.log('   4. 前端数据重新加载逻辑');
        
        // 清理测试数据
        console.log('\n🧹 清理测试数据...');
        await query('DELETE FROM todos WHERE title LIKE ?', ['real_test_%']);
        await query('DELETE FROM todo_completions WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)');
        
        console.log('✅ 真实场景测试完成');
        
    } catch (error) {
        console.error('❌ 真实场景测试失败:', error);
    }
}

testRealScenario().then(() => process.exit(0)).catch(console.error);