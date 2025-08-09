// WebSocket Link功能测试脚本
const WebSocket = require('ws');
const { query, testConnection } = require('../config/sqlite');

// 测试配置
const WS_URL = 'ws://localhost:3001/ws';
const TEST_TIMEOUT = 10000; // 10秒超时

// 测试数据
let testData = {
    supervisedUserId: null,
    requestId: null,
    connections: {
        manager: null,
        linked: null
    }
};

// 创建WebSocket连接
function createWebSocketConnection(userId, deviceId) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        
        ws.on('open', () => {
            console.log(`✅ WebSocket连接已建立: ${userId}`);
            
            // 注册连接
            ws.send(JSON.stringify({
                type: 'PING',
                userId: userId,
                deviceId: deviceId,
                timestamp: Date.now()
            }));
            
            resolve(ws);
        });
        
        ws.on('error', (error) => {
            console.error(`❌ WebSocket连接错误 (${userId}):`, error.message);
            reject(error);
        });
        
        ws.on('close', () => {
            console.log(`🔌 WebSocket连接已关闭: ${userId}`);
        });
    });
}

// 发送WebSocket消息并等待响应
function sendWebSocketMessage(ws, message, expectedResponseType) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`WebSocket消息超时: ${expectedResponseType}`));
        }, TEST_TIMEOUT);
        
        const messageHandler = (data) => {
            try {
                const response = JSON.parse(data.toString());
                
                if (response.type === expectedResponseType || 
                    response.type === `${message.type}_RESPONSE`) {
                    clearTimeout(timeout);
                    ws.removeListener('message', messageHandler);
                    resolve(response);
                }
            } catch (error) {
                // 忽略解析错误，继续等待正确的消息
            }
        };
        
        ws.on('message', messageHandler);
        ws.send(JSON.stringify(message));
    });
}

// 设置测试数据
async function setupTestData() {
    try {
        console.log('🔧 设置WebSocket测试数据...');
        
        // 清理旧数据
        await query('DELETE FROM user_links WHERE manager_app_user IN (?, ?) OR linked_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM link_requests WHERE from_app_user IN (?, ?) OR to_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM users WHERE app_user_id IN (?, ?)', ['testmgr', 'testlink']);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        
        // 创建测试用户
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testmgr', 'hash1']);
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testlink', 'hash2']);
        
        // 创建被监管用户
        const result = await query(`
            INSERT INTO users (app_user_id, username, display_name, device_id) 
            VALUES (?, ?, ?, ?)
        `, ['testmgr', 'testsupervised', '测试被监管用户', 'testdevice']);
        
        testData.supervisedUserId = result.insertId;
        console.log(`✅ WebSocket测试数据设置完成，被监管用户ID: ${testData.supervisedUserId}`);
        
    } catch (error) {
        console.error('❌ 设置WebSocket测试数据失败:', error);
        throw error;
    }
}

// 清理测试数据
async function cleanupTestData() {
    try {
        console.log('🧹 清理WebSocket测试数据...');
        
        // 关闭WebSocket连接
        if (testData.connections.manager) {
            testData.connections.manager.close();
        }
        if (testData.connections.linked) {
            testData.connections.linked.close();
        }
        
        // 清理数据库数据
        await query('DELETE FROM user_links WHERE manager_app_user IN (?, ?) OR linked_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM link_requests WHERE from_app_user IN (?, ?) OR to_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM users WHERE app_user_id IN (?, ?)', ['testmgr', 'testlink']);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        
        console.log('✅ WebSocket测试数据清理完成');
        
    } catch (error) {
        console.error('❌ 清理WebSocket测试数据失败:', error);
    }
}

// 测试创建关联请求
async function testCreateLinkRequest() {
    console.log('\n📝 测试1: WebSocket创建关联请求...');
    
    try {
        const response = await sendWebSocketMessage(
            testData.connections.manager,
            {
                type: 'LINK_CREATE_REQUEST',
                userId: 'testmgr',
                deviceId: 'device1',
                data: {
                    fromAppUser: 'testmgr',
                    toAppUser: 'testlink',
                    supervisedUserId: testData.supervisedUserId,
                    message: 'WebSocket测试关联请求'
                }
            },
            'LINK_CREATE_REQUEST_RESPONSE'
        );
        
        console.log('响应:', response);
        
        if (response.success && response.data.request) {
            testData.requestId = response.data.request.id;
            console.log('✅ WebSocket创建关联请求成功');
            return true;
        } else {
            console.log('❌ WebSocket创建关联请求失败');
            return false;
        }
    } catch (error) {
        console.error('❌ WebSocket创建关联请求异常:', error.message);
        return false;
    }
}

// 测试接收关联请求通知
async function testReceiveLinkNotification() {
    console.log('\n📨 测试2: 接收关联请求通知...');
    
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log('❌ 未收到关联请求通知');
            resolve(false);
        }, 5000);
        
        const messageHandler = (data) => {
            try {
                const message = JSON.parse(data.toString());
                
                if (message.type === 'LINK_REQUEST_RECEIVED') {
                    clearTimeout(timeout);
                    testData.connections.linked.removeListener('message', messageHandler);
                    
                    console.log('收到通知:', message);
                    console.log('✅ 成功接收关联请求通知');
                    resolve(true);
                }
            } catch (error) {
                // 忽略解析错误
            }
        };
        
        testData.connections.linked.on('message', messageHandler);
    });
}

// 测试获取待处理请求
async function testGetPendingRequests() {
    console.log('\n📋 测试3: WebSocket获取待处理请求...');
    
    try {
        const response = await sendWebSocketMessage(
            testData.connections.linked,
            {
                type: 'LINK_GET_PENDING_REQUESTS',
                userId: 'testlink',
                deviceId: 'device2'
            },
            'LINK_GET_PENDING_REQUESTS_RESPONSE'
        );
        
        console.log('响应:', response);
        
        if (response.success && response.data.requests && response.data.requests.length > 0) {
            console.log('✅ WebSocket获取待处理请求成功');
            return true;
        } else {
            console.log('❌ WebSocket获取待处理请求失败');
            return false;
        }
    } catch (error) {
        console.error('❌ WebSocket获取待处理请求异常:', error.message);
        return false;
    }
}

// 测试处理关联请求
async function testHandleLinkRequest() {
    console.log('\n✅ 测试4: WebSocket处理关联请求...');
    
    try {
        const response = await sendWebSocketMessage(
            testData.connections.linked,
            {
                type: 'LINK_HANDLE_REQUEST',
                userId: 'testlink',
                deviceId: 'device2',
                data: {
                    requestId: testData.requestId,
                    action: 'accept',
                    appUser: 'testlink'
                }
            },
            'LINK_HANDLE_REQUEST_RESPONSE'
        );
        
        console.log('响应:', response);
        
        if (response.success && response.data.status === 'accepted') {
            console.log('✅ WebSocket处理关联请求成功');
            return true;
        } else {
            console.log('❌ WebSocket处理关联请求失败');
            return false;
        }
    } catch (error) {
        console.error('❌ WebSocket处理关联请求异常:', error.message);
        return false;
    }
}

// 测试接收关联建立通知
async function testReceiveLinkEstablishedNotification() {
    console.log('\n🔗 测试5: 接收关联建立通知...');
    
    return new Promise((resolve) => {
        let receivedCount = 0;
        const expectedCount = 2; // 管理员和被关联用户都应该收到通知
        
        const timeout = setTimeout(() => {
            console.log(`❌ 只收到 ${receivedCount}/${expectedCount} 个关联建立通知`);
            resolve(receivedCount === expectedCount);
        }, 5000);
        
        const createMessageHandler = (userType) => (data) => {
            try {
                const message = JSON.parse(data.toString());
                
                if (message.type === 'LINK_ESTABLISHED') {
                    receivedCount++;
                    console.log(`${userType}收到通知:`, message);
                    
                    if (receivedCount === expectedCount) {
                        clearTimeout(timeout);
                        console.log('✅ 成功接收所有关联建立通知');
                        resolve(true);
                    }
                }
            } catch (error) {
                // 忽略解析错误
            }
        };
        
        testData.connections.manager.on('message', createMessageHandler('管理员'));
        testData.connections.linked.on('message', createMessageHandler('被关联用户'));
    });
}

// 测试获取用户关联关系
async function testGetUserLinks() {
    console.log('\n🔗 测试6: WebSocket获取用户关联关系...');
    
    try {
        const managerResponse = await sendWebSocketMessage(
            testData.connections.manager,
            {
                type: 'LINK_GET_USER_LINKS',
                userId: 'testmgr',
                deviceId: 'device1'
            },
            'LINK_GET_USER_LINKS_RESPONSE'
        );
        
        const linkedResponse = await sendWebSocketMessage(
            testData.connections.linked,
            {
                type: 'LINK_GET_USER_LINKS',
                userId: 'testlink',
                deviceId: 'device2'
            },
            'LINK_GET_USER_LINKS_RESPONSE'
        );
        
        console.log('管理员关联关系:', managerResponse);
        console.log('被关联用户关联关系:', linkedResponse);
        
        if (managerResponse.success && linkedResponse.success) {
            console.log('✅ WebSocket获取用户关联关系成功');
            return true;
        } else {
            console.log('❌ WebSocket获取用户关联关系失败');
            return false;
        }
    } catch (error) {
        console.error('❌ WebSocket获取用户关联关系异常:', error.message);
        return false;
    }
}

// 运行WebSocket测试
async function runWebSocketTests() {
    try {
        console.log('🧪 开始WebSocket Link功能测试...');
        
        // 检查数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 设置测试数据
        await setupTestData();
        
        // 建立WebSocket连接
        console.log('🔌 建立WebSocket连接...');
        testData.connections.manager = await createWebSocketConnection('testmgr', 'device1');
        testData.connections.linked = await createWebSocketConnection('testlink', 'device2');
        
        // 等待连接稳定
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const tests = [
            testCreateLinkRequest,
            testReceiveLinkNotification,
            testGetPendingRequests,
            testHandleLinkRequest,
            testReceiveLinkEstablishedNotification,
            testGetUserLinks
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
        
        console.log(`\n📊 WebSocket测试结果: ${passedTests}/${tests.length} 通过`);
        
        if (passedTests === tests.length) {
            console.log('🎉 所有WebSocket测试通过！');
            return true;
        } else {
            console.log('⚠️  部分WebSocket测试失败');
            return false;
        }
        
    } catch (error) {
        console.error('❌ WebSocket测试套件失败:', error);
        return false;
    } finally {
        // 清理测试数据
        await cleanupTestData();
    }
}

// 检查WebSocket服务器状态
async function checkWebSocketServer() {
    try {
        const ws = new WebSocket(WS_URL);
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve(false);
            }, 3000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                ws.close();
                resolve(true);
            });
            
            ws.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });
    } catch (error) {
        return false;
    }
}

// 主函数
async function main() {
    console.log('🔍 检查WebSocket服务器状态...');
    
    const serverRunning = await checkWebSocketServer();
    if (!serverRunning) {
        console.error('❌ WebSocket服务器未运行，请先启动服务器');
        process.exit(1);
    }
    
    console.log('✅ WebSocket服务器运行正常');
    
    const success = await runWebSocketTests();
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = { runWebSocketTests };