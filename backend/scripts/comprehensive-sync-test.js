// 综合同步功能测试脚本
const { query } = require('../config/sqlite');
const Todo = require('../models/Todo');
const DataSyncService = require('../services/dataSyncService');

async function comprehensiveSyncTest() {
    try {
        console.log('=== 综合同步功能测试 ===');
        
        // 清理测试数据
        console.log('🧹 清理测试数据...');
        await query('DELETE FROM todos WHERE title LIKE ?', ['comprehensive_test_%']);
        await query('DELETE FROM todo_completions WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)');
        
        console.log('🔄 测试1: 模拟WebSocket TODO创建...');
        
        // 模拟WebSocket TODO创建（修复后的逻辑）
        const todoData1 = {
            user_id: 20, // blackblade的u1
            title: 'comprehensive_test_websocket_create',
            description: 'Testing WebSocket TODO creation with sync',
            reminder_time: '16:00',
            priority: 'high',
            repeat_type: 'daily',
            repeat_interval: 1,
            start_date: '2025-08-11',
            cycle_type: 'long_term'
        };
        
        // 模拟WebSocket服务的handleTodoCreate方法
        const todo1 = await Todo.create(todoData1);
        console.log(`✅ 创建TODO成功，ID: ${todo1.id}`);
        
        // 触发同步（这是修复后的逻辑）
        await DataSyncService.syncTodoOperation('create', todo1, todo1.user_id);
        console.log('✅ WebSocket TODO创建同步完成');
        
        // 检查同步结果
        const syncedTodos1 = await query('SELECT id, user_id, title FROM todos WHERE title = ? AND is_active = 1', [todoData1.title]);
        console.log('WebSocket创建同步结果:');
        syncedTodos1.forEach(t => console.log(`  - ID:${t.id}, 用户:${t.user_id}, 标题:"${t.title}"`));
        
        if (syncedTodos1.length === 2) {
            console.log('✅ WebSocket TODO创建同步成功');
        } else {
            console.log('❌ WebSocket TODO创建同步失败');
        }
        
        console.log('\n🔄 测试2: 模拟HTTP TODO创建...');
        
        // 模拟HTTP TODO创建（通过路由）
        const todoData2 = {
            user_id: 21, // whiteblade的u1
            title: 'comprehensive_test_http_create',
            description: 'Testing HTTP TODO creation with sync',
            reminder_time: '17:00',
            priority: 'medium',
            repeat_type: 'weekly',
            repeat_interval: 1,
            start_date: '2025-08-11',
            cycle_type: 'long_term'
        };
        
        // 模拟路由的逻辑
        const todo2 = await Todo.create(todoData2);
        console.log(`✅ 创建TODO成功，ID: ${todo2.id}`);
        
        // 模拟路由中的同步调用
        try {
            await DataSyncService.syncTodoOperation('create', todo2, todo2.user_id);
            console.log('✅ HTTP TODO创建同步完成');
        } catch (syncError) {
            console.error('⚠️ HTTP TODO创建同步失败:', syncError);
        }
        
        // 检查同步结果
        const syncedTodos2 = await query('SELECT id, user_id, title FROM todos WHERE title = ? AND is_active = 1', [todoData2.title]);
        console.log('HTTP创建同步结果:');
        syncedTodos2.forEach(t => console.log(`  - ID:${t.id}, 用户:${t.user_id}, 标题:"${t.title}"`));
        
        if (syncedTodos2.length === 2) {
            console.log('✅ HTTP TODO创建同步成功');
        } else {
            console.log('❌ HTTP TODO创建同步失败');
        }
        
        console.log('\n🔄 测试3: 测试完成状态同步...');
        
        // 测试完成状态同步
        const testDate = '2025-08-11';
        
        // 在用户20上完成第一个TODO
        await Todo.markCompleted(todo1.id, 20, testDate, 'Comprehensive test completion');
        
        // 触发完成状态同步
        await DataSyncService.syncTodoOperation('complete', {
            originalTodoId: todo1.id,
            title: todo1.title,
            date: testDate,
            notes: 'Comprehensive test completion'
        }, 20);
        
        console.log('✅ 完成状态同步触发完成');
        
        // 检查完成记录
        const completions = await query(`
            SELECT tc.*, t.title, t.user_id 
            FROM todo_completions tc
            JOIN todos t ON tc.todo_id = t.id
            WHERE t.title = ? AND tc.completion_date = ?
        `, [todo1.title, testDate]);
        
        console.log('完成状态同步结果:');
        completions.forEach(c => console.log(`  - TODO ID:${c.todo_id}, 用户:${c.user_id}, 标题:"${c.title}", 日期:${c.completion_date}`));
        
        if (completions.length === 2) {
            console.log('✅ 完成状态同步成功');
        } else {
            console.log('❌ 完成状态同步失败');
        }
        
        console.log('\n🔄 测试4: 测试前端查询逻辑...');
        
        // 测试前端查询逻辑
        const user20Todos = await Todo.findByUserIdAndDate(20, testDate);
        const user21Todos = await Todo.findByUserIdAndDate(21, testDate);
        
        console.log(`用户20在${testDate}的TODO:`)
        user20Todos.forEach(t => console.log(`  - ID:${t.id}, 标题:"${t.title}", 完成状态:${t.is_completed_today}`));
        
        console.log(`用户21在${testDate}的TODO:`)
        user21Todos.forEach(t => console.log(`  - ID:${t.id}, 标题:"${t.title}", 完成状态:${t.is_completed_today}`));
        
        // 检查是否都能查询到对方的TODO
        const user20HasUser21Todo = user20Todos.some(t => t.title === todoData2.title);
        const user21HasUser20Todo = user21Todos.some(t => t.title === todoData1.title);
        
        console.log(`用户20能查询到用户21的TODO: ${user20HasUser21Todo ? '✅' : '❌'}`);
        console.log(`用户21能查询到用户20的TODO: ${user21HasUser20Todo ? '✅' : '❌'}`);
        
        console.log('\n=== 测试总结 ===');
        
        const allTestsPassed = 
            syncedTodos1.length === 2 && 
            syncedTodos2.length === 2 && 
            completions.length === 2 && 
            user20HasUser21Todo && 
            user21HasUser20Todo;
        
        if (allTestsPassed) {
            console.log('🎉 所有测试通过！同步功能正常工作');
            console.log('✅ WebSocket TODO创建同步正常');
            console.log('✅ HTTP TODO创建同步正常');
            console.log('✅ 完成状态同步正常');
            console.log('✅ 前端查询逻辑正常');
        } else {
            console.log('❌ 部分测试失败，需要进一步检查');
        }
        
        console.log('\n💡 前端测试建议:');
        console.log('1. 打开两个浏览器窗口，分别登录blackblade和whiteblade');
        console.log('2. 检查WebSocket连接状态和注册消息');
        console.log('3. 在一边创建TODO，检查另一边是否收到同步通知');
        console.log('4. 切换到相应日期，检查是否显示同步的TODO');
        console.log('5. 测试完成状态的实时同步');
        
        // 清理测试数据
        console.log('\n🧹 清理测试数据...');
        await query('DELETE FROM todos WHERE title LIKE ?', ['comprehensive_test_%']);
        await query('DELETE FROM todo_completions WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)');
        
        console.log('✅ 综合同步功能测试完成');
        
    } catch (error) {
        console.error('❌ 综合同步功能测试失败:', error);
        console.error('错误堆栈:', error.stack);
    }
}

comprehensiveSyncTest().then(() => process.exit(0)).catch(console.error);