#!/usr/bin/env node

/**
 * 调试删除Notes后显示空状态的问题
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 数据库路径
const dbPath = path.join(__dirname, '..', 'data', 'wenting.db');

console.log('🔍 调试删除Notes后的数据状态...');
console.log('📁 数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath);

async function debugDeleteIssue() {
    try {
        // 1. 检查当前用户和Notes数据
        console.log('\n1️⃣ 检查当前用户和Notes数据...');
        
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username FROM users ORDER BY id', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('👥 用户列表:');
        users.forEach(user => {
            console.log(`   ${user.username}: ID=${user.id}`);
        });
        
        // 2. 检查每个用户的Notes数量
        console.log('\n2️⃣ 检查每个用户的Notes数量...');
        
        for (const user of users) {
            const notes = await new Promise((resolve, reject) => {
                db.all('SELECT id, title, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC', 
                    [user.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            console.log(`📊 用户 ${user.username} (ID: ${user.id}): ${notes.length} 条Notes`);
            
            if (notes.length > 0) {
                console.log('   Notes列表:');
                notes.forEach((note, index) => {
                    console.log(`     ${index + 1}. ${note.title} (ID: ${note.id})`);
                });
            } else {
                console.log('   ❌ 没有Notes数据 - 这会导致显示"还没有健康笔记"');
            }
        }
        
        // 3. 模拟前端删除后的处理流程
        console.log('\n3️⃣ 模拟前端删除后的处理流程...');
        
        // 假设我们要删除第一个用户的第一条Notes
        if (users.length > 0) {
            const testUser = users[0];
            const userNotes = await new Promise((resolve, reject) => {
                db.all('SELECT id, title FROM notes WHERE user_id = ? ORDER BY created_at DESC', 
                    [testUser.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            console.log(`🎯 测试用户: ${testUser.username} (ID: ${testUser.id})`);
            console.log(`📝 当前Notes数量: ${userNotes.length}`);
            
            if (userNotes.length > 0) {
                console.log('\n🔄 模拟删除流程:');
                console.log(`   1. 删除前: ${userNotes.length} 条Notes`);
                console.log(`   2. 假设删除Notes ID: ${userNotes[0].id} (${userNotes[0].title})`);
                console.log(`   3. 删除后应该有: ${userNotes.length - 1} 条Notes`);
                
                if (userNotes.length - 1 === 0) {
                    console.log('   ❌ 删除后没有Notes了，会显示"还没有健康笔记"');
                } else {
                    console.log('   ✅ 删除后还有Notes，应该正常显示');
                }
                
                // 4. 检查是否有其他用户的数据
                console.log('\n4️⃣ 检查其他用户的数据...');
                
                let totalNotesCount = 0;
                const userNotesMap = {};
                
                for (const user of users) {
                    const notes = await new Promise((resolve, reject) => {
                        db.all('SELECT COUNT(*) as count FROM notes WHERE user_id = ?', 
                            [user.id], (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows[0].count);
                        });
                    });
                    
                    userNotesMap[user.id] = notes;
                    totalNotesCount += notes;
                    console.log(`   用户 ${user.username} (ID: ${user.id}): ${notes} 条Notes`);
                }
                
                console.log(`📊 总Notes数量: ${totalNotesCount}`);
                
                // 5. 分析问题可能的原因
                console.log('\n5️⃣ 问题分析...');
                
                if (totalNotesCount === 0) {
                    console.log('❌ 所有用户都没有Notes数据');
                    console.log('   可能原因: 数据被意外清空或删除');
                } else {
                    console.log('✅ 系统中还有Notes数据');
                    
                    // 检查currentUser可能的值
                    console.log('\n🔍 可能的currentUser值分析:');
                    
                    // 按ID排序，最小ID应该是默认用户
                    const sortedUsers = [...users].sort((a, b) => a.id - b.id);
                    const expectedDefaultUser = sortedUsers[0];
                    
                    console.log(`   预期默认用户: ${expectedDefaultUser.username} (ID: ${expectedDefaultUser.id})`);
                    console.log(`   该用户Notes数量: ${userNotesMap[expectedDefaultUser.id]}`);
                    
                    if (userNotesMap[expectedDefaultUser.id] === 0) {
                        console.log('   ❌ 默认用户没有Notes，会显示空状态');
                        
                        // 查找有数据的用户
                        const usersWithNotes = users.filter(u => userNotesMap[u.id] > 0);
                        if (usersWithNotes.length > 0) {
                            console.log('   💡 建议使用有数据的用户:');
                            usersWithNotes.forEach(u => {
                                console.log(`     - ${u.username} (ID: ${u.id}): ${userNotesMap[u.id]} 条Notes`);
                            });
                        }
                    } else {
                        console.log('   ✅ 默认用户有Notes，应该正常显示');
                    }
                }
                
            } else {
                console.log('⚠️ 测试用户没有Notes数据，无法模拟删除');
            }
        }
        
        console.log('\n🎉 调试完成！');
        
    } catch (error) {
        console.error('❌ 调试过程中出现错误:', error);
    } finally {
        db.close();
    }
}

debugDeleteIssue().then(() => {
    console.log('✅ 调试脚本执行完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 调试脚本执行失败:', error);
    process.exit(1);
});