// 检查数据库表结构
const { query, testConnection } = require('../config/sqlite');

async function checkTables() {
    try {
        console.log('🔍 检查数据库表结构...');
        
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 检查user_links表结构
        try {
            const userLinksSchema = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_links'");
            console.log('📋 user_links 表结构:');
            console.log(userLinksSchema[0]?.sql || '表不存在');
        } catch (error) {
            console.log('❌ user_links 表不存在');
        }
        
        // 检查link_requests表结构
        try {
            const linkRequestsSchema = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='link_requests'");
            console.log('📋 link_requests 表结构:');
            console.log(linkRequestsSchema[0]?.sql || '表不存在');
        } catch (error) {
            console.log('❌ link_requests 表不存在');
        }
        
        // 检查users表结构
        try {
            const usersSchema = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
            console.log('📋 users 表结构:');
            console.log(usersSchema[0]?.sql || '表不存在');
        } catch (error) {
            console.log('❌ users 表不存在');
        }
        
    } catch (error) {
        console.error('❌ 检查表结构失败:', error);
    }
}

checkTables().then(() => {
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});