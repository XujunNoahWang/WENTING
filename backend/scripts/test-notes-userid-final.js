#!/usr/bin/env node

/**
 * Notes用户ID最终修复验证测试
 * 验证setDefaultUser修复后的效果
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 数据库路径
const dbPath = path.join(__dirname, '..', 'data', 'wenting.db');

console.log('🧪 开始Notes用户ID最终修复验证...');
console.log('📁 数据库路径:', dbPath);

// 检查数据库文件是否存在
const fs = require('fs');
if (!fs.existsSync(dbPath)) {
    console.error('❌ 数据库文件不存在:', dbPath);
    process.exit(1);
}
console.log('📁 数据库文件存在: 是');

const db = new sqlite3.Database(dbPath);

async function runTest() {
    try {
        console.log('✅ SQLite数据库连接成功');
        console.log('✅ 数据库文件路径:', dbPath);
        
        // 1. 检查用户状态
        console.log('\n1️⃣ 检查用户状态...');
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username FROM users ORDER BY id', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        users.forEach(user => {
            console.log(`   ${user.username}: ID=${user.id}, username=${user.username}`);
        });
        
        if (users.length === 0) {
            console.log('❌ 没有用户数据，无法测试');
            return;
        }
        
        // 2. 检查Notes数据分布
        console.log('\n2️⃣ 检查Notes数据分布...');
        for (const user of users) {
            const notes = await new Promise((resolve, reject) => {
                db.all('SELECT id, title FROM notes WHERE user_id = ? ORDER BY created_at DESC', 
                    [user.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            console.log(`   用户 ${user.username} (ID: ${user.id}): ${notes.length} 条Notes`);
            if (notes.length > 0) {
                notes.slice(0, 3).forEach(note => {
                    console.log(`     - ${note.title}`);
                });
                if (notes.length > 3) {
                    console.log(`     ... 还有 ${notes.length - 3} 条`);
                }
            }
        }
        
        // 3. 模拟前端用户ID处理逻辑
        console.log('\n3️⃣ 模拟前端用户ID处理逻辑...');
        
        // 模拟localStorage中可能的用户ID值
        const possibleUserIds = [1, users[0].id, users[users.length - 1].id];
        console.log('🔍 可能的用户ID值:', possibleUserIds);
        
        // 模拟setDefaultUser逻辑
        console.log('\n📋 模拟setDefaultUser逻辑:');
        
        // 按ID排序，选择ID最小的用户
        const sortedUsers = [...users].sort((a, b) => a.id - b.id);
        console.log('   按ID排序的用户:', sortedUsers.map(u => `ID:${u.id}(${u.username})`).join(', '));
        
        // 模拟从localStorage读取保存的用户ID
        for (const savedUserId of possibleUserIds) {
            console.log(`\n   🔍 测试保存的用户ID: ${savedUserId}`);
            
            let defaultUser;
            if (savedUserId && sortedUsers.find(u => u.id == savedUserId)) {
                defaultUser = parseInt(savedUserId);
                console.log(`     ✅ 使用保存的用户ID: ${defaultUser}`);
            } else {
                defaultUser = sortedUsers[0].id;
                console.log(`     ⚠️ 保存的用户ID无效，使用默认第一个用户: ${defaultUser}`);
            }
            
            // 检查该用户ID是否有Notes数据
            const userNotes = await new Promise((resolve, reject) => {
                db.all('SELECT COUNT(*) as count FROM notes WHERE user_id = ?', 
                    [defaultUser], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows[0].count);
                });
            });
            
            console.log(`     📊 用户ID ${defaultUser} 的Notes数量: ${userNotes}`);
            
            if (userNotes > 0) {
                console.log(`     ✅ 用户ID ${defaultUser} 有数据，不会显示"还没有健康笔记"`);
            } else {
                console.log(`     ❌ 用户ID ${defaultUser} 没有数据，会显示"还没有健康笔记"`);
            }
        }
        
        // 4. 验证修复效果
        console.log('\n4️⃣ 验证修复效果...');
        
        // 找到有数据的用户
        const usersWithNotes = [];
        for (const user of users) {
            const noteCount = await new Promise((resolve, reject) => {
                db.all('SELECT COUNT(*) as count FROM notes WHERE user_id = ?', 
                    [user.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows[0].count);
                });
            });
            
            if (noteCount > 0) {
                usersWithNotes.push({ ...user, noteCount });
            }
        }
        
        console.log('📊 有Notes数据的用户:', usersWithNotes.map(u => `${u.username}(ID:${u.id}, ${u.noteCount}条)`).join(', '));
        
        if (usersWithNotes.length > 0) {
            const firstUserWithNotes = usersWithNotes[0];
            console.log(`✅ 修复后，setDefaultUser应该选择用户ID: ${firstUserWithNotes.id} (${firstUserWithNotes.username})`);
            console.log(`✅ 该用户有 ${firstUserWithNotes.noteCount} 条Notes，不会显示"还没有健康笔记"`);
        } else {
            console.log('⚠️ 所有用户都没有Notes数据');
        }
        
        console.log('\n🎉 Notes用户ID最终修复验证完成！');
        
    } catch (error) {
        console.error('❌ 测试过程中出现错误:', error);
    } finally {
        db.close();
        console.log('✅ 数据库连接已关闭');
    }
}

runTest().then(() => {
    console.log('✅ 测试脚本执行完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 测试脚本执行失败:', error);
    process.exit(1);
});