// 测试前端数据查询
const { query } = require('../config/sqlite');
const Todo = require('../models/Todo');

async function testFrontendQuery() {
    try {
        console.log('=== 测试前端数据查询 ===');
        
        const testDate = '2025-08-11';
        
        console.log(`🔍 测试用户21在${testDate}的TODO查询...`);
        
        // 模拟前端调用Todo.findByUserIdAndDate
        const user21Todos = await Todo.findByUserIdAndDate(21, testDate);
        
        console.log(`用户21在${testDate}的TODO:`)
        user21Todos.forEach(t => {
            console.log(`  - ID:${t.id}, 标题:"${t.title}", 描述:"${t.description}", 完成状态:${t.is_completed_today}`);
        });
        
        // 检查是否包含"bbb" TODO
        const bbbTodo = user21Todos.find(t => t.title === 'bbb');
        if (bbbTodo) {
            console.log('✅ 用户21能查询到"bbb" TODO');
            console.log('详细信息:', {
                id: bbbTodo.id,
                title: bbbTodo.title,
                description: bbbTodo.description,
                reminder_time: bbbTodo.reminder_time,
                priority: bbbTodo.priority,
                repeat_type: bbbTodo.repeat_type,
                start_date: bbbTodo.start_date,
                is_completed_today: bbbTodo.is_completed_today
            });
        } else {
            console.log('❌ 用户21查询不到"bbb" TODO');
            console.log('可能的原因:');
            console.log('1. TODO的开始日期不匹配');
            console.log('2. TODO被标记为不活跃');
            console.log('3. 重复规则不匹配');
            console.log('4. 有删除记录');
        }
        
        console.log(`\n🔍 测试用户20在${testDate}的TODO查询...`);
        
        // 测试用户20的查询
        const user20Todos = await Todo.findByUserIdAndDate(20, testDate);
        
        console.log(`用户20在${testDate}的TODO:`)
        user20Todos.forEach(t => {
            console.log(`  - ID:${t.id}, 标题:"${t.title}", 描述:"${t.description}", 完成状态:${t.is_completed_today}`);
        });
        
        // 检查原始"bbb" TODO
        const originalBbbTodo = user20Todos.find(t => t.title === 'bbb');
        if (originalBbbTodo) {
            console.log('✅ 用户20能查询到原始"bbb" TODO');
        } else {
            console.log('❌ 用户20查询不到原始"bbb" TODO');
        }
        
        console.log('\n🔍 直接查询数据库中的"bbb" TODO...');
        
        // 直接查询数据库
        const dbTodos = await query(`
            SELECT t.*, 
                   CASE WHEN tc.completion_date IS NOT NULL THEN 1 ELSE 0 END as is_completed_today
            FROM todos t
            LEFT JOIN todo_completions tc ON t.id = tc.todo_id AND tc.completion_date = ?
            WHERE t.title = 'bbb' AND t.is_active = 1
        `, [testDate]);
        
        console.log('数据库中的"bbb" TODO:');
        dbTodos.forEach(t => {
            console.log(`  - ID:${t.id}, 用户:${t.user_id}, 标题:"${t.title}", 开始日期:${t.start_date}, 重复类型:${t.repeat_type}, 完成状态:${t.is_completed_today}`);
        });
        
        console.log('\n🔍 检查删除记录...');
        
        // 检查是否有删除记录
        const deletions = await query(`
            SELECT td.*, t.title, t.user_id
            FROM todo_deletions td
            JOIN todos t ON td.todo_id = t.id
            WHERE t.title = 'bbb'
        `);
        
        if (deletions.length > 0) {
            console.log('发现删除记录:');
            deletions.forEach(d => {
                console.log(`  - TODO ID:${d.todo_id}, 用户:${d.user_id}, 删除日期:${d.deletion_date}, 删除类型:${d.deletion_type}`);
            });
        } else {
            console.log('没有删除记录');
        }
        
        console.log('\n=== 结论 ===');
        
        if (bbbTodo && originalBbbTodo) {
            console.log('✅ 后端查询完全正常，两个用户都能查询到"bbb" TODO');
            console.log('问题在前端:');
            console.log('1. 前端可能没有正确调用API');
            console.log('2. 前端缓存问题');
            console.log('3. WebSocket通知没有触发前端重新加载');
            console.log('4. 前端UI渲染问题');
        } else {
            console.log('❌ 后端查询有问题');
        }
        
        console.log('\n💡 建议检查:');
        console.log('1. 前端控制台是否有API调用错误');
        console.log('2. Network标签中的API请求是否成功');
        console.log('3. 前端是否收到WebSocket通知');
        console.log('4. 前端缓存是否被正确清理');
        
        console.log('\n✅ 前端查询测试完成');
        
    } catch (error) {
        console.error('❌ 前端查询测试失败:', error);
    }
}

testFrontendQuery().then(() => process.exit(0)).catch(console.error);