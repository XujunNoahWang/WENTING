// Link API路由测试脚本
const axios = require('axios');
const { query, testConnection } = require('../config/sqlite');

const API_BASE = 'http://localhost:3001/api/links';

// 测试数据
let testData = {
    appUsers: ['testmgr', 'testlink'],
    supervisedUserId: null,
    requestId: null,
    linkId: null
};

// HTTP客户端配置
const client = axios.create({
    baseURL: API_BASE,
    timeout: 5000,
    validateStatus: () => true // 不抛出HTTP错误
});

// 创建测试数据
async function setupTestData() {
    try {
        console.log('🔧 设置测试数据...');
        
        // 清理旧数据
        await query('DELETE FROM user_links WHERE manager_app_user IN (?, ?) OR linked_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM link_requests WHERE from_app_user IN (?, ?) OR to_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM users WHERE app_user_id IN (?, ?)', ['testmgr', 'testlink']);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        
        // 创建测试用户
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testmgr', 'hash1']);
        await query('INSERT INTO app_users (username, password_hash) VALUES (?, ?)', ['testlink', 'hash2']);
        
        // 创建被监管用户
        const result = await query(`
            INSERT INTO users (app_user_id, username, display_name, device_id) 
            VALUES (?, ?, ?, ?)
        `, ['testmgr', 'testsupervised', '测试被监管用户', 'testdevice']);
        
        testData.supervisedUserId = result.insertId;
        console.log(`✅ 测试数据设置完成，被监管用户ID: ${testData.supervisedUserId}`);
        
    } catch (error) {
        console.error('❌ 设置测试数据失败:', error);
        throw error;
    }
}

// 清理测试数据
async function cleanupTestData() {
    try {
        console.log('🧹 清理测试数据...');
        
        await query('DELETE FROM user_links WHERE manager_app_user IN (?, ?) OR linked_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM link_requests WHERE from_app_user IN (?, ?) OR to_app_user IN (?, ?)', 
                   ['testmgr', 'testlink', 'testmgr', 'testlink']);
        await query('DELETE FROM users WHERE app_user_id IN (?, ?)', ['testmgr', 'testlink']);
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmgr', 'testlink']);
        
        console.log('✅ 测试数据清理完成');
        
    } catch (error) {
        console.error('❌ 清理测试数据失败:', error);
    }
}

// 测试创建关联请求
async function testCreateRequest() {
    console.log('\n📝 测试1: 创建关联请求...');
    
    const response = await client.post('/requests', {
        fromAppUser: 'testmgr',
        toAppUser: 'testlink',
        supervisedUserId: testData.supervisedUserId,
        message: '测试关联请求消息'
    });
    
    console.log(`状态码: ${response.status}`);
    console.log('响应:', response.data);
    
    if (response.status === 201 && response.data.success) {
        testData.requestId = response.data.data.id;
        console.log('✅ 创建关联请求成功');
        return true;
    } else {
        console.log('❌ 创建关联请求失败');
        return false;
    }
}

// 测试获取待处理请求
async function testGetPendingRequests() {
    console.log('\n📋 测试2: 获取待处理请求...');
    
    const response = await client.get('/requests/pending/testlink');
    
    console.log(`状态码: ${response.status}`);
    console.log('响应:', response.data);
    
    if (response.status === 200 && response.data.success && response.data.data.length > 0) {
        console.log('✅ 获取待处理请求成功');
        return true;
    } else {
        console.log('❌ 获取待处理请求失败');
        return false;
    }
}

// 测试处理关联请求
async function testHandleRequest() {
    console.log('\n✅ 测试3: 处理关联请求...');
    
    const response = await client.put(`/requests/${testData.requestId}`, {
        action: 'accept',
        appUser: 'testlink'
    });
    
    console.log(`状态码: ${response.status}`);
    console.log('响应:', response.data);
    
    if (response.status === 200 && response.data.success) {
        console.log('✅ 处理关联请求成功');
        return true;
    } else {
        console.log('❌ 处理关联请求失败');
        return false;
    }
}

// 测试获取用户关联关系
async function testGetUserLinks() {
    console.log('\n🔗 测试4: 获取用户关联关系...');
    
    const managerResponse = await client.get('/links/testmgr');
    const linkedResponse = await client.get('/links/testlink');
    
    console.log('管理员关联关系:');
    console.log(`状态码: ${managerResponse.status}`);
    console.log('响应:', managerResponse.data);
    
    console.log('被关联用户关联关系:');
    console.log(`状态码: ${linkedResponse.status}`);
    console.log('响应:', linkedResponse.data);
    
    if (managerResponse.status === 200 && linkedResponse.status === 200) {
        // 获取linkId用于后续测试
        if (managerResponse.data.data.asManager.length > 0) {
            testData.linkId = managerResponse.data.data.asManager[0].id;
        }
        console.log('✅ 获取用户关联关系成功');
        return true;
    } else {
        console.log('❌ 获取用户关联关系失败');
        return false;
    }
}

// 测试验证用户权限
async function testValidatePermission() {
    console.log('\n🔐 测试5: 验证用户权限...');
    
    const managerResponse = await client.get(`/permissions/testmgr/${testData.supervisedUserId}`);
    const linkedResponse = await client.get(`/permissions/testlink/${testData.supervisedUserId}`);
    const noPermResponse = await client.get(`/permissions/nonexist/${testData.supervisedUserId}`);
    
    console.log('管理员权限:');
    console.log(`状态码: ${managerResponse.status}`);
    console.log('响应:', managerResponse.data);
    
    console.log('被关联用户权限:');
    console.log(`状态码: ${linkedResponse.status}`);
    console.log('响应:', linkedResponse.data);
    
    console.log('无关用户权限:');
    console.log(`状态码: ${noPermResponse.status}`);
    console.log('响应:', noPermResponse.data);
    
    if (managerResponse.status === 200 && linkedResponse.status === 200) {
        console.log('✅ 验证用户权限成功');
        return true;
    } else {
        console.log('❌ 验证用户权限失败');
        return false;
    }
}

// 测试取消关联关系
async function testCancelLink() {
    console.log('\n❌ 测试6: 取消关联关系...');
    
    if (!testData.linkId) {
        console.log('⚠️  没有linkId，跳过测试');
        return true;
    }
    
    const response = await client.delete(`/links/${testData.linkId}`, {
        data: {
            appUser: 'testmgr'
        }
    });
    
    console.log(`状态码: ${response.status}`);
    console.log('响应:', response.data);
    
    if (response.status === 200 && response.data.success) {
        console.log('✅ 取消关联关系成功');
        return true;
    } else {
        console.log('❌ 取消关联关系失败');
        return false;
    }
}

// 测试获取统计信息
async function testGetStats() {
    console.log('\n📊 测试7: 获取统计信息...');
    
    const response = await client.get('/stats');
    
    console.log(`状态码: ${response.status}`);
    console.log('响应:', response.data);
    
    if (response.status === 200 && response.data.success) {
        console.log('✅ 获取统计信息成功');
        return true;
    } else {
        console.log('❌ 获取统计信息失败');
        return false;
    }
}

// 测试清理过期请求
async function testCleanupExpired() {
    console.log('\n🧹 测试8: 清理过期请求...');
    
    // 先创建一个过期请求
    await query(`
        INSERT INTO link_requests (from_app_user, to_app_user, supervised_user_id, supervised_user_name, expires_at)
        VALUES (?, ?, ?, ?, datetime('now', '-1 day'))
    `, ['testmgr', 'testlink', testData.supervisedUserId, '过期测试']);
    
    const response = await client.post('/cleanup/expired');
    
    console.log(`状态码: ${response.status}`);
    console.log('响应:', response.data);
    
    if (response.status === 200 && response.data.success) {
        console.log('✅ 清理过期请求成功');
        return true;
    } else {
        console.log('❌ 清理过期请求失败');
        return false;
    }
}

// 测试错误处理
async function testErrorHandling() {
    console.log('\n🚨 测试9: 错误处理...');
    
    // 测试无效的用户名
    const invalidUserResponse = await client.post('/requests', {
        fromAppUser: 'INVALID_USER',
        toAppUser: 'testlink',
        supervisedUserId: testData.supervisedUserId
    });
    
    console.log('无效用户名测试:');
    console.log(`状态码: ${invalidUserResponse.status}`);
    console.log('响应:', invalidUserResponse.data);
    
    // 测试无效的被监管用户ID
    const invalidIdResponse = await client.post('/requests', {
        fromAppUser: 'testmgr',
        toAppUser: 'testlink',
        supervisedUserId: 'invalid'
    });
    
    console.log('无效ID测试:');
    console.log(`状态码: ${invalidIdResponse.status}`);
    console.log('响应:', invalidIdResponse.data);
    
    // 测试不存在的请求
    const notFoundResponse = await client.put('/requests/99999', {
        action: 'accept',
        appUser: 'testlink'
    });
    
    console.log('不存在请求测试:');
    console.log(`状态码: ${notFoundResponse.status}`);
    console.log('响应:', notFoundResponse.data);
    
    if (invalidUserResponse.status === 400 && invalidIdResponse.status === 400 && notFoundResponse.status === 404) {
        console.log('✅ 错误处理测试成功');
        return true;
    } else {
        console.log('❌ 错误处理测试失败');
        return false;
    }
}

// 运行所有测试
async function runAllTests() {
    try {
        console.log('🧪 开始Link API路由测试...');
        
        // 检查数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 设置测试数据
        await setupTestData();
        
        const tests = [
            testCreateRequest,
            testGetPendingRequests,
            testHandleRequest,
            testGetUserLinks,
            testValidatePermission,
            testCancelLink,
            testGetStats,
            testCleanupExpired,
            testErrorHandling
        ];
        
        let passedTests = 0;
        
        for (const test of tests) {
            try {
                const result = await test();
                if (result) {
                    passedTests++;
                }
            } catch (error) {
                console.error(`❌ 测试执行失败:`, error.message);
            }
        }
        
        console.log(`\n📊 测试结果: ${passedTests}/${tests.length} 通过`);
        
        if (passedTests === tests.length) {
            console.log('🎉 所有API测试通过！');
        } else {
            console.log('⚠️  部分测试失败，请检查服务器状态');
        }
        
    } catch (error) {
        console.error('❌ 测试套件失败:', error);
    } finally {
        // 清理测试数据
        await cleanupTestData();
    }
}

// 检查服务器是否运行
async function checkServerStatus() {
    try {
        const response = await axios.get('http://localhost:3001/health', { timeout: 3000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// 主函数
async function main() {
    console.log('🔍 检查服务器状态...');
    
    const serverRunning = await checkServerStatus();
    if (!serverRunning) {
        console.error('❌ 服务器未运行，请先启动服务器: npm start');
        process.exit(1);
    }
    
    console.log('✅ 服务器运行正常');
    
    await runAllTests();
}

if (require.main === module) {
    main().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { runAllTests };