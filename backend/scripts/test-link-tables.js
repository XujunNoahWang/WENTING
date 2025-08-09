// 测试Link功能数据库表
const { query, testConnection } = require('../config/sqlite');

async function testLinkTables() {
    try {
        console.log('🧪 开始测试Link功能数据库表...');
        
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 创建测试用户
        console.log('👤 创建测试用户...');
        try {
            await query('INSERT OR IGNORE INTO app_users (username, password_hash) VALUES (?, ?)', ['testuser1', 'hash1']);
            await query('INSERT OR IGNORE INTO app_users (username, password_hash) VALUES (?, ?)', ['testuser2', 'hash2']);
            
            await query(`INSERT OR IGNORE INTO users (app_user_id, username, display_name, device_id) 
                        VALUES (?, ?, ?, ?)`, ['testuser1', 'test_supervised', '测试被监管用户', 'device1']);
        } catch (error) {
            console.log('ℹ️  测试用户可能已存在');
        }
        
        // 获取被监管用户ID
        const supervisedUsers = await query('SELECT id FROM users WHERE username = ? AND app_user_id = ?', ['test_supervised', 'testuser1']);
        if (supervisedUsers.length === 0) {
            throw new Error('测试被监管用户不存在');
        }
        const supervisedUserId = supervisedUsers[0].id;
        
        // 测试插入关联请求
        console.log('📝 测试插入关联请求...');
        const requestResult = await query(`
            INSERT INTO link_requests (from_app_user, to_app_user, supervised_user_id, supervised_user_name, message)
            VALUES (?, ?, ?, ?, ?)
        `, ['testuser1', 'testuser2', supervisedUserId, '测试被监管用户', '测试关联请求']);
        
        console.log('✅ 关联请求插入成功，ID:', requestResult.insertId);
        
        // 测试查询关联请求
        const requests = await query('SELECT * FROM link_requests WHERE id = ?', [requestResult.insertId]);
        console.log('📋 查询到的关联请求:', requests[0]);
        
        // 测试插入用户关联
        console.log('📝 测试插入用户关联...');
        const linkResult = await query(`
            INSERT INTO user_links (manager_app_user, linked_app_user, supervised_user_id, status)
            VALUES (?, ?, ?, ?)
        `, ['testuser1', 'testuser2', supervisedUserId, 'active']);
        
        console.log('✅ 用户关联插入成功，ID:', linkResult.insertId);
        
        // 测试查询用户关联
        const links = await query('SELECT * FROM user_links WHERE id = ?', [linkResult.insertId]);
        console.log('📋 查询到的用户关联:', links[0]);
        
        // 清理测试数据
        console.log('🧹 清理测试数据...');
        await query('DELETE FROM link_requests WHERE id = ?', [requestResult.insertId]);
        await query('DELETE FROM user_links WHERE id = ?', [linkResult.insertId]);
        await query('DELETE FROM users WHERE id = ?', [supervisedUserId]);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testuser1', 'testuser2']);
        
        console.log('🎉 Link功能数据库表测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        throw error;
    }
}

testLinkTables().then(() => {
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});