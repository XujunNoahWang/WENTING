#!/usr/bin/env node

/**
 * Notes用户ID修复测试脚本
 * 测试用户ID不一致导致的显示问题
 */

const { query } = require('../config/sqlite');

async function testNotesUserIdFix() {
    console.log('🧪 开始测试Notes用户ID修复...\n');
    
    try {
        // 1. 检查用户状态
        console.log('1️⃣ 检查用户状态...');
        const users = await query('SELECT id, app_user_id, username, is_linked FROM users WHERE app_user_id IN (?, ?)', ['blackblade', 'whiteblade']);
        
        if (users.length !== 2) {
            throw new Error('未找到blackblade和whiteblade用户');
        }
        
        const blackblade = users.find(u => u.app_user_id === 'blackblade');
        const whiteblade = users.find(u => u.app_user_id === 'whiteblade');
        
        console.log(`   blackblade: ID=${blackblade.id}, username=${blackblade.username}`);
        console.log(`   whiteblade: ID=${whiteblade.id}, username=${whiteblade.username}`);
        
        // 2. 清理并创建测试数据
        console.log('\n2️⃣ 准备测试数据...');
        await query('DELETE FROM notes WHERE title LIKE ?', ['%用户ID测试%']);
        
        // 为每个用户创建Notes
        const testNotes = [
            {
                user_id: blackblade.id,
                title: '用户ID测试Notes1 - blackblade',
                description: 'blackblade的测试Notes',
                precautions: '测试用户ID匹配'
            },
            {
                user_id: whiteblade.id,
                title: '用户ID测试Notes2 - whiteblade',
                description: 'whiteblade的测试Notes',
                precautions: '测试用户ID匹配'
            }
        ];
        
        for (const noteData of testNotes) {
            const result = await query(
                'INSERT INTO notes (user_id, title, description, precautions, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
                [noteData.user_id, noteData.title, noteData.description, noteData.precautions]
            );
            
            console.log(`   ✅ 创建Notes: ${noteData.title} (用户ID: ${noteData.user_id})`);
        }
        
        // 3. 测试API数据加载
        console.log('\n3️⃣ 测试API数据加载...');
        
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
        
        // 测试每个用户的数据加载
        for (const user of users) {
            const response = await ApiClient.notes.getByUserId(user.id);
            console.log(`   用户 ${user.app_user_id} (ID: ${user.id}):`, {
                success: response.success,
                count: response.data ? response.data.length : 0,
                titles: response.data ? response.data.map(n => n.title) : []
            });
        }
        
        // 4. 模拟前端数据存储和读取
        console.log('\n4️⃣ 模拟前端数据存储和读取...');
        
        // 模拟NotesManager的数据存储逻辑
        const notes = {};
        
        console.log('📥 模拟数据加载和存储...');
        for (const user of users) {
            const response = await ApiClient.notes.getByUserId(user.id);
            if (response.success) {
                notes[user.id] = response.data || [];
                console.log(`   存储到 notes[${user.id}]: ${notes[user.id].length} 条`);
            }
        }
        
        console.log('📊 存储后的数据结构:');
        Object.keys(notes).forEach(userId => {
            console.log(`   notes[${userId}]: ${notes[userId].length} 条Notes`);
        });
        
        // 5. 测试不同用户ID的读取
        console.log('\n5️⃣ 测试不同用户ID的读取...');
        
        const testUserIds = [1, 20, 21, '1', '20', '21'];
        
        for (const testId of testUserIds) {
            const userNotes = notes[testId] || [];
            console.log(`   读取 notes[${testId}] (类型: ${typeof testId}): ${userNotes.length} 条Notes`);
        }
        
        // 6. 检查GlobalUserState可能的值
        console.log('\n6️⃣ 检查可能的用户ID来源...');
        
        // 模拟可能的GlobalUserState值
        const possibleUserIds = [
            1, // 可能的默认值
            blackblade.id, // 真实的blackblade ID
            whiteblade.id, // 真实的whiteblade ID
            parseInt(blackblade.id), // 确保是数字
            parseInt(whiteblade.id)
        ];
        
        console.log('🔍 可能的用户ID值:');
        possibleUserIds.forEach(id => {
            const hasData = notes[id] && notes[id].length > 0;
            console.log(`   ID ${id} (类型: ${typeof id}): ${hasData ? '有数据' : '无数据'}`);
        });
        
        // 7. 清理测试数据
        console.log('\n7️⃣ 清理测试数据...');
        await query('DELETE FROM notes WHERE title LIKE ?', ['%用户ID测试%']);
        console.log('   ✅ 测试数据清理完成');
        
        console.log('\n🎉 Notes用户ID修复测试完成！');
        
        // 8. 问题诊断
        console.log('\n📋 问题诊断:');
        console.log('   问题根源: 数据存储和读取使用的用户ID不一致');
        console.log('   存储时: 使用真实的user.id (如20, 21)');
        console.log('   读取时: 可能使用错误的currentUser值 (如1)');
        console.log('   解决方案: 确保currentUser使用正确的用户ID');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    testNotesUserIdFix().then(() => {
        console.log('✅ 测试脚本执行完成');
        process.exit(0);
    }).catch(error => {
        console.error('❌ 测试脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = { testNotesUserIdFix };