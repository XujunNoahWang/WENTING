// 专门测试WebSocket通知功能
const WebSocket = require('ws');
const { query, testConnection } = require('../config/sqlite');

const WS_URL = 'ws://localhost:3001/ws';

async function testNotificationOnly() {
    try {
        console.log('🧪 测试WebSocket通知功能...');
        
        // 检查数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 设置测试数据
        await query('DELETE FROM user_links WHERE manager_app_user IN (?, ?) OR linked_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM link_requests WHERE from_app_user IN (?, ?) OR to_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM users WHERE app_user_id IN (?, ?)', ['testmgr', 'testlink']);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testmgr', 'hash1']);
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testlink', 'hash2']);
        
        const result = await query(`
            INSERT INTO users (app_user_id, username, display_name, device_id) 
            VALUES (?, ?, ?, ?)
        `, ['testmgr', 'testsupervised', '测试被监管用户', 'testdevice']);
        
        const supervisedUserId = result.insertId;
        
        // 建立WebSocket连接
        console.log('🔌 建立WebSocket连接...');
        
        const managerWs = new WebSocket(WS_URL);
        const linkedWs = new WebSocket(WS_URL);
        
        await new Promise((resolve) => {
            let connectedCount = 0;
            
            managerWs.on('open', () => {
                console.log('✅ 管理员WebSocket连接已建立');
                // 注册连接
                managerWs.send(JSON.stringify({
                    type: 'PING',
                    userId: 'testmgr',
                    deviceId: 'device1',
                    timestamp: Date.now()
                }));
                connectedCount++;
                if (connectedCount === 2) resolve();
            });
            
            linkedWs.on('open', () => {
                console.log('✅ 被关联用户WebSocket连接已建立');
                // 注册连接
                linkedWs.send(JSON.stringify({
                    type: 'PING',
                    userId: 'testlink',
                    deviceId: 'device2',
                    timestamp: Date.now()
                }));
                connectedCount++;
                if (connectedCount === 2) resolve();
            });
        });
        
        // 等待连接注册完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 监听通知
        let receivedNotifications = [];
        
        linkedWs.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'LINK_REQUEST_RECEIVED') {
                    console.log('📨 收到关联请求通知:', message);
                    receivedNotifications.push(message);
                }
            } catch (error) {
                // 忽略解析错误
            }
        });
        
        managerWs.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'LINK_REQUEST_RESPONSE' || message.type === 'LINK_ESTABLISHED') {
                    console.log('📨 管理员收到通知:', message);
                    receivedNotifications.push(message);
                }
            } catch (error) {
                // 忽略解析错误
            }
        });
        
        // 发送创建关联请求
        console.log('📤 发送创建关联请求...');
        managerWs.send(JSON.stringify({
            type: 'LINK_CREATE_REQUEST',
            userId: 'testmgr',
            deviceId: 'device1',
            data: {
                fromAppUser: 'testmgr',
                toAppUser: 'testlink',
                supervisedUserId: supervisedUserId,
                message: '通知测试关联请求'
            }
        }));
        
        // 等待通知
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`📊 收到通知数量: ${receivedNotifications.length}`);
        
        if (receivedNotifications.length > 0) {
            console.log('✅ 通知功能正常工作');
        } else {
            console.log('❌ 未收到任何通知');
        }
        
        // 关闭连接
        managerWs.close();
        linkedWs.close();
        
        // 清理数据
        await query('DELETE FROM user_links WHERE manager_app_user IN (?, ?) OR linked_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM link_requests WHERE from_app_user IN (?, ?) OR to_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM users WHERE app_user_id IN (?, ?)', ['testmgr', 'testlink']);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        
    } catch (error) {
        console.error('❌ 通知测试失败:', error);
    }
}

testNotificationOnly();