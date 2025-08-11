// 模拟前端创建TODO的完整流程
const { query } = require('../config/sqlite');
const Todo = require('../models/Todo');
const DataSyncService = require('../services/dataSyncService');

async function simulateTodoCreation() {
    try {
        console.log('=== 模拟前端创建TODO的完整流程 ===');
        
        // 清理之前的测试数据
        console.log('🧹 清理测试数据...');
        await query('DELETE FROM todos WHERE title = ?', ['simulate_test_todo']);
        
        console.log('🔄 步骤1: 模拟前端发送TODO创建请求...');
        
        // 模拟前端发送的数据
        const todoData = {
            user_id: 20, // blackblade的u1
            title: 'simulate_test_todo',
            description: 'Testing complete TODO creation flow',
            reminder_time: '15:00',
            priority: 'high',
            repeat_type: 'daily',
            repeat_interval: 1,
            start_date: '2025-08-11',
            cycle_type: 'long_term'
        };
        
        console.log('前端发送的数据:', todoData);
        
        console.log('🔄 步骤2: 调用Todo.create()...');
        
        // 调用Todo.create()（这是路由中的第一步）
        const todo = await Todo.create(todoData);
        console.log('✅ Todo.create()成功，返回的TODO:', {
            id: todo.id,
            user_id: todo.user_id,
            title: todo.title,
            description: todo.description
        });
        
        console.log('🔄 步骤3: 调用DataSyncService.syncTodoOperation()...');
        
        // 调用同步服务（这是路由中的第二步）
        try {
            await DataSyncService.syncTodoOperation('create', todo, todo.user_id);
            console.log('✅ DataSyncService.syncTodoOperation()成功');
        } catch (syncError) {
            console.error('❌ DataSyncService.syncTodoOperation()失败:', syncError);
            console.error('错误堆栈:', syncError.stack);
        }
        
        console.log('🔄 步骤4: 检查最终结果...');
        
        // 检查数据库中的结果
        const finalTodos = await query('SELECT id, user_id, title FROM todos WHERE title = ? AND is_active = 1', ['simulate_test_todo']);
        console.log('最终数据库中的TODOs:');
        finalTodos.forEach(t => console.log(`  - ID:${t.id}, 用户:${t.user_id}, 标题:"${t.title}"`));
        
        if (finalTodos.length === 1) {
            console.log('❌ 只有1个TODO，同步失败');
        } else if (finalTodos.length === 2) {
            console.log('✅ 有2个TODO，同步成功');
        } else {
            console.log(`🤔 有${finalTodos.length}个TODO，情况异常`);
        }
        
        console.log('\n=== 分析结果 ===');
        
        if (finalTodos.length === 1) {
            console.log('🔍 同步失败的可能原因:');
            console.log('1. DataSyncService.syncTodoOperation()抛出了异常');
            console.log('2. LinkService.syncDataChange()内部失败');
            console.log('3. 数据库操作失败');
            console.log('4. 关联关系有问题');
            
            console.log('\n💡 建议检查:');
            console.log('- 服务器控制台是否有错误日志');
            console.log('- 关联关系是否正确');
            console.log('- 数据库连接是否正常');
        } else {
            console.log('✅ 同步流程正常工作');
            console.log('问题可能在于:');
            console.log('- 前端没有正确调用API');
            console.log('- API路由没有被正确触发');
            console.log('- 中间件拦截了请求');
        }
        
        // 清理测试数据
        console.log('\n🧹 清理测试数据...');
        await query('DELETE FROM todos WHERE title = ?', ['simulate_test_todo']);
        
        console.log('✅ 模拟测试完成');
        
    } catch (error) {
        console.error('❌ 模拟测试失败:', error);
        console.error('错误堆栈:', error.stack);
    }
}

simulateTodoCreation().then(() => process.exit(0)).catch(console.error);