// 直接测试Link路由逻辑（不依赖HTTP服务器）
const express = require('express');
const request = require('supertest');
const linksRouter = require('../routes/links');
const { query, testConnection } = require('../config/sqlite');

// 创建测试应用
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/links', linksRouter);
    
    // 错误处理
    app.use((error, req, res, next) => {
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    });
    
    return app;
}

// 测试数据
let testData = {
    supervisedUserId: null,
    requestId: null,
    linkId: null
};

// 设置测试数据
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

// 运行路由测试
async function runRouteTests() {
    try {
        console.log('🧪 开始Link路由直接测试...');
        
        // 检查数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 设置测试数据
        await setupTestData();
        
        // 创建测试应用
        const app = createTestApp();
        
        let passedTests = 0;
        let totalTests = 0;
        
        // 测试1: 创建关联请求
        console.log('\n📝 测试1: 创建关联请求...');
        totalTests++;
        try {
            const response = await request(app)
                .post('/api/links/requests')
                .set('x-app-user', 'testmgr')
                .send({
                    fromAppUser: 'testmgr',
                    toAppUser: 'testlink',
                    supervisedUserId: testData.supervisedUserId,
                    message: '测试关联请求消息'
                });
            
            console.log(`状态码: ${response.status}`);
            console.log('响应:', response.body);
            
            if (response.status === 201 && response.body.success) {
                testData.requestId = response.body.data.id;
                console.log('✅ 创建关联请求成功');
                passedTests++;
            } else {
                console.log('❌ 创建关联请求失败');
            }
        } catch (error) {
            console.log('❌ 创建关联请求异常:', error.message);
        }
        
        // 测试2: 获取待处理请求
        console.log('\n📋 测试2: 获取待处理请求...');
        totalTests++;
        try {
            const response = await request(app)
                .get('/api/links/requests/pending/testlink');
            
            console.log(`状态码: ${response.status}`);
            console.log('响应:', response.body);
            
            if (response.status === 200 && response.body.success && response.body.data.length > 0) {
                console.log('✅ 获取待处理请求成功');
                passedTests++;
            } else {
                console.log('❌ 获取待处理请求失败');
            }
        } catch (error) {
            console.log('❌ 获取待处理请求异常:', error.message);
        }
        
        // 测试3: 处理关联请求
        console.log('\n✅ 测试3: 处理关联请求...');
        totalTests++;
        try {
            const response = await request(app)
                .put(`/api/links/requests/${testData.requestId}`)
                .send({
                    action: 'accept',
                    appUser: 'testlink'
                });
            
            console.log(`状态码: ${response.status}`);
            console.log('响应:', response.body);
            
            if (response.status === 200 && response.body.success) {
                console.log('✅ 处理关联请求成功');
                passedTests++;
            } else {
                console.log('❌ 处理关联请求失败');
            }
        } catch (error) {
            console.log('❌ 处理关联请求异常:', error.message);
        }
        
        // 测试4: 获取用户关联关系
        console.log('\n🔗 测试4: 获取用户关联关系...');
        totalTests++;
        try {
            const managerResponse = await request(app)
                .get('/api/links/user/testmgr');
            
            const linkedResponse = await request(app)
                .get('/api/links/user/testlink');
            
            console.log('管理员关联关系:');
            console.log(`状态码: ${managerResponse.status}`);
            console.log('响应:', managerResponse.body);
            
            console.log('被关联用户关联关系:');
            console.log(`状态码: ${linkedResponse.status}`);
            console.log('响应:', linkedResponse.body);
            
            if (managerResponse.status === 200 && linkedResponse.status === 200) {
                // 获取linkId用于后续测试
                if (managerResponse.body.data.asManager.length > 0) {
                    testData.linkId = managerResponse.body.data.asManager[0].id;
                }
                console.log('✅ 获取用户关联关系成功');
                passedTests++;
            } else {
                console.log('❌ 获取用户关联关系失败');
            }
        } catch (error) {
            console.log('❌ 获取用户关联关系异常:', error.message);
        }
        
        // 测试5: 验证用户权限
        console.log('\n🔐 测试5: 验证用户权限...');
        totalTests++;
        try {
            const response = await request(app)
                .get(`/api/links/permission/testmgr/${testData.supervisedUserId}`);
            
            console.log(`状态码: ${response.status}`);
            console.log('响应:', response.body);
            
            if (response.status === 200 && response.body.success && response.body.data.hasPermission) {
                console.log('✅ 验证用户权限成功');
                passedTests++;
            } else {
                console.log('❌ 验证用户权限失败');
            }
        } catch (error) {
            console.log('❌ 验证用户权限异常:', error.message);
        }
        
        // 测试6: 获取统计信息
        console.log('\n📊 测试6: 获取统计信息...');
        totalTests++;
        try {
            const response = await request(app)
                .get('/api/links/stats/testmgr');
            
            console.log(`状态码: ${response.status}`);
            console.log('响应:', response.body);
            
            if (response.status === 200 && response.body.success) {
                console.log('✅ 获取统计信息成功');
                passedTests++;
            } else {
                console.log('❌ 获取统计信息失败');
            }
        } catch (error) {
            console.log('❌ 获取统计信息异常:', error.message);
        }
        
        // 测试7: 错误处理
        console.log('\n🚨 测试7: 错误处理...');
        totalTests++;
        try {
            // 测试无效用户名
            const invalidResponse = await request(app)
                .post('/api/links/requests')
                .set('x-app-user', 'testmgr')
                .send({
                    fromAppUser: 'INVALID_USER',
                    toAppUser: 'testlink',
                    supervisedUserId: testData.supervisedUserId
                });
            
            console.log('无效用户名测试:');
            console.log(`状态码: ${invalidResponse.status}`);
            console.log('响应:', invalidResponse.body);
            
            if (invalidResponse.status === 400 && !invalidResponse.body.success) {
                console.log('✅ 错误处理测试成功');
                passedTests++;
            } else {
                console.log('❌ 错误处理测试失败');
            }
        } catch (error) {
            console.log('❌ 错误处理测试异常:', error.message);
        }
        
        // 测试8: 取消关联关系
        if (testData.linkId) {
            console.log('\n❌ 测试8: 取消关联关系...');
            totalTests++;
            try {
                const response = await request(app)
                    .delete(`/api/links/${testData.linkId}`)
                    .send({
                        appUser: 'testmgr'
                    });
                
                console.log(`状态码: ${response.status}`);
                console.log('响应:', response.body);
                
                if (response.status === 200 && response.body.success) {
                    console.log('✅ 取消关联关系成功');
                    passedTests++;
                } else {
                    console.log('❌ 取消关联关系失败');
                }
            } catch (error) {
                console.log('❌ 取消关联关系异常:', error.message);
            }
        }
        
        console.log(`\n📊 测试结果: ${passedTests}/${totalTests} 通过`);
        
        if (passedTests === totalTests) {
            console.log('🎉 所有路由测试通过！');
        } else {
            console.log('⚠️  部分测试失败');
        }
        
        return passedTests === totalTests;
        
    } catch (error) {
        console.error('❌ 路由测试失败:', error);
        return false;
    } finally {
        // 清理测试数据
        await cleanupTestData();
    }
}

// 安装supertest依赖检查
async function checkDependencies() {
    try {
        require('supertest');
        return true;
    } catch (error) {
        console.log('⚠️  需要安装supertest依赖: npm install --save-dev supertest');
        return false;
    }
}

// 主函数
async function main() {
    const hasSupertset = await checkDependencies();
    if (!hasSupertset) {
        console.log('正在安装supertest...');
        const { execSync } = require('child_process');
        try {
            execSync('npm install --save-dev supertest', { stdio: 'inherit' });
            console.log('✅ supertest安装完成');
        } catch (error) {
            console.error('❌ 安装supertest失败:', error.message);
            return;
        }
    }
    
    const success = await runRouteTests();
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = { runRouteTests };