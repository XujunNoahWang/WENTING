#!/usr/bin/env node

/**
 * WebSocket连接调试脚本
 * 检查WebSocket连接状态和消息传递
 */

const WebSocket = require('ws');
const { query } = require('../config/sqlite');

async function debugWebSocketConnections() {
    console.log('🔍 开始调试WebSocket连接...\n');
    
    try {
        // 1. 检查用户状态
        console.log('1️⃣ 检查用户状态...');
        const users = await query('SELECT id, app_user_id, username, is_linked FROM users WHERE app_user_id IN (?, ?)', ['blackblade', 'whiteblade']);
        
        users.forEach(user => {
            console.log(`   用户: ${user.app_user_id} (ID: ${user.id}, 用户名: ${user.username}, 关联状态: ${user.is_linked})`);
        });
        
        // 2. 模拟WebSocket连接
        console.log('\n2️⃣ 模拟WebSocket连接...');
        
        const wsUrl = 'ws://localhost:3001/ws';
        console.log(`连接到: ${wsUrl}`);
        
        // 创建两个WebSocket连接，模拟blackblade和whiteblade
        const connections = {};
        
        for (const user of users) {
            const appUserId = user.app_user_id;
            const deviceId = `debug_device_${appUserId}`;
            
            console.log(`\n📱 创建${appUserId}的WebSocket连接...`);
            
            const ws = new WebSocket(wsUrl);
            connections[appUserId] = { ws, deviceId, userId: user.id };
            
            ws.on('open', () => {
                console.log(`✅ ${appUserId} WebSocket连接已建立`);
                
                // 发送注册消息
                const registerMessage = {
                    type: 'USER_REGISTRATION',
                    deviceId: deviceId,
                    userId: user.id,
                    appUserId: appUserId,
                    timestamp: Date.now()
                };
                
                ws.send(JSON.stringify(registerMessage));
                console.log(`📝 ${appUserId} 发送注册消息:`, registerMessage);
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log(`📥 ${appUserId} 收到消息:`, message.type, message);
                    
                    // 特别关注同步消息
                    if (message.type === 'NOTES_SYNC_UPDATE') {
                        console.log(`🔄 ${appUserId} 收到Notes同步消息!`, message);
                    }
                } catch (error) {
                    console.log(`📥 ${appUserId} 收到原始消息:`, data.toString());
                }
            });
            
            ws.on('error', (error) => {
                console.error(`❌ ${appUserId} WebSocket错误:`, error);
            });
            
            ws.on('close', () => {
                console.log(`🔌 ${appUserId} WebSocket连接已关闭`);
            });
        }
        
        // 等待连接建立和注册完成
        console.log('⏳ 等待连接注册完成...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 3. 测试消息发送
        console.log('\n3️⃣ 测试消息发送...');
        
        // 创建一个测试Notes
        const testNote = {
            user_id: users.find(u => u.app_user_id === 'blackblade').id,
            title: 'WebSocket调试测试Notes',
            description: '测试WebSocket消息传递',
            precautions: '这是一个调试测试'
        };
        
        const noteResult = await query(
            'INSERT INTO notes (user_id, title, description, precautions, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [testNote.user_id, testNote.title, testNote.description, testNote.precautions]
        );
        
        const noteId = noteResult.insertId || noteResult.lastID;
        const createdNote = await query('SELECT * FROM notes WHERE id = ?', [noteId]);
        
        console.log('✅ 创建测试Notes:', createdNote[0].title);
        
        // 检查WebSocket服务端的连接状态
        console.log('🔍 检查WebSocket服务端连接状态...');
        const websocketService = require('../services/websocketService');
        
        // 手动检查连接状态
        console.log('📊 当前活跃连接数:', websocketService.connections.size);
        console.log('📊 App用户连接映射:', Array.from(websocketService.appUserConnections.entries()));
        
        // 手动触发同步消息（模拟DataSyncService的行为）
        const DataSyncService = require('../services/dataSyncService');
        console.log('🔄 触发Notes同步...');
        
        try {
            await DataSyncService.syncNotesOperation('create', createdNote[0], testNote.user_id);
            console.log('✅ 同步操作完成');
        } catch (syncError) {
            console.error('❌ 同步操作失败:', syncError);
        }
        
        // 等待消息传递
        console.log('⏳ 等待消息传递...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 4. 清理测试数据
        console.log('\n4️⃣ 清理测试数据...');
        await query('DELETE FROM notes WHERE id = ?', [noteId]);
        console.log('✅ 测试数据清理完成');
        
        // 关闭WebSocket连接
        console.log('\n5️⃣ 关闭WebSocket连接...');
        Object.values(connections).forEach(({ ws, deviceId }) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
                console.log(`🔌 关闭连接: ${deviceId}`);
            }
        });
        
        console.log('\n🎉 WebSocket连接调试完成！');
        
    } catch (error) {
        console.error('❌ 调试失败:', error);
        process.exit(1);
    }
}

// 运行调试
if (require.main === module) {
    debugWebSocketConnections().then(() => {
        console.log('✅ 调试脚本执行完成');
        setTimeout(() => process.exit(0), 1000); // 给WebSocket时间关闭
    }).catch(error => {
        console.error('❌ 调试脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = { debugWebSocketConnections };