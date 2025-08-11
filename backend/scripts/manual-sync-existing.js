// 手动同步现有数据的脚本
const { query } = require('../config/sqlite');
const LinkService = require('../services/linkService');

async function manualSyncExisting() {
    try {
        console.log('=== 手动同步现有数据 ===');
        
        // 获取所有活跃的TODOs
        const todos = await query('SELECT * FROM todos WHERE is_active = 1');
        console.log(`找到 ${todos.length} 个活跃的TODOs`);
        
        for (const todo of todos) {
            console.log(`\n🔄 处理TODO: ID ${todo.id}, 用户 ${todo.user_id}, 标题 "${todo.title}"`);
            
            // 检查这个用户是否有关联关系
            const links = await query(`
                SELECT manager_app_user, linked_app_user FROM user_links 
                WHERE supervised_user_id = ? AND status = 'active'
            `, [todo.user_id]);
            
            if (links.length === 0) {
                console.log(`  ⏸️ 用户 ${todo.user_id} 没有关联关系，跳过`);
                continue;
            }
            
            console.log(`  🔗 用户 ${todo.user_id} 有 ${links.length} 个关联关系`);
            
            // 获取关联的目标用户ID
            const targetUserIds = await LinkService.getLinkedUserIds(todo.user_id, links[0].manager_app_user, links[0].linked_app_user);
            console.log(`  🎯 目标用户IDs: ${targetUserIds}`);
            
            if (targetUserIds.length === 0) {
                console.log(`  ⚠️ 没有找到目标用户，跳过`);
                continue;
            }
            
            // 检查目标用户是否已经有这个TODO
            for (const targetUserId of targetUserIds) {
                const existingTodos = await query(`
                    SELECT id FROM todos 
                    WHERE user_id = ? AND title = ? AND is_active = 1
                `, [targetUserId, todo.title]);
                
                if (existingTodos.length === 0) {
                    console.log(`  ➕ 为用户 ${targetUserId} 创建TODO "${todo.title}"`);
                    
                    // 创建TODO
                    await query(`
                        INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, 
                                         repeat_interval, start_date, end_date, cycle_type, cycle_duration, 
                                         cycle_unit, sort_order, is_completed_today, is_active, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        targetUserId, todo.title, todo.description, todo.reminder_time, todo.priority,
                        todo.repeat_type, todo.repeat_interval, todo.start_date, todo.end_date,
                        todo.cycle_type, todo.cycle_duration, todo.cycle_unit, todo.sort_order,
                        todo.is_completed_today, todo.is_active, todo.created_at
                    ]);
                    
                    console.log(`  ✅ 已为用户 ${targetUserId} 创建TODO`);
                } else {
                    console.log(`  ✅ 用户 ${targetUserId} 已有此TODO，跳过`);
                }
            }
        }
        
        console.log('\n=== 同步完成，检查结果 ===');
        
        // 检查最终结果
        const finalTodos = await query('SELECT id, user_id, title FROM todos WHERE is_active = 1 ORDER BY user_id, title');
        console.log('\n最终的TODOs:');
        finalTodos.forEach(t => console.log(`  - ID:${t.id}, 用户ID:${t.user_id}, 标题:${t.title}`));
        
    } catch (error) {
        console.error('❌ 手动同步失败:', error);
    }
}

manualSyncExisting().then(() => process.exit(0)).catch(console.error);