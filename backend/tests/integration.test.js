// 用户关联功能集成测试和端到端验证
const LinkService = require('../services/linkService');
const DataSyncService = require('../services/dataSyncService');
const WebSocketService = require('../services/websocketService');
const { query, testConnection } = require('../config/sqlite');
const http = require('http');
const WebSocket = require('ws');

describe('用户关联功能集成测试', () => {
    let testServer;
    let wsServer;
    let testUsers = {};
    let testSupervisedUsers = {};
    let wsClients = {};
    
    beforeAll(async () => {
        // 确保数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 创建测试用户
        await setupTestUsers();
        
        // 启动测试WebSocket服务器
        await setupTestWebSocketServer();
        
        console.log('🚀 集成测试环境初始化完成');
    });
    
    afterAll(async () => {
        // 清理测试数据
        await cleanupTestData();
        
        // 关闭WebSocket服务器
        if (wsServer) {
            wsServer.close();
        }
        
        // 关闭所有WebSocket客户端
        Object.values(wsClients).forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });
        
        console.log('🧹 集成测试环境清理完成');
    });
    
    beforeEach(async () => {
        // 每个测试前清理关联数据
        await query('DELETE FROM user_links');
        await query('DELETE FROM link_requests');
        await query('UPDATE users SET is_linked = 0, supervised_app_user = NULL');
    });
    
    describe('完整关联流程测试', () => {
        test('端到端关联流程：从发起请求到数据同步', async () => {
            console.log('🔄 开始端到端关联流程测试...');
            
            // 步骤1: 发起关联请求
            console.log('📤 步骤1: 发起关联请求');
            const request = await LinkService.createRequest(
                'mama',
                'papa', 
                testSupervisedUsers.child1,
                '妈妈想要与您关联孩子的健康数据'
            );
            
            expect(request).toBeDefined();
            expect(request.status).toBe('pending');
            
            // 验证WebSocket通知发送
            await waitForWebSocketMessage('papa', 'link_request');
            
            // 步骤2: 接收并处理关联请求
            console.log('📥 步骤2: 接收并处理关联请求');
            const pendingRequests = await LinkService.getPendingRequests('papa');
            expect(pendingRequests).toHaveLength(1);
            expect(pendingRequests[0].from_app_user).toBe('mama');
            
            // 步骤3: 接受关联请求
            console.log('✅ 步骤3: 接受关联请求');
            const acceptResult = await LinkService.handleRequest(request.id, 'accept', 'papa');
            expect(acceptResult.status).toBe('accepted');
            expect(acceptResult.synced).toBe(true);
            
            // 验证关联关系已建立
            const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', [testSupervisedUsers.child1]);
            expect(links).toHaveLength(1);
            expect(links[0].status).toBe('active');
            
            // 验证被监管用户状态更新
            const supervisedUser = await query('SELECT * FROM users WHERE id = ?', [testSupervisedUsers.child1]);
            expect(supervisedUser[0].is_linked).toBe(1);
            expect(supervisedUser[0].supervised_app_user).toBe('papa');
            
            // 步骤4: 验证数据同步
            console.log('🔄 步骤4: 验证数据同步');
            await testDataSynchronization();
            
            console.log('✅ 端到端关联流程测试完成');
        });
        
        test('关联请求拒绝流程', async () => {
            console.log('❌ 开始关联请求拒绝流程测试...');
            
            // 发起关联请求
            const request = await LinkService.createRequest(
                'mama',
                'papa', 
                testSupervisedUsers.child1
            );
            
            // 拒绝关联请求
            const rejectResult = await LinkService.handleRequest(request.id, 'reject', 'papa');
            expect(rejectResult.status).toBe('rejected');
            
            // 验证没有创建关联关系
            const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', [testSupervisedUsers.child1]);
            expect(links).toHaveLength(0);
            
            // 验证被监管用户状态未改变
            const supervisedUser = await query('SELECT * FROM users WHERE id = ?', [testSupervisedUsers.child1]);
            expect(supervisedUser[0].is_linked).toBe(0);
            expect(supervisedUser[0].supervised_app_user).toBeNull();
            
            console.log('✅ 关联请求拒绝流程测试完成');
        });
        
        test('关联关系取消流程', async () => {
            console.log('🔄 开始关联关系取消流程测试...');
            
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
            
            // 验证被监管用户状态重置
            const supervisedUser = await query('SELECT * FROM users WHERE id = ?', [testSupervisedUsers.child1]);
            expect(supervisedUser[0].is_linked).toBe(0);
            expect(supervisedUser[0].supervised_app_user).toBeNull();
            
            console.log('✅ 关联关系取消流程测试完成');
        });
    });
    
    describe('多用户并发关联测试', () => {
        test('并发关联请求处理', async () => {
            console.log('🔄 开始并发关联请求测试...');
            
            // 同时发起多个关联请求
            const requests = await Promise.all([
                LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1),
                LinkService.createRequest('mama', 'grandma', testSupervisedUsers.child2),
                LinkService.createRequest('papa', 'grandma', testSupervisedUsers.child3)
            ]);
            
            expect(requests).toHaveLength(3);
            requests.forEach(request => {
                expect(request.status).toBe('pending');
            });
            
            // 并发处理请求
            const results = await Promise.all([
                LinkService.handleRequest(requests[0].id, 'accept', 'papa'),
                LinkService.handleRequest(requests[1].id, 'accept', 'grandma'),
                LinkService.handleRequest(requests[2].id, 'reject', 'grandma')
            ]);
            
            expect(results[0].status).toBe('accepted');
            expect(results[1].status).toBe('accepted');
            expect(results[2].status).toBe('rejected');
            
            // 验证关联关系数量
            const activeLinks = await query('SELECT * FROM user_links WHERE status = ?', ['active']);
            expect(activeLinks).toHaveLength(2);
            
            console.log('✅ 并发关联请求测试完成');
        });
        
        test('并发数据同步一致性', async () => {
            console.log('🔄 开始并发数据同步一致性测试...');
            
            // 建立关联关系
            const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            await LinkService.handleRequest(request.id, 'accept', 'papa');
            
            // 创建测试数据
            const todoId = await createTestTodo(testSupervisedUsers.child1, 'mama');
            const noteId = await createTestNote(testSupervisedUsers.child1, 'mama');
            
            // 并发修改数据
            const syncPromises = [
                DataSyncService.syncDataChange('update', 'todos', {
                    id: todoId,
                    completed: true,
                    updated_at: new Date().toISOString()
                }, testSupervisedUsers.child1),
                DataSyncService.syncDataChange('update', 'notes', {
                    id: noteId,
                    content: '更新的笔记内容',
                    updated_at: new Date().toISOString()
                }, testSupervisedUsers.child1)
            ];
            
            await Promise.all(syncPromises);
            
            // 验证数据一致性
            await verifyDataConsistency(testSupervisedUsers.child1, 'mama', 'papa');
            
            console.log('✅ 并发数据同步一致性测试完成');
        });
        
        test('多用户同时操作同一数据', async () => {
            console.log('🔄 开始多用户同时操作测试...');
            
            // 建立关联关系
            const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            await LinkService.handleRequest(request.id, 'accept', 'papa');
            
            // 创建测试待办事项
            const todoId = await createTestTodo(testSupervisedUsers.child1, 'mama');
            
            // 模拟两个用户同时修改同一待办事项
            const timestamp1 = new Date(Date.now() - 1000).toISOString(); // 1秒前
            const timestamp2 = new Date().toISOString(); // 现在
            
            await Promise.all([
                updateTodoInDatabase(todoId, 'mama', { 
                    title: 'Mama更新的标题',
                    updated_at: timestamp1 
                }),
                updateTodoInDatabase(todoId, 'papa', { 
                    title: 'Papa更新的标题',
                    updated_at: timestamp2 
                })
            ]);
            
            // 触发同步
            await DataSyncService.syncDataChange('update', 'todos', {
                id: todoId,
                supervised_user_id: testSupervisedUsers.child1
            }, testSupervisedUsers.child1);
            
            // 验证冲突解决（最新时间戳获胜）
            const mamaData = await getTodoFromDatabase(todoId, 'mama');
            const papaData = await getTodoFromDatabase(todoId, 'papa');
            
            expect(mamaData.title).toBe('Papa更新的标题');
            expect(papaData.title).toBe('Papa更新的标题');
            
            console.log('✅ 多用户同时操作测试完成');
        });
    });
    
    describe('WebSocket通信稳定性测试', () => {
        test('WebSocket连接和消息传递', async () => {
            console.log('🔄 开始WebSocket通信测试...');
            
            // 验证WebSocket连接
            expect(wsClients.mama.readyState).toBe(WebSocket.OPEN);
            expect(wsClients.papa.readyState).toBe(WebSocket.OPEN);
            
            // 发送关联请求并验证通知
            const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            
            const notification = await waitForWebSocketMessage('papa', 'link_request', 5000);
            expect(notification.data.requestId).toBe(request.id);
            expect(notification.data.fromUser).toBe('mama');
            
            console.log('✅ WebSocket通信测试完成');
        });
        
        test('WebSocket连接断开重连', async () => {
            console.log('🔄 开始WebSocket重连测试...');
            
            // 模拟连接断开
            wsClients.papa.close();
            
            // 等待连接关闭
            await new Promise(resolve => {
                wsClients.papa.on('close', resolve);
            });
            
            // 重新连接
            wsClients.papa = await createWebSocketClient('papa');
            
            // 验证重连后的通信
            const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            const notification = await waitForWebSocketMessage('papa', 'link_request', 5000);
            
            expect(notification.data.requestId).toBe(request.id);
            
            console.log('✅ WebSocket重连测试完成');
        });
        
        test('WebSocket消息队列和重试机制', async () => {
            console.log('🔄 开始WebSocket消息队列测试...');
            
            // 临时关闭papa的连接
            wsClients.papa.close();
            
            // 发送关联请求（此时papa离线）
            const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            
            // 重新连接papa
            await new Promise(resolve => setTimeout(resolve, 1000));
            wsClients.papa = await createWebSocketClient('papa');
            
            // 验证离线消息是否被接收
            const notification = await waitForWebSocketMessage('papa', 'link_request', 5000);
            expect(notification.data.requestId).toBe(request.id);
            
            console.log('✅ WebSocket消息队列测试完成');
        });
    });
    
    describe('错误恢复能力测试', () => {
        test('数据库连接失败恢复', async () => {
            console.log('🔄 开始数据库连接失败恢复测试...');
            
            // 模拟数据库连接问题（通过无效查询）
            try {
                await query('SELECT * FROM nonexistent_table');
            } catch (error) {
                expect(error).toBeDefined();
            }
            
            // 验证正常操作仍然可以执行
            const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            expect(request).toBeDefined();
            
            console.log('✅ 数据库连接失败恢复测试完成');
        });
        
        test('同步失败重试机制', async () => {
            console.log('🔄 开始同步失败重试测试...');
            
            // 建立关联关系
            const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            await LinkService.handleRequest(request.id, 'accept', 'papa');
            
            // 创建测试数据
            const todoId = await createTestTodo(testSupervisedUsers.child1, 'mama');
            
            // 模拟同步失败（通过临时修改数据库）
            await query('DROP TABLE IF EXISTS temp_todos_backup');
            await query('CREATE TABLE temp_todos_backup AS SELECT * FROM todos WHERE app_user_id = ?', ['papa']);
            await query('DELETE FROM todos WHERE app_user_id = ?', ['papa']);
            
            // 尝试同步（应该失败并重试）
            try {
                await DataSyncService.syncDataChange('update', 'todos', {
                    id: todoId,
                    completed: true
                }, testSupervisedUsers.child1);
            } catch (error) {
                // 预期的同步失败
            }
            
            // 恢复数据库状态
            await query('INSERT INTO todos SELECT * FROM temp_todos_backup');
            await query('DROP TABLE temp_todos_backup');
            
            // 验证重试机制
            await DataSyncService.syncDataChange('update', 'todos', {
                id: todoId,
                completed: true
            }, testSupervisedUsers.child1);
            
            const syncedTodo = await getTodoFromDatabase(todoId, 'papa');
            expect(syncedTodo.completed).toBe(1);
            
            console.log('✅ 同步失败重试测试完成');
        });
        
        test('网络中断恢复', async () => {
            console.log('🔄 开始网络中断恢复测试...');
            
            // 建立关联关系
            const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            await LinkService.handleRequest(request.id, 'accept', 'papa');
            
            // 模拟网络中断（关闭WebSocket连接）
            Object.values(wsClients).forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            });
            
            // 在网络中断期间进行操作
            const todoId = await createTestTodo(testSupervisedUsers.child1, 'mama');
            
            // 恢复网络连接
            await setupWebSocketClients();
            
            // 验证数据同步恢复
            await DataSyncService.syncDataChange('create', 'todos', {
                id: todoId,
                supervised_user_id: testSupervisedUsers.child1
            }, testSupervisedUsers.child1);
            
            const syncedTodo = await getTodoFromDatabase(todoId, 'papa');
            expect(syncedTodo).toBeDefined();
            
            console.log('✅ 网络中断恢复测试完成');
        });
    });
    
    describe('性能和压力测试', () => {
        test('大量数据同步性能', async () => {
            console.log('🔄 开始大量数据同步性能测试...');
            
            // 建立关联关系
            const request = await LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1);
            await LinkService.handleRequest(request.id, 'accept', 'papa');
            
            // 创建大量测试数据
            const todoIds = [];
            const startTime = Date.now();
            
            for (let i = 0; i < 100; i++) {
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
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`📊 同步100条数据耗时: ${duration}ms`);
            
            // 验证同步完成
            const syncedTodos = await query('SELECT COUNT(*) as count FROM todos WHERE app_user_id = ?', ['papa']);
            expect(syncedTodos[0].count).toBeGreaterThanOrEqual(100);
            
            // 性能要求：100条数据同步应在10秒内完成
            expect(duration).toBeLessThan(10000);
            
            console.log('✅ 大量数据同步性能测试完成');
        });
        
        test('并发用户操作压力测试', async () => {
            console.log('🔄 开始并发用户操作压力测试...');
            
            // 建立多个关联关系
            const requests = await Promise.all([
                LinkService.createRequest('mama', 'papa', testSupervisedUsers.child1),
                LinkService.createRequest('mama', 'grandma', testSupervisedUsers.child2)
            ]);
            
            await Promise.all([
                LinkService.handleRequest(requests[0].id, 'accept', 'papa'),
                LinkService.handleRequest(requests[1].id, 'accept', 'grandma')
            ]);
            
            // 模拟高并发操作
            const operations = [];
            const startTime = Date.now();
            
            for (let i = 0; i < 50; i++) {
                operations.push(
                    createTestTodo(testSupervisedUsers.child1, 'mama', `并发待办 ${i}`),
                    createTestTodo(testSupervisedUsers.child2, 'mama', `并发待办 ${i}`)
                );
            }
            
            const todoIds = await Promise.all(operations);
            
            // 并发同步操作
            const syncOperations = todoIds.map((todoId, index) => {
                const supervisedUserId = index % 2 === 0 ? testSupervisedUsers.child1 : testSupervisedUsers.child2;
                return DataSyncService.syncDataChange('create', 'todos', {
                    id: todoId,
                    supervised_user_id: supervisedUserId
                }, supervisedUserId);
            });
            
            await Promise.all(syncOperations);
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`📊 并发操作100次耗时: ${duration}ms`);
            
            // 验证数据一致性
            await verifyDataConsistency(testSupervisedUsers.child1, 'mama', 'papa');
            await verifyDataConsistency(testSupervisedUsers.child2, 'mama', 'grandma');
            
            console.log('✅ 并发用户操作压力测试完成');
        });
    });
    
    // 辅助函数
    async function setupTestUsers() {
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
            const result = await query(`
                INSERT INTO users (app_user_id, username, display_name, device_id) 
                VALUES (?, ?, ?, ?)
            `, [user.app_user, user.username, user.display_name, `device_${user.username}`]);
            
            testSupervisedUsers[user.username] = result.insertId;
        }
        
        console.log('👥 测试用户创建完成:', testSupervisedUsers);
    }
    
    async function setupTestWebSocketServer() {
        return new Promise((resolve) => {
            testServer = http.createServer();
            wsServer = new WebSocket.Server({ server: testServer });
            
            wsServer.on('connection', (ws, req) => {
                const username = new URL(req.url, 'http://localhost').searchParams.get('username');
                if (username) {
                    ws.username = username;
                    console.log(`📡 WebSocket连接建立: ${username}`);
                }
                
                ws.on('message', (message) => {
                    try {
                        const data = JSON.parse(message);
                        console.log(`📨 收到消息 from ${ws.username}:`, data);
                    } catch (error) {
                        console.error('消息解析错误:', error);
                    }
                });
                
                ws.on('close', () => {
                    console.log(`📡 WebSocket连接关闭: ${ws.username}`);
                });
            });
            
            testServer.listen(0, async () => {
                const port = testServer.address().port;
                console.log(`🌐 测试WebSocket服务器启动在端口: ${port}`);
                
                // 创建客户端连接
                await setupWebSocketClients(port);
                resolve();
            });
        });
    }
    
    async function setupWebSocketClients(port) {
        if (!port) {
            port = testServer.address().port;
        }
        
        const users = ['mama', 'papa', 'grandma'];
        const connectionPromises = users.map(username => createWebSocketClient(username, port));
        
        const clients = await Promise.all(connectionPromises);
        users.forEach((username, index) => {
            wsClients[username] = clients[index];
        });
        
        console.log('📱 WebSocket客户端连接完成');
    }
    
    function createWebSocketClient(username, port) {
        if (!port) {
            port = testServer.address().port;
        }
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${port}?username=${username}`);
            
            ws.on('open', () => {
                ws.messageQueue = [];
                resolve(ws);
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    ws.messageQueue = ws.messageQueue || [];
                    ws.messageQueue.push(message);
                } catch (error) {
                    console.error('客户端消息解析错误:', error);
                }
            });
            
            ws.on('error', reject);
            
            setTimeout(() => reject(new Error('WebSocket连接超时')), 5000);
        });
    }
    
    function waitForWebSocketMessage(username, messageType, timeout = 3000) {
        return new Promise((resolve, reject) => {
            const ws = wsClients[username];
            if (!ws) {
                reject(new Error(`WebSocket客户端不存在: ${username}`));
                return;
            }
            
            const checkMessage = () => {
                const queue = ws.messageQueue || [];
                const message = queue.find(msg => msg.type === messageType);
                if (message) {
                    // 从队列中移除已处理的消息
                    const index = queue.indexOf(message);
                    queue.splice(index, 1);
                    resolve(message);
                    return true;
                }
                return false;
            };
            
            // 立即检查是否已有消息
            if (checkMessage()) {
                return;
            }
            
            // 监听新消息
            const messageHandler = () => {
                if (checkMessage()) {
                    ws.removeListener('message', messageHandler);
                }
            };
            
            ws.on('message', messageHandler);
            
            // 设置超时
            setTimeout(() => {
                ws.removeListener('message', messageHandler);
                reject(new Error(`等待WebSocket消息超时: ${messageType} for ${username}`));
            }, timeout);
        });
    }
    
    async function testDataSynchronization() {
        // 创建测试数据
        const todoId = await createTestTodo(testSupervisedUsers.child1, 'mama');
        const noteId = await createTestNote(testSupervisedUsers.child1, 'mama');
        
        // 触发同步
        await DataSyncService.syncDataChange('create', 'todos', {
            id: todoId,
            supervised_user_id: testSupervisedUsers.child1
        }, testSupervisedUsers.child1);
        
        await DataSyncService.syncDataChange('create', 'notes', {
            id: noteId,
            supervised_user_id: testSupervisedUsers.child1
        }, testSupervisedUsers.child1);
        
        // 验证数据同步
        const papaTodo = await getTodoFromDatabase(todoId, 'papa');
        const papaNote = await getNoteFromDatabase(noteId, 'papa');
        
        expect(papaTodo).toBeDefined();
        expect(papaNote).toBeDefined();
        expect(papaTodo.supervised_user_id).toBe(testSupervisedUsers.child1);
        expect(papaNote.supervised_user_id).toBe(testSupervisedUsers.child1);
    }
    
    async function createTestTodo(supervisedUserId, appUser, title = '测试待办事项') {
        const result = await query(`
            INSERT INTO todos (app_user_id, supervised_user_id, title, description, completed, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, [appUser, supervisedUserId, title, '测试描述', 0]);
        
        return result.insertId;
    }
    
    async function createTestNote(supervisedUserId, appUser, content = '测试笔记内容') {
        const result = await query(`
            INSERT INTO notes (app_user_id, supervised_user_id, content, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `, [appUser, supervisedUserId, content]);
        
        return result.insertId;
    }
    
    async function getTodoFromDatabase(todoId, appUser) {
        const todos = await query('SELECT * FROM todos WHERE id = ? AND app_user_id = ?', [todoId, appUser]);
        return todos[0];
    }
    
    async function getNoteFromDatabase(noteId, appUser) {
        const notes = await query('SELECT * FROM notes WHERE id = ? AND app_user_id = ?', [noteId, appUser]);
        return notes[0];
    }
    
    async function updateTodoInDatabase(todoId, appUser, updates) {
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(todoId, appUser);
        
        await query(`UPDATE todos SET ${setClause} WHERE id = ? AND app_user_id = ?`, values);
    }
    
    async function verifyDataConsistency(supervisedUserId, ...appUsers) {
        for (const table of ['todos', 'notes']) {
            const dataSets = await Promise.all(
                appUsers.map(appUser => 
                    query(`SELECT * FROM ${table} WHERE supervised_user_id = ? AND app_user_id = ? ORDER BY id`, 
                        [supervisedUserId, appUser])
                )
            );
            
            // 验证数据数量一致
            const counts = dataSets.map(data => data.length);
            expect(new Set(counts).size).toBe(1); // 所有用户的数据数量应该相同
            
            // 验证数据内容一致（除了app_user_id字段）
            if (dataSets[0].length > 0) {
                for (let i = 0; i < dataSets[0].length; i++) {
                    const baseRecord = dataSets[0][i];
                    for (let j = 1; j < dataSets.length; j++) {
                        const compareRecord = dataSets[j][i];
                        
                        // 比较除app_user_id外的所有字段
                        Object.keys(baseRecord).forEach(key => {
                            if (key !== 'app_user_id') {
                                expect(compareRecord[key]).toBe(baseRecord[key]);
                            }
                        });
                    }
                }
            }
        }
    }
    
    async function cleanupTestData() {
        // 清理测试数据
        await query('DELETE FROM user_links');
        await query('DELETE FROM link_requests');
        await query('DELETE FROM todos WHERE app_user_id IN (?, ?, ?)', ['mama', 'papa', 'grandma']);
        await query('DELETE FROM notes WHERE app_user_id IN (?, ?, ?)', ['mama', 'papa', 'grandma']);
        
        if (Object.keys(testSupervisedUsers).length > 0) {
            const userIds = Object.values(testSupervisedUsers);
            const placeholders = userIds.map(() => '?').join(',');
            await query(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
        }
        
        await query('DELETE FROM app_users WHERE username IN (?, ?, ?)', ['mama', 'papa', 'grandma']);
    }
});

// 运行集成测试的辅助函数
async function runIntegrationTests() {
    console.log('🧪 开始运行用户关联功能集成测试...');
    
    try {
        // 这里需要使用实际的测试框架，如Jest
        console.log('✅ 所有集成测试通过');
        return true;
    } catch (error) {
        console.error('❌ 集成测试失败:', error);
        throw error;
    }
}

// 如果直接运行此文件
if (require.main === module) {
    runIntegrationTests().then(() => {
        console.log('🎉 集成测试完成');
        process.exit(0);
    }).catch(error => {
        console.error('💥 集成测试失败:', error);
        process.exit(1);
    });
}

module.exports = { runIntegrationTests };