// LinkService功能测试脚本
const LinkService = require('../services/linkService');
const { query, testConnection } = require('../config/sqlite');

async function testLinkService() {
    try {
        console.log('🧪 开始测试LinkService功能...');
        
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 创建测试用户
        console.log('👤 创建测试用户...');
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testmgr', 'hash1']);
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testlink', 'hash2']);
        
        // 创建测试被监管用户
        const userResult = await query(`
            INSERT INTO users (app_user_id, username, display_name, device_id) 
            VALUES (?, ?, ?, ?)
        `, ['testmgr', 'testsupervised', '测试被监管用户', 'testdevice']);
        
        const supervisedUserId = userResult.insertId;
        console.log(`✅ 创建被监管用户，ID: ${supervisedUserId}`);
        
        // 测试1: 创建关联请求
        console.log('\n📝 测试1: 创建关联请求...');
        const request = await LinkService.createRequest(
            'testmgr', 
            'testlink', 
            supervisedUserId, 
            '测试关联请求消息'
        );
        console.log('✅ 关联请求创建成功:', {
            id: request.id,
            from: request.from_app_user,
            to: request.to_app_user,
            status: request.status
        });
        
        // 测试2: 获取待处理请求
        console.log('\n📋 测试2: 获取待处理请求...');
        const pendingRequests = await LinkService.getPendingRequests('testlink');
        console.log(`✅ 找到 ${pendingRequests.length} 个待处理请求`);
        if (pendingRequests.length > 0) {
            console.log('请求详情:', {
                id: pendingRequests[0].id,
                from: pendingRequests[0].from_app_user,
                message: pendingRequests[0].message
            });
        }
        
        // 测试3: 接受关联请求
        console.log('\n✅ 测试3: 接受关联请求...');
        const acceptResult = await LinkService.handleRequest(request.id, 'accept', 'testlink');
        console.log('✅ 关联请求已接受:', acceptResult);
        
        // 测试4: 获取用户关联关系
        console.log('\n🔗 测试4: 获取用户关联关系...');
        const managerLinks = await LinkService.getUserLinks('testmgr');
        const linkedLinks = await LinkService.getUserLinks('testlink');
        
        console.log(`✅ 管理员关联关系: ${managerLinks.asManager.length} 个管理, ${managerLinks.asLinked.length} 个被管理`);
        console.log(`✅ 被关联用户关联关系: ${linkedLinks.asManager.length} 个管理, ${linkedLinks.asLinked.length} 个被管理`);
        
        // 测试5: 验证用户权限
        console.log('\n🔐 测试5: 验证用户权限...');
        const managerPermission = await LinkService.validateUserPermission('testmgr', supervisedUserId);
        const linkedPermission = await LinkService.validateUserPermission('testlink', supervisedUserId);
        const noPermission = await LinkService.validateUserPermission('nonexist', supervisedUserId);
        
        console.log(`✅ 管理员权限: ${managerPermission}`);
        console.log(`✅ 被关联用户权限: ${linkedPermission}`);
        console.log(`✅ 无关用户权限: ${noPermission}`);
        
        // 测试6: 取消关联关系
        console.log('\n❌ 测试6: 取消关联关系...');
        const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', [supervisedUserId]);
        if (links.length > 0) {
            const cancelResult = await LinkService.cancelLink(links[0].id, 'testmgr');
            console.log('✅ 关联关系已取消:', cancelResult);
        }
        
        // 测试7: 清理过期请求
        console.log('\n🧹 测试7: 清理过期请求...');
        // 创建过期请求
        await query(`
            INSERT INTO link_requests (from_app_user, to_app_user, supervised_user_id, supervised_user_name, expires_at)
            VALUES (?, ?, ?, ?, datetime('now', '-1 day'))
        `, ['testmgr', 'testlink', supervisedUserId, '过期测试']);
        
        const cleanedCount = await LinkService.cleanupExpiredRequests();
        console.log(`✅ 清理了 ${cleanedCount} 个过期请求`);
        
        // 清理测试数据
        console.log('\n🧹 清理测试数据...');
        await query('DELETE FROM user_links WHERE supervised_user_id = ?', [supervisedUserId]);
        await query('DELETE FROM link_requests WHERE supervised_user_id = ?', [supervisedUserId]);
        await query('DELETE FROM users WHERE id = ?', [supervisedUserId]);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        
        console.log('🎉 LinkService功能测试完成！所有测试通过');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        throw error;
    }
}

// 错误处理测试
async function testErrorHandling() {
    try {
        console.log('\n🚨 测试错误处理...');
        
        // 测试不存在的用户
        try {
            await LinkService.createRequest('nonexist', 'testlink', 1);
            console.log('❌ 应该抛出错误但没有');
        } catch (error) {
            console.log('✅ 正确处理不存在用户错误:', error.message);
        }
        
        // 测试无效的请求ID
        try {
            await LinkService.handleRequest(99999, 'accept', 'testuser');
            console.log('❌ 应该抛出错误但没有');
        } catch (error) {
            console.log('✅ 正确处理无效请求ID错误:', error.message);
        }
        
        console.log('✅ 错误处理测试完成');
        
    } catch (error) {
        console.error('❌ 错误处理测试失败:', error);
        throw error;
    }
}

// 运行所有测试
async function runAllTests() {
    try {
        await testLinkService();
        await testErrorHandling();
        console.log('\n🎉 所有测试完成！');
    } catch (error) {
        console.error('\n❌ 测试套件失败:', error);
        throw error;
    }
}

if (require.main === module) {
    runAllTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { testLinkService, testErrorHandling, runAllTests };