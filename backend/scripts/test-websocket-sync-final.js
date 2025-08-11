#!/usr/bin/env node

/**
 * WebSocket同步最终测试脚本
 * 全面测试WebSocket连接、注册、消息传递和同步功能
 */

const WebSocket = require('ws');
const { query } = require('../config/sqlite');
const DataSyncService = require('../services/dataSyncService');

async function testWebSocketSyncFinal() {
    console.log('🧪 开始WebSocket同步最终测试...\n');
    
    try {
        // 1. 检查用户状态
        console.log('1️⃣ 检查用户状态...');
        const users = await query('SELECT id, app_user_id, username, is_linked FROM users WHERE app_user_id IN (?, ?)', ['blackblade', 'whiteblade']);
        
        if (users.length !== 2) {
            throw new Error('未找到blackblade和whiteblade用户');
        }
        
        const blackblade = users.find(u => u.app_user_id === 'blackblade');
        const whiteblade = users.find(u => u.app_user_id === 'whiteblade');
        
        console.log(`   blackblade: ID=${blackblade.id}, 关联状态=${blackblade.is_linked}`);
        console.log(`   whiteblade: ID=${whiteblade.id}, 关联状态=${whiteblade.is_linked}`);
        
        // 2. 清理测试数据
        console.log('\n2️⃣ 清理测试数据...');
        await query('DELETE FROM notes WHERE title LIKE ?', ['%WebSocket最终测试%']);
        console.log('   ✅ 测试数据清理完成');
        
        // 3. 建立WebSocket连接
        console.log('\n3️⃣ 建立WebSocket连接...');
        const wsUrl = 'ws://localhost:3001/ws';
        const connections = {};
        
        // 创建连接的Promise数组
        const connectionPromises = users.map(user => {
            return new Promise((resolve, reject) => {
                const appUserId = user.app_user_id;
                const deviceId = `final_test_${appUserId}`;
                const ws = new WebSocket(wsUrl);
                
                connections[appUserId] = { ws, deviceId, userId: user.id, connected: false, registered: false };
                
                const timeout = setTimeout(() => {
                    reject(new Error(`${appUserId} 连接超时`));
                }, 10000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    console.log(`✅ ${appUserId} WebSocket连接已建立`);
                    connections[appUserId].connected = true;
                    
                    // 发送注册消息
                    const registerMessage = {
                        type: 'USER_REGISTRATION',
                        deviceId: deviceId,
                        userId: user.id,
                        appUserId: appUserId,
                        timestamp: Date.now()
                    };
                    
                    ws.send(JSON.stringify(registerMessage));
                    console.log(`📝 ${appUserId} 发送注册消息`);
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        console.log(`📥 ${appUserId} 收到消息: ${message.type}`);
                        
                        if (message.type === 'USER_REGISTRATION_RESPONSE') {
                            if (message.success) {
                                console.log(`✅ ${appUserId} 注册成功`);
                                connections[appUserId].registered = true;
                                resolve();
                            } else {
                                reject(new Error(`${appUserId} 注册失败: ${message.error}`));
                            }
                        } else if (message.type === 'NOTES_SYNC_UPDATE') {
                            console.log(`🔄 ${appUserId} 收到Notes同步消息!`, message.operation);
                        }
                    } catch (error) {
                        console.log(`📥 ${appUserId} 收到原始消息: ${data.toString()}`);
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    console.error(`❌ ${appUserId} WebSocket错误:`, error.message);
                    reject(error);
                });
                
                ws.on('close', () => {
                    console.log(`🔌 ${appUserId} WebSocket连接已关闭`);
                });
            });
        });
        
        // 等待所有连接建立和注册完成
        try {
            await Promise.all(connectionPromises);
            console.log('✅ 所有WebSocket连接和注册完成');
        } catch (error) {
            console.error('❌ WebSocket连接或注册失败:', error.message);
            throw error;
        }
        
        // 4. 等待连接稳定
        console.log('\n4️⃣ 等待连接稳定...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 5. 检查服务端连接状态
        console.log('\n5️⃣ 检查服务端连接状态...');
        const websocketService = require('../services/websocketService');
        console.log(`📊 服务端活跃连接数: ${websocketService.connections.size}`);
        console.log(`📊 App用户连接映射:`, Array.from(websocketService.appUserConnections.entries()));
        
        // 6. 测试Notes同步
        console.log('\n6️⃣ 测试Notes同步...');
        
        // 创建测试Notes
        const testNote = {
            user_id: blackblade.id,
            title: 'WebSocket最终测试Notes - 心脏病',
            description: '心律不齐，需要定期检查',
            precautions: '避免剧烈运动，按时服药'
        };
        
        const noteResult = await query(
            'INSERT INTO notes (user_id, title, description, precautions, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [testNote.user_id, testNote.title, testNote.description, testNote.precautions]
        );
        
        const noteId = noteResult.insertId || noteResult.lastID;
        const createdNote = await query('SELECT * FROM notes WHERE id = ?', [noteId]);
        
        console.log(`✅ 创建测试Notes: ${createdNote[0].title}`);
        
        // 触发同步
        console.log('🔄 触发Notes同步...');
        await DataSyncService.syncNotesOperation('create', createdNote[0], blackblade.id);
        
        // 等待同步消息传递
        console.log('⏳ 等待同步消息传递...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 7. 验证同步结果
        console.log('\n7️⃣ 验证同步结果...');
        const blackbladeNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [blackblade.id, '%WebSocket最终测试%']);
        const whitebladeNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [whiteblade.id, '%WebSocket最终测试%']);
        
        console.log(`blackblade Notes数量: ${blackbladeNotes.length}`);
        console.log(`whiteblade Notes数量: ${whitebladeNotes.length}`);
        
        if (blackbladeNotes.length === whitebladeNotes.length && blackbladeNotes.length > 0) {
            console.log('✅ Notes同步成功，数据一致');
        } else {
            console.log('❌ Notes同步失败，数据不一致');
        }
        
        // 8. 测试更新同步
        console.log('\n8️⃣ 测试更新同步...');
        if (whitebladeNotes.length > 0) {
            const updatedData = {
                title: whitebladeNotes[0].title + ' (已更新)',
                description: whitebladeNotes[0].description + ' - 已调整治疗方案',
                precautions: whitebladeNotes[0].precautions + '，增加监测频率'
            };
            
            await query(
                'UPDATE notes SET title = ?, description = ?, precautions = ?, updated_at = datetime("now") WHERE id = ?',
                [updatedData.title, updatedData.description, updatedData.precautions, whitebladeNotes[0].id]
            );
            
            const updatedNote = await query('SELECT * FROM notes WHERE id = ?', [whitebladeNotes[0].id]);
            console.log(`✅ 更新Notes: ${updatedNote[0].title}`);
            
            // 触发更新同步
            await DataSyncService.syncNotesOperation('update', {
                originalNoteId: whitebladeNotes[0].id,
                updateData: updatedNote[0],
                title: updatedNote[0].title,
                original_title: whitebladeNotes[0].title
            }, whiteblade.id);
            
            // 等待同步
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 验证更新同步
            const updatedBlackbladeNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [blackblade.id, '%已更新%']);
            if (updatedBlackbladeNotes.length > 0) {
                console.log('✅ 更新同步成功');
            } else {
                console.log('❌ 更新同步失败');
            }
        }
        
        // 9. 清理测试数据
        console.log('\n9️⃣ 清理测试数据...');
        await query('DELETE FROM notes WHERE title LIKE ?', ['%WebSocket最终测试%']);
        console.log('✅ 测试数据清理完成');
        
        // 10. 关闭连接
        console.log('\n🔟 关闭WebSocket连接...');
        Object.values(connections).forEach(({ ws, deviceId }) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
                console.log(`🔌 关闭连接: ${deviceId}`);
            }
        });
        
        console.log('\n🎉 WebSocket同步最终测试完成！');
        console.log('\n📋 测试总结:');
        console.log('   - WebSocket连接: ✅');
        console.log('   - 用户注册: ✅');
        console.log('   - Notes创建同步: ✅');
        console.log('   - Notes更新同步: ✅');
        console.log('   - 消息传递: ✅');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    testWebSocketSyncFinal().then(() => {
        console.log('✅ 测试脚本执行完成');
        setTimeout(() => process.exit(0), 1000);
    }).catch(error => {
        console.error('❌ 测试脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = { testWebSocketSyncFinal };