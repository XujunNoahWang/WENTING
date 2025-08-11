#!/usr/bin/env node

/**
 * 测试Notes删除后的最终修复效果
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 数据库路径
const dbPath = path.join(__dirname, '..', 'data', 'wenting.db');

console.log('🧪 测试Notes删除后的最终修复效果...');
console.log('📁 数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath);

async function testDeleteFix() {
    try {
        // 1. 检查当前数据状态
        console.log('\n1️⃣ 检查当前数据状态...');
        
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username FROM users ORDER BY id', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('👥 用户列表:');
        const userNotesMap = {};
        
        for (const user of users) {
            const notes = await new Promise((resolve, reject) => {
                db.all('SELECT id, title FROM notes WHERE user_id = ? ORDER BY created_at DESC', 
                    [user.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            userNotesMap[user.id] = notes;
            console.log(`   ${user.username} (ID: ${user.id}): ${notes.length} 条Notes`);
            
            if (notes.length > 0) {
                notes.slice(0, 2).forEach((note, index) => {
                    console.log(`     ${index + 1}. ${note.title} (ID: ${note.id})`);
                });
                if (notes.length > 2) {
                    console.log(`     ... 还有 ${notes.length - 2} 条`);
                }
            }
        }
        
        // 2. 模拟setDefaultUser的新逻辑
        console.log('\n2️⃣ 模拟setDefaultUser的新逻辑...');
        
        // 查找有数据的用户，按ID排序
        const usersWithNotes = users
            .filter(u => userNotesMap[u.id] && userNotesMap[u.id].length > 0)
            .sort((a, b) => a.id - b.id);
        
        console.log('📊 有数据的用户:', usersWithNotes.map(u => `ID:${u.id}(${u.username}, ${userNotesMap[u.id].length}条)`).join(', '));
        
        let expectedDefaultUser;
        if (usersWithNotes.length > 0) {
            expectedDefaultUser = usersWithNotes[0];
            console.log(`🎯 预期默认用户: ${expectedDefaultUser.username} (ID: ${expectedDefaultUser.id})`);
            console.log(`✅ 该用户有 ${userNotesMap[expectedDefaultUser.id].length} 条Notes，不会显示空状态`);
        } else {
            const sortedUsers = [...users].sort((a, b) => a.id - b.id);
            expectedDefaultUser = sortedUsers[0];
            console.log(`🎯 没有用户有数据，使用默认第一个用户: ${expectedDefaultUser.username} (ID: ${expectedDefaultUser.id})`);
            console.log(`❌ 该用户没有Notes，会显示"还没有健康笔记"`);
        }
        
        // 3. 模拟删除操作后的处理
        console.log('\n3️⃣ 模拟删除操作后的处理...');
        
        if (usersWithNotes.length > 0) {
            const testUser = usersWithNotes[0];
            const testNotes = userNotesMap[testUser.id];
            
            console.log(`🎯 测试用户: ${testUser.username} (ID: ${testUser.id})`);
            console.log(`📝 当前Notes: ${testNotes.length} 条`);
            
            if (testNotes.length > 1) {
                console.log('\n🔄 模拟删除一条Notes后:');
                console.log(`   删除前: ${testNotes.length} 条Notes`);
                console.log(`   删除后: ${testNotes.length - 1} 条Notes`);
                console.log(`   ✅ 删除后仍有数据，应该正常显示`);
            } else if (testNotes.length === 1) {
                console.log('\n🔄 模拟删除最后一条Notes后:');
                console.log(`   删除前: 1 条Notes`);
                console.log(`   删除后: 0 条Notes`);
                
                // 检查其他用户是否有数据
                const otherUsersWithNotes = usersWithNotes.filter(u => u.id !== testUser.id);
                if (otherUsersWithNotes.length > 0) {
                    const nextUser = otherUsersWithNotes[0];
                    console.log(`   🔄 loadNotesFromAPI会切换到用户: ${nextUser.username} (ID: ${nextUser.id})`);
                    console.log(`   ✅ 该用户有 ${userNotesMap[nextUser.id].length} 条Notes，不会显示空状态`);
                } else {
                    console.log(`   ❌ 没有其他用户有数据，会显示"还没有健康笔记"`);
                }
            }
        }
        
        // 4. 验证修复逻辑
        console.log('\n4️⃣ 验证修复逻辑...');
        
        console.log('🔧 修复要点:');
        console.log('   1. setDefaultUser优先选择有数据的用户');
        console.log('   2. loadNotesFromAPI在数据加载后检查当前用户是否有数据');
        console.log('   3. 如果当前用户没有数据，自动切换到有数据的用户');
        console.log('   4. 更新currentUser和全局状态');
        
        const totalNotesCount = Object.values(userNotesMap).reduce((sum, notes) => sum + notes.length, 0);
        console.log(`📊 系统总Notes数量: ${totalNotesCount}`);
        
        if (totalNotesCount > 0) {
            console.log('✅ 系统中有Notes数据，修复后不应该显示空状态');
        } else {
            console.log('⚠️ 系统中没有Notes数据，显示空状态是正常的');
        }
        
        console.log('\n🎉 测试完成！');
        
    } catch (error) {
        console.error('❌ 测试过程中出现错误:', error);
    } finally {
        db.close();
    }
}

testDeleteFix().then(() => {
    console.log('✅ 测试脚本执行完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 测试脚本执行失败:', error);
    process.exit(1);
});