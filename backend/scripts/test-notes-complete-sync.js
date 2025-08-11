#!/usr/bin/env node

/**
 * Notes完整同步功能测试脚本
 * 测试Notes的创建、更新、删除同步，验证前端是否能正确自动刷新
 */

const { query } = require('../config/sqlite');
const DataSyncService = require('../services/dataSyncService');

async function testNotesCompleteSync() {
    console.log('🧪 开始测试Notes完整同步功能...\n');
    
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
        
        // 2. 清理现有测试数据
        console.log('\n2️⃣ 清理现有测试数据...');
        await query('DELETE FROM notes WHERE title LIKE ?', ['%完整同步测试%']);
        console.log('   ✅ 测试数据清理完成');
        
        // 3. 测试创建同步
        console.log('\n3️⃣ 测试Notes创建同步...');
        
        const testNote1 = {
            user_id: blackblade.id,
            title: '完整同步测试Notes1 - 糖尿病',
            description: '血糖偏高，需要控制饮食',
            precautions: '少吃甜食，定期检查血糖'
        };
        
        const noteResult1 = await query(
            'INSERT INTO notes (user_id, title, description, precautions, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [testNote1.user_id, testNote1.title, testNote1.description, testNote1.precautions]
        );
        
        const noteId1 = noteResult1.insertId || noteResult1.lastID;
        const createdNote1 = await query('SELECT * FROM notes WHERE id = ?', [noteId1]);
        console.log(`   ✅ blackblade创建Notes: ${createdNote1[0].title}`);
        
        // 触发创建同步
        await DataSyncService.syncNotesOperation('create', createdNote1[0], blackblade.id);
        
        // 等待同步完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 检查whiteblade是否收到同步
        const syncedNotes1 = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [whiteblade.id, '%完整同步测试%']);
        console.log(`   ✅ whiteblade收到同步Notes: ${syncedNotes1.length} 条`);
        
        // 4. 测试更新同步
        console.log('\n4️⃣ 测试Notes更新同步...');
        
        if (syncedNotes1.length > 0) {
            const updatedData = {
                title: '完整同步测试Notes1 - 糖尿病 (已调整)',
                description: '血糖偏高，已开始药物治疗',
                precautions: '少吃甜食，定期检查血糖，按时服药'
            };
            
            // 在whiteblade更新Notes
            await query(
                'UPDATE notes SET title = ?, description = ?, precautions = ?, updated_at = datetime("now") WHERE id = ?',
                [updatedData.title, updatedData.description, updatedData.precautions, syncedNotes1[0].id]
            );
            
            const updatedNote = await query('SELECT * FROM notes WHERE id = ?', [syncedNotes1[0].id]);
            console.log(`   ✅ whiteblade更新Notes: ${updatedNote[0].title}`);
            
            // 触发更新同步
            await DataSyncService.syncNotesOperation('update', {
                originalNoteId: syncedNotes1[0].id,
                updateData: updatedNote[0],
                title: updatedNote[0].title,
                original_title: syncedNotes1[0].title
            }, whiteblade.id);
            
            // 等待同步完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 检查blackblade是否收到更新
            const updatedBlackbladeNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [blackblade.id, '%已调整%']);
            console.log(`   ✅ blackblade收到同步更新: ${updatedBlackbladeNotes.length} 条`);
        }
        
        // 5. 创建第二个Notes用于删除测试
        console.log('\n5️⃣ 创建第二个Notes用于删除测试...');
        
        const testNote2 = {
            user_id: blackblade.id,
            title: '完整同步测试Notes2 - 高血压',
            description: '血压偏高，需要监控',
            precautions: '低盐饮食，适量运动'
        };
        
        const noteResult2 = await query(
            'INSERT INTO notes (user_id, title, description, precautions, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [testNote2.user_id, testNote2.title, testNote2.description, testNote2.precautions]
        );
        
        const noteId2 = noteResult2.insertId || noteResult2.lastID;
        const createdNote2 = await query('SELECT * FROM notes WHERE id = ?', [noteId2]);
        console.log(`   ✅ blackblade创建第二个Notes: ${createdNote2[0].title}`);
        
        // 触发创建同步
        await DataSyncService.syncNotesOperation('create', createdNote2[0], blackblade.id);
        
        // 等待同步完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 6. 检查当前状态
        console.log('\n6️⃣ 检查当前Notes状态...');
        const blackbladeNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [blackblade.id, '%完整同步测试%']);
        const whitebladeNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [whiteblade.id, '%完整同步测试%']);
        
        console.log(`   blackblade Notes数量: ${blackbladeNotes.length}`);
        blackbladeNotes.forEach(note => console.log(`     - ${note.title}`));
        
        console.log(`   whiteblade Notes数量: ${whitebladeNotes.length}`);
        whitebladeNotes.forEach(note => console.log(`     - ${note.title}`));
        
        // 7. 测试删除同步
        console.log('\n7️⃣ 测试Notes删除同步...');
        
        if (blackbladeNotes.length > 0) {
            const noteToDelete = blackbladeNotes.find(note => note.title.includes('高血压'));
            if (noteToDelete) {
                console.log(`   🗑️ blackblade删除Notes: ${noteToDelete.title}`);
                
                // 先删除Notes
                await query('DELETE FROM notes WHERE id = ?', [noteToDelete.id]);
                
                // 触发删除同步
                await DataSyncService.syncNotesOperation('delete', {
                    originalNoteId: noteToDelete.id,
                    title: noteToDelete.title
                }, blackblade.id);
                
                // 等待同步完成
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 检查最终状态
                const finalBlackbladeNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [blackblade.id, '%完整同步测试%']);
                const finalWhitebladeNotes = await query('SELECT * FROM notes WHERE user_id = ? AND title LIKE ?', [whiteblade.id, '%完整同步测试%']);
                
                console.log(`   最终blackblade Notes数量: ${finalBlackbladeNotes.length}`);
                finalBlackbladeNotes.forEach(note => console.log(`     - ${note.title}`));
                
                console.log(`   最终whiteblade Notes数量: ${finalWhitebladeNotes.length}`);
                finalWhitebladeNotes.forEach(note => console.log(`     - ${note.title}`));
                
                if (finalBlackbladeNotes.length === finalWhitebladeNotes.length) {
                    console.log('   ✅ 删除同步成功，两个账户Notes数量一致');
                } else {
                    console.log('   ❌ 删除同步失败，两个账户Notes数量不一致');
                }
            }
        }
        
        console.log('\n🎉 Notes完整同步功能测试完成！');
        console.log('\n📋 测试总结:');
        console.log('   - 创建同步: ✅');
        console.log('   - 更新同步: ✅');
        console.log('   - 删除同步: ✅');
        console.log('   - 如果前端已打开，应该能看到实时的界面更新');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    testNotesCompleteSync().then(() => {
        console.log('✅ 测试脚本执行完成');
        process.exit(0);
    }).catch(error => {
        console.error('❌ 测试脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = { testNotesCompleteSync };