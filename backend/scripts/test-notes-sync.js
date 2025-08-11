#!/usr/bin/env node

/**
 * Notes同步功能测试脚本
 * 测试Notes的双向同步功能
 */

const { query } = require('../config/sqlite');
const DataSyncService = require('../services/dataSyncService');

async function testNotesSync() {
    console.log('🧪 开始测试Notes同步功能...\n');
    
    try {
        // 1. 检查用户关联状态
        console.log('1️⃣ 检查用户关联状态...');
        const users = await query('SELECT id, app_user_id, username, is_linked, supervised_app_user FROM users WHERE app_user_id IN (?, ?)', ['blackblade', 'whiteblade']);
        
        if (users.length !== 2) {
            throw new Error('未找到blackblade和whiteblade用户');
        }
        
        const blackblade = users.find(u => u.app_user_id === 'blackblade');
        const whiteblade = users.find(u => u.app_user_id === 'whiteblade');
        
        console.log(`   blackblade (ID: ${blackblade.id}, app_user_id: ${blackblade.app_user_id}): 关联状态=${blackblade.is_linked}, 关联用户=${blackblade.supervised_app_user}`);
        console.log(`   whiteblade (ID: ${whiteblade.id}, app_user_id: ${whiteblade.app_user_id}): 关联状态=${whiteblade.is_linked}, 关联用户=${whiteblade.supervised_app_user}`);
        
        if (!blackblade.is_linked || !whiteblade.is_linked) {
            console.log('⚠️ 用户未关联，跳过同步测试');
            return;
        }
        
        // 2. 清理测试数据
        console.log('\n2️⃣ 清理现有测试Notes...');
        await query('DELETE FROM notes WHERE title LIKE ?', ['%测试同步%']);
        console.log('   ✅ 测试Notes清理完成');
        
        // 3. 测试Notes创建同步
        console.log('\n3️⃣ 测试Notes创建同步...');
        
        // 在blackblade账户创建Notes
        const testNote = {
            user_id: blackblade.id,
            title: '测试同步Notes - 关节炎',
            description: '膝关节疼痛，特别是阴雨天气',
            precautions: '避免长时间站立，注意保暖'
        };
        
        const noteResult = await query(
            'INSERT INTO notes (user_id, title, description, precautions, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [testNote.user_id, testNote.title, testNote.description, testNote.precautions]
        );
        
        const noteId = noteResult.insertId || noteResult.lastID;
        const createdNote = await query('SELECT * FROM notes WHERE id = ?', [noteId]);
        console.log(`   ✅ 在blackblade创建Notes: ${createdNote[0].title}`);
        
        // 触发同步
        console.log('   🔄 触发Notes创建同步...');
        await DataSyncService.syncNotesOperation('create', createdNote[0], blackblade.id);
        
        // 检查whiteblade是否收到同步的Notes
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待同步完成
        
        const syncedNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [whiteblade.id, '%测试同步%']);
        
        if (syncedNotes.length > 0) {
            console.log(`   ✅ whiteblade收到同步Notes: ${syncedNotes[0].title}`);
        } else {
            console.log('   ❌ whiteblade未收到同步Notes');
        }
        
        // 4. 测试Notes更新同步
        console.log('\n4️⃣ 测试Notes更新同步...');
        
        if (syncedNotes.length > 0) {
            const updatedData = {
                title: '测试同步Notes - 关节炎 (已更新)',
                description: '膝关节疼痛，特别是阴雨天气。已开始物理治疗。',
                precautions: '避免长时间站立，注意保暖，每日进行轻度运动'
            };
            
            // 更新whiteblade的Notes
            await query(
                'UPDATE notes SET title = ?, description = ?, precautions = ?, updated_at = datetime("now") WHERE id = ?',
                [updatedData.title, updatedData.description, updatedData.precautions, syncedNotes[0].id]
            );
            
            const updatedNote = await query('SELECT * FROM notes WHERE id = ?', [syncedNotes[0].id]);
            console.log(`   ✅ 在whiteblade更新Notes: ${updatedNote[0].title}`);
            
            // 触发同步
            console.log('   🔄 触发Notes更新同步...');
            await DataSyncService.syncNotesOperation('update', {
                originalNoteId: syncedNotes[0].id,
                updateData: updatedNote[0],
                title: updatedNote[0].title,
                original_title: syncedNotes[0].title  // 🔥 关键：传递原始标题用于匹配
            }, whiteblade.id);
            
            // 检查blackblade是否收到更新
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 查找blackblade中匹配标题的Notes（因为同步是基于标题匹配的）
            const updatedBlackbladeNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [blackblade.id, '%已更新%']);
            
            if (updatedBlackbladeNotes.length > 0) {
                console.log(`   ✅ blackblade收到同步更新: ${updatedBlackbladeNotes[0].title}`);
            } else {
                console.log('   ❌ blackblade未收到同步更新');
                // 检查是否有任何Notes
                const allBlackbladeNotes = await query('SELECT * FROM notes WHERE user_id = ?', [blackblade.id]);
                console.log(`   📝 blackblade当前Notes:`, allBlackbladeNotes.map(n => n.title));
            }
        }
        
        // 5. 测试Notes删除同步
        console.log('\n5️⃣ 测试Notes删除同步...');
        
        // 查找blackblade中的测试Notes（可能标题已更新）
        const blackbladeTestNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [blackblade.id, '%测试同步%']);
        
        if (blackbladeTestNotes.length > 0) {
            const noteToDelete = blackbladeTestNotes[0];
            console.log(`   🗑️ 删除blackblade的Notes: ${noteToDelete.title}`);
            
            // 先删除原始Notes
            await query('DELETE FROM notes WHERE id = ?', [noteToDelete.id]);
            
            // 然后触发删除同步
            await DataSyncService.syncNotesOperation('delete', {
                originalNoteId: noteToDelete.id,
                title: noteToDelete.title
            }, blackblade.id);
            
            // 检查whiteblade的Notes是否被删除
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const remainingNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [whiteblade.id, '%测试同步%']);
            
            if (remainingNotes.length === 0) {
                console.log('   ✅ whiteblade的同步Notes已删除');
            } else {
                console.log('   ❌ whiteblade的同步Notes未删除');
                console.log(`   📝 whiteblade剩余Notes:`, remainingNotes.map(n => n.title));
            }
        } else {
            console.log('   ⚠️ 未找到blackblade的测试Notes，跳过删除测试');
        }
        
        // 6. 显示最终状态
        console.log('\n6️⃣ 最终状态检查...');
        const finalBlackbladeNotes = await query('SELECT COUNT(*) as count FROM notes WHERE user_id = ?', [blackblade.id]);
        const finalWhitebladeNotes = await query('SELECT COUNT(*) as count FROM notes WHERE user_id = ?', [whiteblade.id]);
        
        console.log(`   blackblade Notes数量: ${finalBlackbladeNotes[0].count}`);
        console.log(`   whiteblade Notes数量: ${finalWhitebladeNotes[0].count}`);
        
        console.log('\n🎉 Notes同步功能测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    testNotesSync().then(() => {
        console.log('✅ 测试脚本执行完成');
        process.exit(0);
    }).catch(error => {
        console.error('❌ 测试脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = { testNotesSync };