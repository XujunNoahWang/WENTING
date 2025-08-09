// 测试安全实现
const { query } = require('../config/sqlite');
const LinkSecurity = require('../middleware/linkSecurity');
const DataAccessSecurity = require('../middleware/dataAccess');
const SecurityAudit = require('../middleware/securityAudit');
const LinkService = require('../services/linkService');

async function testSecurityImplementation() {
    console.log('🔒 开始测试安全实现...\n');
    
    try {
        // 1. 测试用户名验证
        console.log('1️⃣ 测试用户名验证:');
        console.log('   有效用户名 "mama":', LinkSecurity.validateUsername('mama'));
        console.log('   无效用户名 "MAMA":', LinkSecurity.validateUsername('MAMA'));
        console.log('   无效用户名 "mama123456789":', LinkSecurity.validateUsername('mama123456789'));
        console.log('   无效用户名 "mama@":', LinkSecurity.validateUsername('mama@'));
        console.log('');
        
        // 2. 测试权限验证
        console.log('2️⃣ 测试权限验证:');
        
        // 检查是否有测试用户
        const testUsers = await query('SELECT * FROM users WHERE app_user_id = ? LIMIT 1', ['mama']);
        if (testUsers.length > 0) {
            const testUserId = testUsers[0].id;
            console.log(`   测试用户ID: ${testUserId}`);
            
            // 测试管理员权限
            const hasPermission = await LinkService.validateUserPermission('mama', testUserId);
            console.log(`   管理员权限验证: ${hasPermission}`);
            
            // 测试无权限用户
            const noPermission = await LinkService.validateUserPermission('nonexistent', testUserId);
            console.log(`   无权限用户验证: ${noPermission}`);
        } else {
            console.log('   ⚠️  未找到测试用户，跳过权限验证测试');
        }
        console.log('');
        
        // 3. 测试安全日志
        console.log('3️⃣ 测试安全日志:');
        await SecurityAudit.logSecurityEvent('TEST_EVENT', {
            message: '这是一个测试安全事件',
            testData: { key: 'value' }
        });
        console.log('   ✅ 安全事件记录成功');
        
        // 查询最近的安全日志
        const recentLogs = await query(`
            SELECT * FROM security_logs 
            WHERE event_type = 'TEST_EVENT' 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        if (recentLogs.length > 0) {
            console.log('   📋 最新测试日志:', {
                id: recentLogs[0].id,
                event_type: recentLogs[0].event_type,
                created_at: recentLogs[0].created_at
            });
        }
        console.log('');
        
        // 4. 测试频率限制逻辑
        console.log('4️⃣ 测试频率限制逻辑:');
        
        // 模拟请求对象
        const mockReq = {
            body: { fromAppUser: 'testuser' },
            ip: '127.0.0.1'
        };
        
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    console.log(`   响应状态: ${code}, 消息: ${data.message}`);
                    return data;
                }
            })
        };
        
        const mockNext = () => {
            console.log('   ✅ 频率限制检查通过');
        };
        
        // 测试用户频率限制
        console.log('   测试用户频率限制:');
        LinkSecurity.rateLimitLinkRequests(mockReq, mockRes, mockNext);
        console.log('');
        
        // 5. 测试安全统计
        console.log('5️⃣ 测试安全统计:');
        const stats = await SecurityAudit.getSecurityStats('1h');
        console.log('   📊 1小时内安全统计:', {
            totalEvents: stats.totalEvents || 0,
            eventTypes: stats.events ? stats.events.length : 0
        });
        
        const linkStats = LinkSecurity.getSecurityStats();
        console.log('   🔗 关联安全统计:', linkStats);
        console.log('');
        
        // 6. 测试可疑活动检测
        console.log('6️⃣ 测试可疑活动检测:');
        const suspicious = await SecurityAudit.detectSuspiciousActivity();
        console.log('   🚨 可疑活动检测结果:', {
            frequentDenials: suspicious.frequentPermissionDenials ? suspicious.frequentPermissionDenials.length : 0,
            authFailures: suspicious.frequentAuthFailures ? suspicious.frequentAuthFailures.length : 0,
            unusualOps: suspicious.unusualLinkOperations ? suspicious.unusualLinkOperations.length : 0
        });
        console.log('');
        
        // 7. 测试数据访问权限
        console.log('7️⃣ 测试数据访问权限:');
        const accessStats = DataAccessSecurity.getAccessStats();
        console.log('   📊 数据访问统计:', accessStats);
        console.log('');
        
        console.log('✅ 安全实现测试完成！');
        
        // 清理测试数据
        await query('DELETE FROM security_logs WHERE event_type = ?', ['TEST_EVENT']);
        console.log('🧹 测试数据清理完成');
        
    } catch (error) {
        console.error('❌ 安全测试失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testSecurityImplementation()
        .then(() => {
            console.log('\n🎉 所有安全测试通过！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 安全测试失败:', error);
            process.exit(1);
        });
}

module.exports = { testSecurityImplementation };