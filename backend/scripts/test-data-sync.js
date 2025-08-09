// 数据同步功能测试脚本
const { query, testConnection } = require('../config/sqlite');
const DataSyncService = require('../services/dataSyncService');
const LinkService = require('../services/linkService');

// 测试数据
let testData = {
    managerUserId: null,
    linkedUserId: null,
    supervisedUserId: null,
    todoId: null,
    noteId: null
};

// 设置测试数据
async function setupTestData() {
    try {
        console.log('🔧 设置数据同步测试数据...');
        
        // 清理旧数据
        await query('DELETE FROM todo_completions WHERE todo_id IN (SELECT id FROM todos WHERE user_id IN (SELECT id FROM users WHERE app_user_id IN (?, ?)))', ['testmgr', 'testlink']);
        await query('DELETE FROM todos WHERE user_id IN (SELECT id FROM users WHERE app_user_id IN (?, ?))', ['testmgr', 'testlink']);
        await query('DELETE FROM notes WHERE user_id IN (SELECT id FROM users WHERE app_user_id IN (?, ?))', ['testmgr', 'testlink']);
        await query('DELETE FROM user_links WHERE manager_app_user IN (?, ?) OR linked_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM link_requests WHERE from_app_user IN (?, ?) OR to_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM users WHERE app_user_id IN (?, ?)', ['testmgr', 'testlink']);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        
        // 创建测试用户
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testmgr', 'hash1']);
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testlink', 'hash2']);
        
        // 创建被监管用户（管理员）
        const managerResult = await query(`
            INSERT INTO users (app_user_id, username, display_name, device_id) 
            VALUES (?, ?, ?, ?)
        `, ['testmgr', 'testsupervised', '测试被监管用户', 'testdevice']);
        
        testData.supervisedUserId = managerResult.insertId;
        testData.managerUserId = managerResult.insertId;
        
        // 建立关联关系
        const request = await LinkService.createRequest('testmgr', 'testlink', testData.supervisedUserId, '测试同步');
        await LinkService.handleRequest(request.id, 'accept', 'testlink');
        
        // 获取被关联用户的用户ID
        const linkedUser = await query(`
            SELECT id FROM users 
            WHERE app_user_id = ? AND supervised_app_user = ? AND is_linked = 1
        `, ['testlink', 'testlink']);
        
        if (linkedUser.length > 0) {
            testData.linkedUserId = linkedUser[0].id;
        }
        
        console.log(`✅ 数据同步测试数据设置完成`);
        console.log(`  - 管理员用户ID: ${testData.managerUserId}`);
        console.log(`  - 被关联用户ID: ${testData.linkedUserId}`);
        console.log(`  - 被监管用户ID: ${testData.supervisedUserId}`);
        
    } catch (error) {
        console.error('❌ 设置数据同步测试数据失败:', error);
        throw error;
    }
}

// 清理测试数据
async function cleanupTestData() {
    try {
        console.log('🧹 清理数据同步测试数据...');
        
        await query('DELETE FROM todo_completions WHERE todo_id IN (SELECT id FROM todos WHERE user_id IN (SELECT id FROM users WHERE app_user_id IN (?, ?)))', ['testmgr', 'testlink']);
        await query('DELETE FROM todos WHERE user_id IN (SELECT id FROM users WHERE app_user_id IN (?, ?))', ['testmgr', 'testlink']);
        await query('DELETE FROM notes WHERE user_id IN (SELECT id FROM users WHERE app_user_id IN (?, ?))', ['testmgr', 'testlink']);
        await query('DELETE FROM user_links WHERE manager_app_user IN (?, ?) OR linked_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM link_requests WHERE from_app_user IN (?, ?) OR to_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM users WHERE app_user_id IN (?, ?)', ['testmgr', 'testlink']);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        
        console.log('✅ 数据同步测试数据清理完成');
        
    } catch (error) {
        console.error('❌ 清理数据同步测试数据失败:', error);
    }
}

// 测试TODO创建同步
async function testTodoCreateSync() {
    console.log('\n📝 测试1: TODO创建同步...');
    
    try {
        // 创建TODO
        const todoData = {
            user_id: testData.managerUserId,
            title: '测试同步TODO',
            description: '这是一个测试同步的TODO',
            reminder_time: '09:00',
            priority: 'high'
        };
        
        const result = await query(`
            INSERT INTO todos (user_id, title, description, reminder_time, priority)
            VALUES (?, ?, ?, ?, ?)
        `, [todoData.user_id, todoData.title, todoData.description, todoData.reminder_time, todoData.priority]);
        
        testData.todoId = result.insertId;
        
        // 执行同步
        await DataSyncService.syncTodoOperation('create', {
            ...todoData,
            id: testData.todoId
        }, testData.managerUserId);
        
        // 验证同步结果
        const syncedTodos = await query(`
            SELECT * FROM todos 
            WHERE user_id = ? AND title = ?
        `, [testData.linkedUserId, todoData.title]);
        
        if (syncedTodos.length > 0) {
            console.log('✅ TODO创建同步成功');
            console.log('同步的TODO:', syncedTodos[0]);
            return true;
        } else {
            console.log('❌ TODO创建同步失败');
            return false;
        }
        
    } catch (error) {
        console.error('❌ TODO创建同步异常:', error.message);
        return false;
    }
}

// 测试TODO完成同步
async function testTodoCompleteSync() {
    console.log('\n✅ 测试2: TODO完成同步...');
    
    try {
        const date = new Date().toISOString().split('T')[0];
        
        // 标记TODO为完成
        await query(`
            INSERT INTO todo_completions (todo_id, user_id, completion_date, notes)
            VALUES (?, ?, ?, ?)
        `, [testData.todoId, testData.managerUserId, date, '测试完成']);
        
        // 执行同步
        await DataSyncService.syncTodoOperation('complete', {
            originalTodoId: testData.todoId,
            date: date,
            notes: '测试完成',
            title: '测试同步TODO'
        }, testData.managerUserId);
        
        // 验证同步结果
        const syncedCompletions = await query(`
            SELECT tc.* FROM todo_completions tc
            JOIN todos t ON tc.todo_id = t.id
            WHERE t.user_id = ? AND t.title = ? AND tc.completion_date = ?
        `, [testData.linkedUserId, '测试同步TODO', date]);
        
        if (syncedCompletions.length > 0) {
            console.log('✅ TODO完成同步成功');
            console.log('同步的完成记录:', syncedCompletions[0]);
            return true;
        } else {
            console.log('❌ TODO完成同步失败');
            return false;
        }
        
    } catch (error) {
        console.error('❌ TODO完成同步异常:', error.message);
        return false;
    }
}

// 测试Notes创建同步
async function testNotesCreateSync() {
    console.log('\n📄 测试3: Notes创建同步...');
    
    try {
        // 创建Note
        const noteData = {
            user_id: testData.managerUserId,
            title: '测试同步Note',
            description: '这是一个测试同步的Note',
            precautions: '注意事项'
        };
        
        const result = await query(`
            INSERT INTO notes (user_id, title, description, precautions)
            VALUES (?, ?, ?, ?)
        `, [noteData.user_id, noteData.title, noteData.description, noteData.precautions]);
        
        testData.noteId = result.insertId;
        
        // 执行同步
        await DataSyncService.syncNotesOperation('create', {
            ...noteData,
            id: testData.noteId
        }, testData.managerUserId);
        
        // 验证同步结果
        const syncedNotes = await query(`
            SELECT * FROM notes 
            WHERE user_id = ? AND title = ?
        `, [testData.linkedUserId, noteData.title]);
        
        if (syncedNotes.length > 0) {
            console.log('✅ Notes创建同步成功');
            console.log('同步的Note:', syncedNotes[0]);
            return true;
        } else {
            console.log('❌ Notes创建同步失败');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Notes创建同步异常:', error.message);
        return false;
    }
}

// 测试数据完整性验证
async function testDataIntegrityValidation() {
    console.log('\n🔍 测试4: 数据完整性验证...');
    
    try {
        const managerIntegrity = await DataSyncService.validateDataIntegrity(testData.managerUserId);
        const linkedIntegrity = await DataSyncService.validateDataIntegrity(testData.linkedUserId);
        
        console.log('管理员数据完整性:', managerIntegrity);
        console.log('被关联用户数据完整性:', linkedIntegrity);
        
        // 验证数据是否一致
        if (managerIntegrity.todos === linkedIntegrity.todos && 
            managerIntegrity.notes === linkedIntegrity.notes) {
            console.log('✅ 数据完整性验证成功');
            return true;
        } else {
            console.log('❌ 数据完整性验证失败');
            return false;
        }
        
    } catch (error) {
        console.error('❌ 数据完整性验证异常:', error.message);
        return false;
    }
}

// 测试同步统计信息
async function testSyncStats() {
    console.log('\n📊 测试5: 同步统计信息...');
    
    try {
        const stats = await DataSyncService.getSyncStats();
        
        console.log('同步统计信息:', stats);
        
        if (stats && stats.activeLinks > 0) {
            console.log('✅ 同步统计信息获取成功');
            return true;
        } else {
            console.log('❌ 同步统计信息获取失败');
            return false;
        }
        
    } catch (error) {
        console.error('❌ 同步统计信息异常:', error.message);
        return false;
    }
}

// 运行数据同步测试
async function runDataSyncTests() {
    try {
        console.log('🧪 开始数据同步功能测试...');
        
        // 检查数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 设置测试数据
        await setupTestData();
        
        if (!testData.linkedUserId) {
            throw new Error('被关联用户创建失败');
        }
        
        const tests = [
            testTodoCreateSync,
            testTodoCompleteSync,
            testNotesCreateSync,
            testDataIntegrityValidation,
            testSyncStats
        ];
        
        let passedTests = 0;
        
        for (const test of tests) {
            try {
                const result = await test();
                if (result) {
                    passedTests++;
                }
                
                // 测试间隔
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`❌ 测试执行失败:`, error.message);
            }
        }
        
        console.log(`\n📊 数据同步测试结果: ${passedTests}/${tests.length} 通过`);
        
        if (passedTests === tests.length) {
            console.log('🎉 所有数据同步测试通过！');
            return true;
        } else {
            console.log('⚠️  部分数据同步测试失败');
            return false;
        }
        
    } catch (error) {
        console.error('❌ 数据同步测试套件失败:', error);
        return false;
    } finally {
        // 清理测试数据
        await cleanupTestData();
    }
}

// 主函数
async function main() {
    const success = await runDataSyncTests();
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = { runDataSyncTests };