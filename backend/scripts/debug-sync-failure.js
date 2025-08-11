// 调试同步失败的原因
const { query } = require('../config/sqlite');
const LinkService = require('../services/linkService');

async function debugSyncFailure() {
    try {
        console.log('=== 调试同步失败原因 ===');
        
        // 1. 检查关联关系
        console.log('🔍 步骤1: 检查用户关联关系...');
        const links = await query('SELECT * FROM user_links WHERE status = "active"');
        console.log('活跃的关联关系:');
        links.forEach(l => console.log(`  - ID:${l.id}, 管理员:${l.manager_app_user}, 被关联:${l.linked_app_user}, 监管用户ID:${l.supervised_user_id}, 状态:${l.status}`));
        
        if (links.length === 0) {
            console.log('❌ 没有找到活跃的关联关系！这是同步失败的原因。');
            return;
        }
        
        // 2. 检查用户20的关联状态
        console.log('\n🔍 步骤2: 检查用户20的关联状态...');
        const user20Links = await query(`
            SELECT manager_app_user, linked_app_user FROM user_links 
            WHERE supervised_user_id = 20 AND status = 'active'
        `);
        
        if (user20Links.length === 0) {
            console.log('❌ 用户20没有活跃的关联关系！');
        } else {
            console.log('用户20的关联关系:');
            user20Links.forEach(l => console.log(`  - 管理员:${l.manager_app_user}, 被关联:${l.linked_app_user}`));
        }
        
        // 3. 测试getLinkedUserIds方法
        console.log('\n🔍 步骤3: 测试getLinkedUserIds方法...');
        try {
            const targetUserIds = await LinkService.getLinkedUserIds(20, 'blackblade', 'whiteblade');
            console.log('getLinkedUserIds返回的目标用户IDs:', targetUserIds);
            
            if (targetUserIds.length === 0) {
                console.log('❌ getLinkedUserIds返回空数组，这是同步失败的原因！');
                
                // 进一步调试getLinkedUserIds
                console.log('\n🔍 详细调试getLinkedUserIds...');
                
                // 获取原始用户信息
                const originalUser = await query('SELECT username, app_user_id FROM users WHERE id = ?', [20]);
                if (originalUser.length === 0) {
                    console.log('❌ 找不到用户20的信息');
                    return;
                }
                
                const username = originalUser[0].username;
                const originalAppUser = originalUser[0].app_user_id;
                console.log(`原始用户信息: ID=20, 用户名="${username}", App用户="${originalAppUser}"`);
                
                // 查找关联的App用户
                const linkedAppUsers = await query(`
                    SELECT DISTINCT 
                        CASE 
                            WHEN ul.manager_app_user = ? THEN ul.linked_app_user
                            WHEN ul.linked_app_user = ? THEN ul.manager_app_user
                            ELSE NULL
                        END as target_app_user
                    FROM user_links ul
                    WHERE (ul.manager_app_user = ? OR ul.linked_app_user = ?) 
                    AND ul.supervised_user_id = ? 
                    AND ul.status = 'active'
                `, [originalAppUser, originalAppUser, originalAppUser, originalAppUser, 20]);
                
                console.log('查找关联App用户的SQL结果:', linkedAppUsers);
                
                if (linkedAppUsers.length === 0) {
                    console.log('❌ SQL查询没有返回关联的App用户');
                    
                    // 检查SQL查询的各个条件
                    console.log('\n🔍 检查SQL查询条件...');
                    console.log(`  - originalAppUser: "${originalAppUser}"`);
                    console.log(`  - supervisedUserId: 20`);
                    
                    // 检查是否有匹配的记录
                    const debugQuery = await query(`
                        SELECT ul.*, 
                               (ul.manager_app_user = ?) as manager_match,
                               (ul.linked_app_user = ?) as linked_match,
                               (ul.supervised_user_id = ?) as supervised_match,
                               (ul.status = 'active') as status_match
                        FROM user_links ul
                        WHERE ul.supervised_user_id = ?
                    `, [originalAppUser, originalAppUser, 20, 20]);
                    
                    console.log('调试查询结果:');
                    debugQuery.forEach(r => {
                        console.log(`  - 管理员:${r.manager_app_user}(匹配:${r.manager_match}), 被关联:${r.linked_app_user}(匹配:${r.linked_match}), 监管用户:${r.supervised_user_id}(匹配:${r.supervised_match}), 状态:${r.status}(匹配:${r.status_match})`);
                    });
                }
            } else {
                console.log('✅ getLinkedUserIds返回了目标用户，同步应该正常工作');
            }
        } catch (error) {
            console.error('❌ 测试getLinkedUserIds失败:', error);
        }
        
        // 4. 手动触发同步测试
        console.log('\n🔍 步骤4: 手动触发同步测试...');
        try {
            const todoData = {
                title: 'bbb',
                description: '',
                reminder_time: 'all_day',
                priority: 'medium',
                repeat_type: 'none',
                repeat_interval: 1,
                start_date: '2025-08-11',
                cycle_type: 'long_term',
                sort_order: 0,
                is_completed_today: false,
                is_active: true,
                created_at: new Date().toISOString()
            };
            
            console.log('尝试手动同步...');
            await LinkService.syncDataChange('CREATE', 'todos', todoData, 20);
            
            // 检查同步结果
            const afterSyncTodos = await query('SELECT id, user_id, title FROM todos WHERE title = ? AND is_active = 1', ['bbb']);
            console.log('手动同步后的TODOs:');
            afterSyncTodos.forEach(t => console.log(`  - ID:${t.id}, 用户:${t.user_id}, 标题:"${t.title}"`));
            
            if (afterSyncTodos.length > 1) {
                console.log('✅ 手动同步成功！');
            } else {
                console.log('❌ 手动同步也失败了');
            }
            
        } catch (error) {
            console.error('❌ 手动同步测试失败:', error);
        }
        
        console.log('\n✅ 同步失败调试完成');
        
    } catch (error) {
        console.error('❌ 调试同步失败原因失败:', error);
    }
}

debugSyncFailure().then(() => process.exit(0)).catch(console.error);