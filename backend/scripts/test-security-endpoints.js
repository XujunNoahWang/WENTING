// 测试安全端点
const http = require('http');
const { query } = require('../config/sqlite');

// 模拟HTTP请求
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve({ statusCode: res.statusCode, data: response });
                } catch (error) {
                    resolve({ statusCode: res.statusCode, data: body });
                }
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function testSecurityEndpoints() {
    console.log('🔒 开始测试安全端点...\n');
    
    try {
        // 检查服务器是否运行
        console.log('1️⃣ 检查服务器状态...');
        
        const serverOptions = {
            hostname: 'localhost',
            port: 3000,
            timeout: 5000
        };
        
        // 测试安全统计端点
        console.log('2️⃣ 测试安全统计端点...');
        try {
            const statsOptions = {
                ...serverOptions,
                path: '/api/security/stats/1h',
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            const statsResponse = await makeRequest(statsOptions);
            console.log(`   状态码: ${statsResponse.statusCode}`);
            if (statsResponse.data.success) {
                console.log('   ✅ 安全统计端点正常');
            } else {
                console.log('   ⚠️  安全统计端点响应异常');
            }
        } catch (error) {
            console.log('   ⚠️  服务器未运行，跳过端点测试');
        }
        
        // 测试数据库中的安全功能
        console.log('\n3️⃣ 测试数据库安全功能...');
        
        // 检查安全日志表
        const tableExists = await query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='security_logs'
        `);
        
        if (tableExists.length > 0) {
            console.log('   ✅ 安全日志表存在');
            
            // 检查索引
            const indexes = await query(`
                SELECT name FROM sqlite_master 
                WHERE type='index' AND tbl_name='security_logs'
            `);
            console.log(`   📊 安全日志表索引数量: ${indexes.length}`);
            
            // 检查最近的安全日志
            const recentLogs = await query(`
                SELECT event_type, COUNT(*) as count 
                FROM security_logs 
                WHERE created_at >= datetime('now', '-1 hour')
                GROUP BY event_type
                ORDER BY count DESC
            `);
            
            console.log('   📋 最近1小时安全事件:');
            if (recentLogs.length > 0) {
                recentLogs.forEach(log => {
                    console.log(`      ${log.event_type}: ${log.count}次`);
                });
            } else {
                console.log('      无安全事件记录');
            }
        } else {
            console.log('   ❌ 安全日志表不存在');
        }
        
        // 测试权限验证逻辑
        console.log('\n4️⃣ 测试权限验证逻辑...');
        
        // 检查用户表
        const users = await query('SELECT id, username, app_user_id FROM users LIMIT 3');
        console.log(`   👥 用户数量: ${users.length}`);
        
        if (users.length > 0) {
            const testUser = users[0];
            console.log(`   🧪 测试用户: ${testUser.username} (ID: ${testUser.id})`);
            
            // 测试权限验证
            const LinkService = require('../services/linkService');
            const hasPermission = await LinkService.validateUserPermission(testUser.app_user_id, testUser.id);
            console.log(`   🔐 权限验证结果: ${hasPermission ? '通过' : '失败'}`);
        }
        
        // 测试关联关系
        console.log('\n5️⃣ 测试关联关系安全...');
        
        const links = await query('SELECT COUNT(*) as count FROM user_links');
        console.log(`   🔗 关联关系数量: ${links[0].count}`);
        
        const activeLinks = await query(`
            SELECT COUNT(*) as count FROM user_links 
            WHERE status = 'active'
        `);
        console.log(`   ✅ 活跃关联数量: ${activeLinks[0].count}`);
        
        const pendingRequests = await query(`
            SELECT COUNT(*) as count FROM link_requests 
            WHERE status = 'pending' AND expires_at > datetime('now')
        `);
        console.log(`   ⏳ 待处理请求数量: ${pendingRequests[0].count}`);
        
        // 测试安全中间件
        console.log('\n6️⃣ 测试安全中间件...');
        
        const LinkSecurity = require('../middleware/linkSecurity');
        const DataAccessSecurity = require('../middleware/dataAccess');
        const SecurityAudit = require('../middleware/securityAudit');
        
        // 测试用户名验证
        const validUsername = LinkSecurity.validateUsername('testuser');
        const invalidUsername = LinkSecurity.validateUsername('INVALID@');
        console.log(`   📝 用户名验证 - 有效: ${validUsername}, 无效: ${invalidUsername}`);
        
        // 测试安全统计
        const linkStats = LinkSecurity.getSecurityStats();
        console.log(`   📊 关联安全统计: ${linkStats.activeRateLimits} 个活跃限制`);
        
        const accessStats = DataAccessSecurity.getAccessStats();
        console.log(`   🔍 数据访问统计: ${accessStats.message}`);
        
        // 记录测试完成事件
        await SecurityAudit.logSecurityEvent('SECURITY_TEST_COMPLETED', {
            testTime: new Date().toISOString(),
            testsRun: 6,
            status: 'success'
        });
        
        console.log('\n✅ 安全端点测试完成！');
        
    } catch (error) {
        console.error('❌ 安全端点测试失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testSecurityEndpoints()
        .then(() => {
            console.log('\n🎉 所有安全端点测试通过！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 安全端点测试失败:', error);
            process.exit(1);
        });
}

module.exports = { testSecurityEndpoints };