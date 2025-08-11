// 测试WebSocket通知功能
const { query } = require('../config/sqlite');
const DataSyncService = require('../services/dataSyncService');

async function testWebSocketNotification() {
    try {
        console.log('=== 测试WebSocket通知功能 ===');
        
        // 创建一个测试TODO
        const testDate = '2025-08-12';
        const todoData = {
            user_id: 20,
            title: 'websocket_test_todo',
            description: 'Testing WebSocket notifications',
            reminder_time: '10:00',
            priority: 'medium',
            repeat_type: 'daily',
            repeat_interval: 1,
            start_date: testDate,
            cycle_type: 'long_term'
        };
        
        console.log('🔄 步骤1: 创建测试TODO...');
        const result = await query(`
            INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, 
                             repeat_interval, start_date, end_date, cycle_type, cycle_duration, 
                             cycle_unit, sort_order, is_completed_today, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            todoData.user_id, todoData.title, todoData.description, todoData.reminder_time, todoData.priority,
            todoData.repeat_type, todoData.repeat_interval, todoData.start_date, null,
            todoData.cycle_type, null, 'days', 0, false, true, new Date().toISOString()
        ]);
        
        const todoId = result.insertId;
        console.log(`✅ 创建TODO成功，ID: ${todoId}`);
        
        console.log('🔄 步骤2: 测试TODO创建的WebSocket通知...');
        
        // 直接调用DataSyncService的同步方法，这会触发WebSocket通知
        await DataSyncService.syncTodoOperation('create', {
            ...todoData,
            id: todoId
        }, todoData.user_id);
        
        console.log('✅ TODO创建同步和WebSocket通知已发送');
        
        console.log('🔄 步骤3: 测试TODO完成的WebSocket通知...');
        
        // 标记TODO为完成
        await query(`
            INSERT OR REPLACE INTO todo_completions (todo_id, user_id, completion_date, notes)
            VALUES (?, ?, ?, ?)
        `, [todoId, todoData.user_id, testDate, 'WebSocket test completion']);
        
        // 触发完成状态同步和WebSocket通知
        await DataSyncService.syncTodoOperation('complete', {
            originalTodoId: todoId,
            title: todoData.title,
            date: testDate,
            notes: 'WebSocket test completion'
        }, todoData.user_id);
        
        console.log('✅ TODO完成同步和WebSocket通知已发送');
        
        console.log('🔄 步骤4: 测试TODO取消完成的WebSocket通知...');
        
        // 取消完成状态
        await query('DELETE FROM todo_completions WHERE todo_id = ? AND completion_date = ?', [todoId, testDate]);
        
        // 触发取消完成状态同步和WebSocket通知
        await DataSyncService.syncTodoOperation('uncomplete', {
            originalTodoId: todoId,
            title: todoData.title,
            date: testDate
        }, todoData.user_id);
        
        console.log('✅ TODO取消完成同步和WebSocket通知已发送');
        
        console.log('🔄 步骤5: 测试TODO删除的WebSocket通知...');
        
        // 删除TODO
        await query('UPDATE todos SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [todoId]);
        
        // 触发删除同步和WebSocket通知
        await DataSyncService.syncTodoOperation('delete', {
            originalTodoId: todoId,
            title: todoData.title,
            deletionType: 'all'
        }, todoData.user_id);
        
        console.log('✅ TODO删除同步和WebSocket通知已发送');
        
        console.log('\n=== WebSocket通知测试完成 ===');
        console.log('📡 如果WebSocket服务正在运行，关联用户应该收到以下通知:');
        console.log('   1. TODO_SYNC_UPDATE (CREATE)');
        console.log('   2. TODO_SYNC_UPDATE (COMPLETE)');
        console.log('   3. TODO_SYNC_UPDATE (UNCOMPLETE)');
        console.log('   4. TODO_SYNC_UPDATE (DELETE)');
        console.log('');
        console.log('🔍 检查前端控制台是否有以下日志:');
        console.log('   - 🔗 收到Link同步更新: ...');
        console.log('   - 🔄 收到同步消息: TODO_SYNC_UPDATE...');
        console.log('   - 🔄 重新加载TODO数据');
        console.log('   - 🧹 开始清除所有相关缓存...');
        
        // 清理测试数据
        console.log('\n🧹 清理测试数据...');
        await query('DELETE FROM todos WHERE title = ?', [todoData.title]);
        await query('DELETE FROM todo_completions WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)');
        
        console.log('✅ WebSocket通知测试完成');
        
    } catch (error) {
        console.error('❌ WebSocket通知测试失败:', error);
    }
}

testWebSocketNotification().then(() => process.exit(0)).catch(console.error);