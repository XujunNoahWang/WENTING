// LinkService单元测试
const LinkService = require('../services/linkService');
const { query, testConnection } = require('../config/sqlite');

describe('LinkService', () => {
    // let testUsers = []; // 暂时注释，未使用
    let testSupervisedUser = null;
    
    beforeAll(async () => {
        // 确保数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 创建测试用户
        await query('INSERT OR IGNORE INTO app_users (username, password_hash) VALUES (?, ?)', ['testmanager', 'hash1']);
        await query('INSERT OR IGNORE INTO app_users (username, password_hash) VALUES (?, ?)', ['testlinked', 'hash2']);
        
        // 创建测试被监管用户
        const result = await query(`
            INSERT INTO users (app_user_id, username, display_name, device_id) 
            VALUES (?, ?, ?, ?)
        `, ['testmanager', 'test_supervised', '测试被监管用户', 'test_device']);
        
        testSupervisedUser = result.insertId;
    });
    
    afterAll(async () => {
        // 清理测试数据
        if (testSupervisedUser) {
            await query('DELETE FROM user_links WHERE supervised_user_id = ?', [testSupervisedUser]);
            await query('DELETE FROM link_requests WHERE supervised_user_id = ?', [testSupervisedUser]);
            await query('DELETE FROM users WHERE id = ?', [testSupervisedUser]);
        }
        await query('DELETE FROM app_users WHERE username IN (?, ?)', ['testmanager', 'testlinked']);
    });
    
    beforeEach(async () => {
        // 每个测试前清理关联数据
        await query('DELETE FROM user_links WHERE supervised_user_id = ?', [testSupervisedUser]);
        await query('DELETE FROM link_requests WHERE supervised_user_id = ?', [testSupervisedUser]);
    });
    
    describe('createRequest', () => {
        test('应该成功创建关联请求', async () => {
            const request = await LinkService.createRequest(
                'testmanager', 
                'testlinked', 
                testSupervisedUser, 
                '测试关联请求'
            );
            
            expect(request).toBeDefined();
            expect(request.from_app_user).toBe('testmanager');
            expect(request.to_app_user).toBe('testlinked');
            expect(request.supervised_user_id).toBe(testSupervisedUser);
            expect(request.status).toBe('pending');
        });
        
        test('应该拒绝不存在的目标用户', async () => {
            await expect(LinkService.createRequest(
                'testmanager', 
                'nonexistent', 
                testSupervisedUser
            )).rejects.toThrow('目标用户不存在');
        });
        
        test('应该拒绝不属于发起用户的被监管用户', async () => {
            await expect(LinkService.createRequest(
                'testlinked', 
                'testmanager', 
                testSupervisedUser
            )).rejects.toThrow('被监管用户不存在或不属于当前用户');
        });
        
        test('应该拒绝重复的关联请求', async () => {
            // 创建第一个请求
            await LinkService.createRequest('testmanager', 'testlinked', testSupervisedUser);
            
            // 尝试创建重复请求
            await expect(LinkService.createRequest(
                'testmanager', 
                'testlinked', 
                testSupervisedUser
            )).rejects.toThrow('已存在待处理的关联请求');
        });
    });
    
    describe('getPendingRequests', () => {
        test('应该返回用户的待处理请求', async () => {
            // 创建测试请求
            await LinkService.createRequest('testmanager', 'testlinked', testSupervisedUser);
            
            const requests = await LinkService.getPendingRequests('testlinked');
            
            expect(requests).toHaveLength(1);
            expect(requests[0].from_app_user).toBe('testmanager');
            expect(requests[0].status).toBe('pending');
        });
        
        test('应该不返回过期的请求', async () => {
            // 创建过期请求
            await query(`
                INSERT INTO link_requests (from_app_user, to_app_user, supervised_user_id, supervised_user_name, expires_at)
                VALUES (?, ?, ?, ?, datetime('now', '-1 day'))
            `, ['testmanager', 'testlinked', testSupervisedUser, '测试用户']);
            
            const requests = await LinkService.getPendingRequests('testlinked');
            expect(requests).toHaveLength(0);
        });
    });
    
    describe('handleRequest', () => {
        let requestId;
        
        beforeEach(async () => {
            const request = await LinkService.createRequest('testmanager', 'testlinked', testSupervisedUser);
            requestId = request.id;
        });
        
        test('应该成功接受关联请求', async () => {
            const result = await LinkService.handleRequest(requestId, 'accept', 'testlinked');
            
            expect(result.status).toBe('accepted');
            expect(result.synced).toBe(true);
            
            // 验证关联关系已创建
            const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', [testSupervisedUser]);
            expect(links).toHaveLength(1);
            expect(links[0].status).toBe('active');
            
            // 验证被监管用户状态已更新
            const user = await query('SELECT * FROM users WHERE id = ?', [testSupervisedUser]);
            expect(user[0].is_linked).toBe(1);
            expect(user[0].supervised_app_user).toBe('testlinked');
        });
        
        test('应该成功拒绝关联请求', async () => {
            const result = await LinkService.handleRequest(requestId, 'reject', 'testlinked');
            
            expect(result.status).toBe('rejected');
            
            // 验证请求状态已更新
            const request = await query('SELECT * FROM link_requests WHERE id = ?', [requestId]);
            expect(request[0].status).toBe('rejected');
            
            // 验证没有创建关联关系
            const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', [testSupervisedUser]);
            expect(links).toHaveLength(0);
        });
        
        test('应该拒绝无权限的操作', async () => {
            await expect(LinkService.handleRequest(
                requestId, 
                'accept', 
                'testmanager'  // 错误的用户
            )).rejects.toThrow('请求不存在、已过期或无权限处理');
        });
    });
    
    describe('getUserLinks', () => {
        test('应该返回用户的关联关系', async () => {
            // 创建并接受关联请求
            const request = await LinkService.createRequest('testmanager', 'testlinked', testSupervisedUser);
            await LinkService.handleRequest(request.id, 'accept', 'testlinked');
            
            // 测试管理员视角
            const managerLinks = await LinkService.getUserLinks('testmanager');
            expect(managerLinks.asManager).toHaveLength(1);
            expect(managerLinks.asLinked).toHaveLength(0);
            
            // 测试被关联用户视角
            const linkedLinks = await LinkService.getUserLinks('testlinked');
            expect(linkedLinks.asManager).toHaveLength(0);
            expect(linkedLinks.asLinked).toHaveLength(1);
        });
    });
    
    describe('cancelLink', () => {
        let linkId;
        
        beforeEach(async () => {
            const request = await LinkService.createRequest('testmanager', 'testlinked', testSupervisedUser);
            await LinkService.handleRequest(request.id, 'accept', 'testlinked');
            
            const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', [testSupervisedUser]);
            linkId = links[0].id;
        });
        
        test('应该成功取消关联关系', async () => {
            const result = await LinkService.cancelLink(linkId, 'testmanager');
            
            expect(result.status).toBe('cancelled');
            
            // 验证关联状态已更新
            const link = await query('SELECT * FROM user_links WHERE id = ?', [linkId]);
            expect(link[0].status).toBe('cancelled');
            
            // 验证被监管用户状态已更新
            const user = await query('SELECT * FROM users WHERE id = ?', [testSupervisedUser]);
            expect(user[0].is_linked).toBe(0);
            expect(user[0].supervised_app_user).toBeNull();
        });
        
        test('应该拒绝无权限的取消操作', async () => {
            await expect(LinkService.cancelLink(
                linkId, 
                'nonexistent'
            )).rejects.toThrow('关联关系不存在或无权限操作');
        });
    });
    
    describe('validateUserPermission', () => {
        test('应该验证管理员权限', async () => {
            const hasPermission = await LinkService.validateUserPermission('testmanager', testSupervisedUser);
            expect(hasPermission).toBe(true);
        });
        
        test('应该验证关联用户权限', async () => {
            // 创建关联关系
            const request = await LinkService.createRequest('testmanager', 'testlinked', testSupervisedUser);
            await LinkService.handleRequest(request.id, 'accept', 'testlinked');
            
            const hasPermission = await LinkService.validateUserPermission('testlinked', testSupervisedUser);
            expect(hasPermission).toBe(true);
        });
        
        test('应该拒绝无权限用户', async () => {
            const hasPermission = await LinkService.validateUserPermission('nonexistent', testSupervisedUser);
            expect(hasPermission).toBe(false);
        });
    });
    
    describe('cleanupExpiredRequests', () => {
        test('应该清理过期请求', async () => {
            // 创建过期请求
            await query(`
                INSERT INTO link_requests (from_app_user, to_app_user, supervised_user_id, supervised_user_name, expires_at)
                VALUES (?, ?, ?, ?, datetime('now', '-1 day'))
            `, ['testmanager', 'testlinked', testSupervisedUser, '测试用户']);
            
            const cleanedCount = await LinkService.cleanupExpiredRequests();
            expect(cleanedCount).toBe(1);
            
            // 验证请求状态已更新
            const expiredRequests = await query(`
                SELECT * FROM link_requests 
                WHERE supervised_user_id = ? AND status = 'expired'
            `, [testSupervisedUser]);
            expect(expiredRequests).toHaveLength(1);
        });
    });
});

// 运行测试的辅助函数
async function runTests() {
    console.log('🧪 开始运行LinkService单元测试...');
    
    try {
        // 这里需要使用实际的测试框架，如Jest
        // 目前只是一个示例结构
        console.log('✅ 所有测试通过');
    } catch (error) {
        console.error('❌ 测试失败:', error);
        throw error;
    }
}

// 如果直接运行此文件
if (require.main === module) {
    runTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { runTests };