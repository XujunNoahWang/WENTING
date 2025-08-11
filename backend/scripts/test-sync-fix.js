// 测试同步修复效果的脚本
const { query } = require('../config/sqlite');
const DataSyncService = require('../services/dataSyncService');

async function testSyncFix() {
    try {
        console.log('=== 测试同步修复效果 ===');
        
        // 清理测试数据
        console.log('🧹 清理旧的测试数据...');
        await query('DELETE FROM todos WHERE title LIKE ?', ['sync_fix_test_%']);
        await query('DELETE FROM todo_completions WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)');
        
        console.log('🔄 步骤1: 模拟blackblade创建TODO...');
        
        // 创建测试TODO
        const testDate = '2025-08-12';
        const todoData = {
            user_id: 20,
            title: 'sync_fix_test_todo',
            description: 'Testing sync fix on Aug 12',
            reminder_time: '14:00',
            priority: 'high',
            repeat_type: 'daily',
            repeat_interval: 1,
            start_date: testDate,
            cycle_type: 'long_term'
        };
        
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
        
        console.log('🔄 步骤2: 触发同步和WebSocket通知...');
        
        // 触发同步（这会发送WebSocket通知）
        await DataSyncService.syncTodoOperation('create', {
            ...todoData,
            id: todoId
        }, todoData.user_id);
        
        console.log('✅ 同步和WebSocket通知已发送');
        
        console.log('🔄 步骤3: 模拟完成状态同步...');
        
        // 标记为完成
        await query(`
            INSERT OR REPLACE INTO todo_completions (todo_id, user_id, completion_date, notes)
            VALUES (?, ?, ?, ?)
        `, [todoId, todoData.user_id, testDate, 'Sync fix test completion']);
        
        // 触发完成状态同步
        await DataSyncService.syncTodoOperation('complete', {
            originalTodoId: todoId,
            title: todoData.title,
            date: testDate,
            notes: 'Sync fix test completion'
        }, todoData.user_id);
        
        console.log('✅ 完成状态同步和WebSocket通知已发送');
        
        console.log('🔄 步骤4: 验证同步结果...');
        
        // 检查同步结果
        const syncedTodos = await query('SELECT id, user_id, title FROM todos WHERE title = ? AND is_active = 1', [todoData.title]);
        console.log('\n同步后的TODOs:');
        syncedTodos.forEach(t => console.log(`  - ID:${t.id}, 用户ID:${t.user_id}, 标题:${t.title}`));
        
        const completions = await query(`
            SELECT tc.*, t.user_id 
            FROM todo_completions tc
            JOIN todos t ON tc.todo_id = t.id
            WHERE t.title = ? AND tc.completion_date = ?
        `, [todoData.title, testDate]);
        
        console.log('\n完成记录:');
        completions.forEach(c => console.log(`  - TODO ID:${c.todo_id}, 用户ID:${c.user_id}, 日期:${c.completion_date}`));
        
        console.log('\n=== 前端测试指南 ===');
        console.log('现在请在浏览器中测试以下内容:');
        console.log('');
        console.log('1. 打开两个浏览器窗口/标签页');
        console.log('2. 分别登录blackblade和whiteblade');
        console.log('3. 在控制台检查以下内容:');
        console.log('   - "✅ WebSocket连接已建立"');
        console.log('   - "📝 用户注册消息已发送"');
        console.log('   - localStorage.getItem("wenting_current_app_user")');
        console.log('   - window.GlobalUserState.getAppUserId()');
        console.log('   - WebSocketClient.isConnected');
        console.log('');
        console.log('4. 测试实时同步:');
        console.log('   - 在blackblade中创建一个TODO');
        console.log('   - 立即检查whiteblade控制台是否有:');
        console.log('     * "🔄 收到同步消息: TODO_SYNC_UPDATE"');
        console.log('     * "🧹 清除TODO缓存"');
        console.log('     * "✅ TODO数据重新加载完成"');
        console.log('   - 切换到相应日期查看是否显示新TODO');
        console.log('');
        console.log('5. 测试完成状态同步:');
        console.log('   - 在一边完成TODO');
        console.log('   - 检查另一边是否实时更新完成状态');
        console.log('');
        console.log('如果仍有问题，请检查:');
        console.log('- Network标签中是否有WebSocket连接');
        console.log('- Console中是否有WebSocket错误');
        console.log('- 是否有"⚠️ app用户 xxx 当前没有活跃连接"的消息');
        
        // 清理测试数据
        console.log('\n🧹 清理测试数据...');
        await query('DELETE FROM todos WHERE title LIKE ?', ['sync_fix_test_%']);
        await query('DELETE FROM todo_completions WHERE todo_id NOT IN (SELECT id FROM todos WHERE is_active = 1)');
        
        console.log('✅ 同步修复测试完成');
        
    } catch (error) {
        console.error('❌ 同步修复测试失败:', error);
    }
}

testSyncFix().then(() => process.exit(0)).catch(console.error);