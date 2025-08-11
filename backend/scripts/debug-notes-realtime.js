#!/usr/bin/env node

/**
 * Notes实时同步调试脚本
 * 专门调试WebSocket消息传递和前端处理问题
 */

const WebSocket = require('ws');
const { query } = require('../config/sqlite');

async function debugNotesRealtime() {
    console.log('🔍 开始调试Notes实时同步...\n');
    
    try {
        // 1. 检查用户状态
        console.log('1️⃣ 检查用户状态...');
        const users = await query('SELECT id, app_user_id, username, is_linked FROM users WHERE app_user_id IN (?, ?)', ['blackblade', 'whiteblade']);
        
        if (users.length !== 2) {
            throw new Error('未找到blackblade和whiteblade用户');
        }
        
        const blackblade = users.find(u => u.app_user_id === 'blackblade');
        const whiteblade = users.find(u => u.app_user_id === 'whiteblade');
        
        console.log(`   blackblade: ID=${blackblade.id}`);
        console.log(`   whiteblade: ID=${whiteblade.id}`);
        
        // 2. 清理并创建测试数据
        console.log('\n2️⃣ 准备测试数据...');
        await query('DELETE FROM notes WHERE title LIKE ?', ['%实时调试%']);
        
        // 创建一个测试Notes
        const testNote = {
            user_id: blackblade.id,
            title: '实时调试Notes - 测试同步',
            description: '这是一个用于调试实时同步的Notes',
            precautions: '请确保WebSocket连接正常'
        };
        
        const result = await query(
            'INSERT INTO notes (user_id, title, description, precautions, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [testNote.user_id, testNote.title, testNote.description, testNote.precautions]
        );
        
        const noteId = result.insertId || result.lastID;
        const createdNote = await query('SELECT * FROM notes WHERE id = ?', [noteId]);
        console.log(`   ✅ 创建测试Notes: ${createdNote[0].title}`);
        
        // 3. 建立WebSocket连接监听消息
        console.log('\n3️⃣ 建立WebSocket连接监听...');
        const wsUrl = 'ws://localhost:3001/ws';
        
        const whitebladeWs = new WebSocket(wsUrl);
        let messageReceived = false;
        
        whitebladeWs.on('open', () => {
            console.log('✅ whiteblade WebSocket连接已建立');
            
            // 发送注册消息
            const registerMessage = {
                type: 'USER_REGISTRATION',
                deviceId: 'debug_whiteblade_device',
                userId: whiteblade.id,
                appUserId: 'whiteblade',
                timestamp: Date.now()
            };
            
            whitebladeWs.send(JSON.stringify(registerMessage));
            console.log('📝 whiteblade 发送注册消息');
        });
        
        whitebladeWs.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 whiteblade 收到消息: ${message.type}`);
                
                if (message.type === 'USER_REGISTRATION_RESPONSE') {
                    console.log(`✅ whiteblade 注册${message.success ? '成功' : '失败'}`);
                } else if (message.type === 'NOTES_SYNC_UPDATE') {
                    console.log(`🔄 whiteblade 收到Notes同步消息!`);
                    console.log('   操作:', message.operation);
                    console.log('   数据:', message.data);
                    console.log('   同步信息:', message.sync);
                    messageReceived = true;
                }
            } catch (error) {
                console.log(`📥 whiteblade 收到原始消息: ${data.toString()}`);
            }
        });
        
        whitebladeWs.on('error', (error) => {
            console.error(`❌ whiteblade WebSocket错误:`, error.message);
        });
        
        // 4. 等待连接稳定
        console.log('\n4️⃣ 等待连接稳定...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 5. 检查服务端连接状态
        console.log('\n5️⃣ 检查服务端连接状态...');
        const websocketService = require('../services/websocketService');
        console.log(`📊 服务端活跃连接数: ${websocketService.connections.size}`);
        console.log(`📊 App用户连接映射:`, Array.from(websocketService.appUserConnections.entries()));
        
        // 6. 手动触发同步消息
        console.log('\n6️⃣ 手动触发同步消息...');
        
        // 直接调用broadcastToAppUser方法
        const syncMessage = {
            type: 'NOTES_SYNC_UPDATE',
            operation: 'CREATE',
            data: createdNote[0],
            sync: {
                fromUser: 'blackblade',
                userId: blackblade.id,
                timestamp: Date.now()
            }
        };
        
        console.log('📡 直接向whiteblade发送同步消息...');
        websocketService.broadcastToAppUser('whiteblade', syncMessage);
        
        // 7. 等待消息传递
        console.log('\n7️⃣ 等待消息传递...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 8. 检查消息接收状态
        console.log('\n8️⃣ 检查消息接收状态...');
        if (messageReceived) {
            console.log('✅ whiteblade成功接收到NOTES_SYNC_UPDATE消息');
        } else {
            console.log('❌ whiteblade未接收到NOTES_SYNC_UPDATE消息');
            console.log('💡 这可能是WebSocket连接或消息传递的问题');
        }
        
        // 9. 测试API数据加载
        console.log('\n9️⃣ 测试API数据加载...');
        
        // 模拟前端API调用
        const ApiClient = {
            notes: {
                async getByUserId(userId) {
                    try {
                        const notes = await query('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC', [userId]);
                        return {
                            success: true,
                            data: notes
                        };
                    } catch (error) {
                        return {
                            success: false,
                            message: error.message
                        };
                    }
                }
            }
        };
        
        // 测试加载blackblade的Notes
        const blackbladeNotesResponse = await ApiClient.notes.getByUserId(blackblade.id);
        console.log(`blackblade Notes API响应:`, {
            success: blackbladeNotesResponse.success,
            count: blackbladeNotesResponse.data ? blackbladeNotesResponse.data.length : 0
        });
        
        // 测试加载whiteblade的Notes
        const whitebladeNotesResponse = await ApiClient.notes.getByUserId(whiteblade.id);
        console.log(`whiteblade Notes API响应:`, {
            success: whitebladeNotesResponse.success,
            count: whitebladeNotesResponse.data ? whitebladeNotesResponse.data.length : 0
        });
        
        // 10. 清理测试数据
        console.log('\n🔟 清理测试数据...');
        await query('DELETE FROM notes WHERE id = ?', [noteId]);
        console.log('✅ 测试数据清理完成');
        
        // 关闭WebSocket连接
        whitebladeWs.close();
        console.log('🔌 WebSocket连接已关闭');
        
        console.log('\n🎉 Notes实时同步调试完成！');
        
        // 总结问题
        console.log('\n📋 问题诊断:');
        if (!messageReceived) {
            console.log('❌ 主要问题: WebSocket消息未到达前端');
            console.log('💡 可能原因:');
            console.log('   1. WebSocket连接未正确注册');
            console.log('   2. 服务端broadcastToAppUser方法有问题');
            console.log('   3. 前端WebSocket连接断开');
        } else {
            console.log('✅ WebSocket消息传递正常');
            console.log('💡 问题可能在前端处理逻辑');
        }
        
    } catch (error) {
        console.error('❌ 调试失败:', error);
        process.exit(1);
    }
}

// 运行调试
if (require.main === module) {
    debugNotesRealtime().then(() => {
        console.log('✅ 调试脚本执行完成');
        setTimeout(() => process.exit(0), 1000);
    }).catch(error => {
        console.error('❌ 调试脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = { debugNotesRealtime };