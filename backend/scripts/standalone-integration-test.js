#!/usr/bin/env node

// 独立集成测试运行器 - 不依赖Jest
const LinkService = require('../services/linkService');
const DataSyncService = require('../services/dataSyncService');
const WebSocketService = require('../services/websocketService');
const { query, testConnection } = require('../config/sqlite');
const http = require('http');
const WebSocket = require('ws');

// 简单的测试框架实现
class SimpleTestFramework {
    constructor() {
        this.tests = [];
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            duration: 0
        };
        this.currentSuite = null;
        this.failedTests = [];
    }
    
    describe(name, fn) {
        this.currentSuite = name;
        console.log(`\n📋 测试套件: ${name}`);
        console.log('-'.repeat(50));
        fn();
    }
    
    test(name, fn) {
        this.tests.push({
            suite: this.currentSuite,
            name,
            fn
        });
    }
    
    async run() {
        const startTime = Date.now();
        
        for (const test of this.tests) {
            this.results.total++;
            
            try {
                console.log(`🧪 运行: ${test.name}`);
                
                // 在每个测试前执行清理
                await beforeEach();
                
                await test.fn();
                this.results.passed++;
                console.log(`✅ 通过: ${test.name}`);
            } catch (error) {
                this.results.failed++;
                this.failedTests.push({
                    suite: test.suite,
                    name: test.name,
                    error: error.message
                });
                console.log(`❌ 失败: ${test.name} - ${error.message}`);
            }
        }
        
        this.results.duration = Date.now() - startTime;
        this.generateReport();
    }
    
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 测试报告');
        console.log('='.repeat(60));
        console.log(`总测试: ${this.results.total}`);
        console.log(`通过: ${this.results.passed}`);
        console.log(`失败: ${this.results.failed}`);
        console.log(`耗时: ${this.results.duration}ms`);
        
        const successRate = this.results.total > 0 
            ? ((this.results.passed / this.results.total) * 100).toFixed(2)
            : 0;
        console.log(`成功率: ${successRate}%`);
        
        if (this.failedTests.length > 0) {
            console.log('\n❌ 失败的测试:');
            this.failedTests.forEach((test, index) => {
                console.log(`${index + 1}. ${test.suite} - ${test.name}`);
                console.log(`   错误: ${test.error}`);
            });
        }
        
        console.log('='.repeat(60));
        
        if (this.results.failed === 0) {
            console.log('🎉 所有测试通过！');
        } else {
            console.log(`💥 有 ${this.results.failed} 个测试失败`);
        }
    }
}

// 创建测试框架实例
const testFramework = new SimpleTestFramework();
const describe = testFramework.describe.bind(testFramework);
const test = testFramework.test.bind(testFramework);

// 断言函数
function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected) {
                throw new Error(`期望 ${expected}，但得到 ${actual}`);
            }
        },
        toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`期望 ${JSON.stringify(expected)}，但得到 ${JSON.stringify(actual)}`);
            }
        },
        toBeDefined: () => {
            if (actual === undefined) {
                throw new Error('期望值已定义，但得到 undefined');
            }
        },
        toHaveLength: (expected) => {
            if (!actual || actual.length !== expected) {
                throw new Error(`期望长度为 ${expected}，但得到 ${actual ? actual.length : 'undefined'}`);
            }
        },
        toContain: (expected) => {
            if (!actual || !actual.includes(expected)) {
                throw new Error(`期望包含 "${expected}"，但在 "${actual}" 中未找到`);
            }
        },
        toBeGreaterThanOrEqual: (expected) => {
            if (actual < expected) {
                throw new Error(`期望 >= ${expected}，但得到 ${actual}`);
            }
        },
        toBeLessThan: (expected) => {
            if (actual >= expected) {
                throw new Error(`期望 < ${expected}，但得到 ${actual}`);
            }
        },
        toBeTruthy: () => {
            if (!actual) {
                throw new Error(`期望真值，但得到 ${actual}`);
            }
        },
        toBeNull: () => {
            if (actual !== null) {
                throw new Error(`期望 null，但得到 ${actual}`);
            }
        }
    };
}

// 全局变量
let testUsers = {};
let testSupervisedUsers = {};
let wsServer;
let wsClients = {};
let testServer;

// 测试数据设置
async function setupTestData() {
    console.log('🔧 设置测试数据...');
    
    // 先清理可能存在的测试数据
    await cleanupTestData();
    
    // 创建测试app_users
    const users = ['mama', 'papa', 'grandma'];
    for (const username of users) {
        await query('INSERT OR IGNORE INTO app_users (username, password_hash) VALUES (?, ?)', 
            [username, `hash_${username}`]);
    }
    
    // 创建测试被监管用户
    const supervisedUsers = [
        { username: 'child1', display_name: '孩子1', app_user: 'mama' },
        { username: 'child2', display_name: '孩子2', app_user: 'mama' },
        { username: 'child3', display_name: '孩子3', app_user: 'papa' }
    ];
    
    for (const user of supervisedUsers) {
        try {
            const result = await query(`
                INSERT INTO users (app_user_id, username, display_name, device_id) 
                VALUES (?, ?, ?, ?)
            `, [user.app_user, user.username, user.display_name, `device_${user.username}`]);
            
            testSupervisedUsers[user.username] = result.insertId;
        } catch (error) {
            // 如果用户已存在，获取其ID
            const existingUser = await query('SELECT id FROM users WHERE username = ? AND app_user_id = ?', 
                [user.username, user.app_user]);
            if (existingUser.length > 0) {
                testSupervisedUsers[user.username] = existingUser[0].id;
                console.log(`📝 使用现有用户: ${user.username} (ID: ${existingUser[0].id})`);
            } else {
                throw error;
            }
        }
    }
    
    console.log('✅ 测试数据设置完成:', testSupervisedUsers);
}

// 清理测试数据
async function cleanupTestData() {
    console.log('🧹 清理测试数据...');
    
    try {
        await query('DELETE FROM user_links');
        await query('DELETE FROM link_requests');
        
        // 检查表结构并清理数据
        try {
            await query('DELETE FROM todos WHERE app_user_id IN (?, ?, ?)', ['mama', 'papa', 'grandma']);
        } catch (error) {
            console.warn('⚠️  清理todos表失败:', error.message);
        }
        
        try {
            await query('DELETE FROM notes WHERE app_user_id IN (?, ?, ?)', ['mama', 'papa', 'grandma']);
        } catch (error) {
            console.warn('⚠️  清理notes表失败:', error.message);
        }
        
        if (Object.keys(testSupervisedUsers).length > 0) {
            const userIds = Object.values(testSupervisedUsers);
            const placeholders = userIds.map(() => '?').join(',');
            await query(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
        }
        
        await query('DELETE FROM app_users WHERE username IN (?, ?, ?)', ['mama', 'papa', 'grandma']);
        
        console.log('✅ 测试数据清理完成');
    } catch (error) {
        console.warn('⚠️  测试数据清理失败:', error.message);
    }
}

// 辅助函数
async function createTestTodo(supervisedUserId, appUser, title = '测试待办事项') {
    const result = await query(`
        INSERT INTO todos (app_user_id, supervised_user_id, title, description, completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [appUser, supervisedUserId, title, '测试描述', 0]);
    
    return result.insertId;
}

async function getTodoFromDatabase(todoId, appUser) {
    const todos = await query('SELECT * FROM todos WHERE id = ? AND app_user_id = ?', [todoId, appUser]);
    return todos[0];
}

// 定义测试
describe('用户关联功能集成测试', () => {
    test('LinkService基本功能测试', async () => {
        // 测试创建关联请求
        const request = await LinkService.createRequest(
            'mama',
            'papa', 
            testSupervisedUsers.child1,
            '测试关联请求'
        );
        
        expect(request).toBeDefined();
        expect(request.from_app_user).toBe('mama');
        expect(request.to_app_user).toBe('papa');
        expect(request.status).toBe('pending');
        
        // 测试获取待处理请求
        const pendingRequests = await LinkService.getPendingRequests('papa');
        expect(pendingRequests).toHaveLength(1);
        expect(pendingRequests[0].from_app_user).toBe('mama');
        
        // 测试接受请求
        const acceptResult = await LinkService.handleRequest(request.id, 'accept', 'papa');
        expect(acceptResult.status).toBe('accepted');
        
        // 验证关联关系已建立
        const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', [testSupervisedUsers.child1]);
        expect(links).toHaveLength(1);
        expect(links[0].status).toBe('active');
    });
    
    test('数据同步功能测试', async () => {
        // 建立关联关系
        const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
        await LinkService.handleRequest(request.id, 'accept', 'papa');
        
        // 创建测试数据
        const todoId = await createTestTodo(testSupervisedUsers.child1, 'mama');
        
        // 触发同步
        await DataSyncService.syncDataChange('create', 'todos', {
            id: todoId,
            supervised_user_id: testSupervisedUsers.child1
        }, testSupervisedUsers.child1);
        
        // 验证数据同步
        const syncedTodo = await getTodoFromDatabase(todoId, 'papa');
        expect(syncedTodo).toBeDefined();
        expect(syncedTodo.supervised_user_id).toBe(testSupervisedUsers.child1);
    });
    
    test('并发关联请求处理', async () => {
        // 同时发起多个关联请求
        const requests = await Promise.all([
            LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1),
            LinkService.createRequest('mama', 'grandma', testSupervisedUsers.child2)
        ]);
        
        expect(requests).toHaveLength(2);
        requests.forEach(request => {
            expect(request.status).toBe('pending');
        });
        
        // 并发处理请求
        const results = await Promise.all([
            LinkService.handleRequest(requests[0].id, 'accept', 'papa'),
            LinkService.handleRequest(requests[1].id, 'accept', 'grandma')
        ]);
        
        expect(results[0].status).toBe('accepted');
        expect(results[1].status).toBe('accepted');
        
        // 验证关联关系数量
        const activeLinks = await query('SELECT * FROM user_links WHERE status = ?', ['active']);
        expect(activeLinks).toHaveLength(2);
    });
    
    test('错误处理测试', async () => {
        // 测试不存在的用户
        try {
            await LinkService.createRequest('mama', 'nonexistent', testSupervisedUsers.child1);
            throw new Error('应该抛出错误');
        } catch (error) {
            expect(error.message).toContain('目标用户不存在');
        }
        
        // 测试重复请求
        await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
        
        try {
            await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            throw new Error('应该抛出错误');
        } catch (error) {
            expect(error.message).toContain('已存在待处理的关联请求');
        }
    });
    
    test('权限验证测试', async () => {
        // 测试管理员权限
        const hasPermission = await LinkService.validateUserPermission('mama', testSupervisedUsers.child1);
        expect(hasPermission).toBe(true);
        
        // 测试无权限用户
        const noPermission = await LinkService.validateUserPermission('nonexistent', testSupervisedUsers.child1);
        expect(noPermission).toBe(false);
    });
    
    test('关联关系取消测试', async () => {
        // 建立关联关系
        const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
        await LinkService.handleRequest(request.id, 'accept', 'papa');
        
        // 获取关联ID
        const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', [testSupervisedUsers.child1]);
        const linkId = links[0].id;
        
        // 取消关联关系
        const cancelResult = await LinkService.cancelLink(linkId, 'mama');
        expect(cancelResult.status).toBe('cancelled');
        
        // 验证关联状态更新
        const updatedLink = await query('SELECT * FROM user_links WHERE id = ?', [linkId]);
        expect(updatedLink[0].status).toBe('cancelled');
    });
    
    test('数据一致性验证', async () => {
        // 建立关联关系
        const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
        await LinkService.handleRequest(request.id, 'accept', 'papa');
        
        // 创建多个测试数据
        const todoIds = [];
        for (let i = 0; i < 5; i++) {
            const todoId = await createTestTodo(testSupervisedUsers.child1, 'mama', `测试待办 ${i}`);
            todoIds.push(todoId);
        }
        
        // 批量同步数据
        const syncPromises = todoIds.map(todoId => 
            DataSyncService.syncDataChange('create', 'todos', {
                id: todoId,
                supervised_user_id: testSupervisedUsers.child1
            }, testSupervisedUsers.child1)
        );
        
        await Promise.all(syncPromises);
        
        // 验证数据一致性
        const mamaTodos = await query('SELECT COUNT(*) as count FROM todos WHERE app_user_id = ? AND supervised_user_id = ?', 
            ['mama', testSupervisedUsers.child1]);
        const papaTodos = await query('SELECT COUNT(*) as count FROM todos WHERE app_user_id = ? AND supervised_user_id = ?', 
            ['papa', testSupervisedUsers.child1]);
        
        expect(mamaTodos[0].count).toBe(papaTodos[0].count);
        expect(mamaTodos[0].count).toBeGreaterThanOrEqual(5);
    });
});

// 主函数
async function main() {
    console.log('🚀 开始运行用户关联功能集成测试');
    console.log('='.repeat(60));
    
    try {
        // 检查数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        console.log('✅ 数据库连接正常');
        
        // 设置测试数据
        await setupTestData();
        
        // 运行测试
        await testFramework.run();
        
        // 清理测试数据
        await cleanupTestData();
        
        // 退出
        process.exit(testFramework.results.failed > 0 ? 1 : 0);
        
    } catch (error) {
        console.error('💥 测试运行失败:', error);
        process.exit(1);
    }
}

// 清理每个测试前的数据
async function beforeEach() {
    try {
        console.log('🧹 开始测试前数据清理...');
        await query('DELETE FROM user_links');
        await query('DELETE FROM link_requests');
        await query('UPDATE users SET is_linked = 0, supervised_app_user = NULL WHERE app_user_id IN (?, ?, ?)', 
            ['mama', 'papa', 'grandma']);
        console.log('✅ 测试前数据清理完成');
    } catch (error) {
        console.warn('⚠️  测试前数据清理失败:', error.message);
    }
}

// beforeEach函数现在在测试框架的run方法中自动调用

// 运行测试
if (require.main === module) {
    main();
}

module.exports = { main };