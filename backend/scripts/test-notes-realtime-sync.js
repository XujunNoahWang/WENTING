#!/usr/bin/env node

/**
 * Notes实时同步功能测试脚本
 * 模拟WebSocket消息发送，测试前端是否能正确处理同步更新
 */

const { query } = require('../config/sqlite');
const websocketService = require('../services/websocketService');

async function testNotesRealtimeSync() {
    console.log('🧪 开始测试Notes实时同步功能...\n');
    
    try {
        // 1. 检查用户关联状态
        console.log('1️⃣ 检查用户关联状态...');
        const users = await query('SELECT id, app_user_id, username, is_linked, supervised_app_user FROM users WHERE app_user_id IN (?, ?)', ['blackblade', 'whiteblade']);
        
        if (users.length !== 2) {
            throw new Error('未找到blackblade和whiteblade用户');
        }
        
        const blackblade = users.find(u => u.app_user_id === 'blackblade');
        const whiteblade = users.find(u => u.app_user_id === 'whiteblade');
        
        console.log(`   blackblade (ID: ${blackblade.id}): 关联状态=${blackblade.is_linked}`);
        console.log(`   whiteblade (ID: ${whiteblade.id}): 关联状态=${whiteblade.is_linked}`);
        
        // 2. 创建测试Notes
        console.log('\n2️⃣ 创建测试Notes...');
        const testNote = {
            user_id: blackblade.id,
            title: '实时同步测试Notes - 高血压',
            description: '收缩压偏高，需要监控',
            precautions: '低盐饮食，定期测量血压'
        };
        
        const noteResult = await query(
            'INSERT INTO notes (user_id, title, description, precautions, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [testNote.user_id, testNote.title, testNote.description, testNote.precautions]
        );
        
        const noteId = noteResult.insertId || noteResult.lastID;
        const createdNote = await query('SELECT * FROM notes WHERE id = ?', [noteId]);
        console.log(`   ✅ 创建测试Notes: ${createdNote[0].title}`);
        
        // 3. 模拟WebSocket同步消息发送
        console.log('\n3️⃣ 模拟WebSocket同步消息发送...');
        
        // 模拟创建同步消息
        const createSyncMessage = {
            type: 'NOTES_SYNC_UPDATE',
            operation: 'CREATE',
            data: createdNote[0],
            sync: {
                fromUser: 'blackblade',
                userId: blackblade.id,
                timestamp: Date.now()
            }
        };
        
        console.log('📡 发送创建同步消息到whiteblade...');
        if (websocketService && websocketService.broadcastToAppUser) {
            websocketService.broadcastToAppUser('whiteblade', createSyncMessage);
            console.log('   ✅ 创建同步消息已发送');
        } else {
            console.log('   ⚠️ WebSocket服务不可用，跳过消息发送');
        }
        
        // 4. 模拟更新操作
        console.log('\n4️⃣ 模拟更新操作...');
        const updatedData = {
            title: '实时同步测试Notes - 高血压 (已调整)',
            description: '收缩压偏高，已开始服药治疗',
            precautions: '低盐饮食，定期测量血压，按时服药'
        };
        
        await query(
            'UPDATE notes SET title = ?, description = ?, precautions = ?, updated_at = datetime("now") WHERE id = ?',
            [updatedData.title, updatedData.description, updatedData.precautions, noteId]
        );
        
        const updatedNote = await query('SELECT * FROM notes WHERE id = ?', [noteId]);
        console.log(`   ✅ 更新测试Notes: ${updatedNote[0].title}`);
        
        // 模拟更新同步消息
        const updateSyncMessage = {
            type: 'NOTES_SYNC_UPDATE',
            operation: 'UPDATE',
            data: {
                ...updatedNote[0],
                originalNoteId: noteId
            },
            sync: {
                fromUser: 'blackblade',
                userId: blackblade.id,
                timestamp: Date.now()
            }
        };
        
        console.log('📡 发送更新同步消息到whiteblade...');
        if (websocketService && websocketService.broadcastToAppUser) {
            websocketService.broadcastToAppUser('whiteblade', updateSyncMessage);
            console.log('   ✅ 更新同步消息已发送');
        }
        
        // 5. 模拟删除操作
        console.log('\n5️⃣ 模拟删除操作...');
        
        // 模拟删除同步消息（先发送消息再删除）
        const deleteSyncMessage = {
            type: 'NOTES_SYNC_UPDATE',
            operation: 'DELETE',
            data: {
                originalNoteId: noteId,
                title: updatedNote[0].title
            },
            sync: {
                fromUser: 'blackblade',
                userId: blackblade.id,
                timestamp: Date.now()
            }
        };
        
        console.log('📡 发送删除同步消息到whiteblade...');
        if (websocketService && websocketService.broadcastToAppUser) {
            websocketService.broadcastToAppUser('whiteblade', deleteSyncMessage);
            console.log('   ✅ 删除同步消息已发送');
        }
        
        // 删除测试Notes
        await query('DELETE FROM notes WHERE id = ?', [noteId]);
        console.log('   ✅ 删除测试Notes完成');
        
        console.log('\n🎉 Notes实时同步功能测试完成！');
        console.log('\n📋 测试说明:');
        console.log('   - 如果前端已打开并连接WebSocket，应该能看到实时同步更新');
        console.log('   - 检查浏览器控制台是否有同步消息处理日志');
        console.log('   - 验证Notes界面是否自动刷新显示最新数据');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    testNotesRealtimeSync().then(() => {
        console.log('✅ 测试脚本执行完成');
        process.exit(0);
    }).catch(error => {
        console.error('❌ 测试脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = { testNotesRealtimeSync };