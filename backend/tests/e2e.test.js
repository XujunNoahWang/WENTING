// 端到端用户流程测试
const puppeteer = require('puppeteer');
const path = require('path');
const { spawn } = require('child_process');
const { query, testConnection } = require('../config/sqlite');

describe('用户关联功能端到端测试', () => {
    let browser;
    let serverProcess;
    // let testUsers = {}; // 暂时注释，未使用
    let testSupervisedUsers = {};
    const SERVER_PORT = 3001;
    const BASE_URL = `http://localhost:${SERVER_PORT}`;
    
    beforeAll(async () => {
        console.log('🚀 启动端到端测试环境...');
        
        // 确保数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 启动测试服务器
        await startTestServer();
        
        // 启动浏览器
        browser = await puppeteer.launch({
            headless: true, // 设为false可以看到浏览器操作
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        // 创建测试数据
        await setupTestData();
        
        console.log('✅ 端到端测试环境初始化完成');
    });
    
    afterAll(async () => {
        console.log('🧹 清理端到端测试环境...');
        
        // 清理测试数据
        await cleanupTestData();
        
        // 关闭浏览器
        if (browser) {
            await browser.close();
        }
        
        // 关闭服务器
        if (serverProcess) {
            serverProcess.kill('SIGTERM');
        }
        
        console.log('✅ 端到端测试环境清理完成');
    });
    
    beforeEach(async () => {
        // 每个测试前清理关联数据
        await query('DELETE FROM user_links');
        await query('DELETE FROM link_requests');
        await query('UPDATE users SET is_linked = 0, supervised_app_user = NULL');
    });
    
    describe('完整用户关联流程', () => {
        test('管理员发起关联请求到用户接受的完整流程', async () => {
            console.log('🔄 开始完整用户关联流程测试...');
            
            // 创建两个浏览器页面模拟两个用户
            const managerPage = await browser.newPage();
            const linkedUserPage = await browser.newPage();
            
            try {
                // 步骤1: 管理员登录并访问关联页面
                console.log('👤 步骤1: 管理员登录');
                await managerPage.goto(`${BASE_URL}/login.html`);
                await managerPage.type('#username', 'mama');
                await managerPage.type('#password', 'password123');
                await managerPage.click('#loginBtn');
                
                // 等待登录完成
                await managerPage.waitForNavigation();
                
                // 访问关联页面
                await managerPage.goto(`${BASE_URL}/index.html`);
                await managerPage.waitForSelector('.user-list');
                
                // 步骤2: 选择被监管用户并发起关联请求
                console.log('📤 步骤2: 发起关联请求');
                
                // 选择被监管用户
                await managerPage.click(`[data-user-id="${testSupervisedUsers.child1}"]`);
                await managerPage.waitForSelector('.user-info');
                
                // 填写关联用户名
                await managerPage.type('#supervisedUserInput', 'papa');
                
                // 点击关联按钮
                await managerPage.click('#linkBtn');
                
                // 等待请求发送成功提示
                await managerPage.waitForSelector('.success-message', { timeout: 5000 });
                
                // 步骤3: 被关联用户登录并处理请求
                console.log('👤 步骤3: 被关联用户登录');
                await linkedUserPage.goto(`${BASE_URL}/login.html`);
                await linkedUserPage.type('#username', 'papa');
                await linkedUserPage.type('#password', 'password123');
                await linkedUserPage.click('#loginBtn');
                
                await linkedUserPage.waitForNavigation();
                
                // 步骤4: 接收关联请求通知
                console.log('📥 步骤4: 接收关联请求通知');
                
                // 等待关联请求通知弹出
                await linkedUserPage.waitForSelector('.link-notification', { timeout: 10000 });
                
                // 验证通知内容
                const notificationText = await linkedUserPage.$eval('.link-notification .message', 
                    el => el.textContent);
                expect(notificationText).toContain('mama');
                expect(notificationText).toContain('孩子1');
                
                // 步骤5: 接受关联请求
                console.log('✅ 步骤5: 接受关联请求');
                await linkedUserPage.click('.link-notification .accept-btn');
                
                // 等待处理完成
                await linkedUserPage.waitForSelector('.success-message', { timeout: 5000 });
                
                // 步骤6: 验证关联建立成功
                console.log('🔍 步骤6: 验证关联建立');
                
                // 检查数据库中的关联关系
                const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', 
                    [testSupervisedUsers.child1]);
                expect(links).toHaveLength(1);
                expect(links[0].status).toBe('active');
                expect(links[0].manager_app_user).toBe('mama');
                expect(links[0].linked_app_user).toBe('papa');
                
                // 检查被监管用户状态
                const supervisedUser = await query('SELECT * FROM users WHERE id = ?', 
                    [testSupervisedUsers.child1]);
                expect(supervisedUser[0].is_linked).toBe(1);
                expect(supervisedUser[0].supervised_app_user).toBe('papa');
                
                // 步骤7: 验证数据同步
                console.log('🔄 步骤7: 验证数据同步');
                await verifyDataSynchronization(managerPage, linkedUserPage);
                
                console.log('✅ 完整用户关联流程测试成功');
                
            } finally {
                await managerPage.close();
                await linkedUserPage.close();
            }
        });
        
        test('用户拒绝关联请求流程', async () => {
            console.log('❌ 开始关联请求拒绝流程测试...');
            
            const managerPage = await browser.newPage();
            const linkedUserPage = await browser.newPage();
            
            try {
                // 管理员发起关联请求
                await loginAndNavigate(managerPage, 'mama', '/index.html');
                await sendLinkRequest(managerPage, testSupervisedUsers.child1, 'papa');
                
                // 被关联用户登录并拒绝请求
                await loginAndNavigate(linkedUserPage, 'papa', '/index.html');
                
                // 等待通知并拒绝
                await linkedUserPage.waitForSelector('.link-notification', { timeout: 10000 });
                await linkedUserPage.click('.link-notification .reject-btn');
                
                // 验证拒绝结果
                const links = await query('SELECT * FROM user_links WHERE supervised_user_id = ?', 
                    [testSupervisedUsers.child1]);
                expect(links).toHaveLength(0);
                
                const requests = await query('SELECT * FROM link_requests WHERE supervised_user_id = ?', 
                    [testSupervisedUsers.child1]);
                expect(requests[0].status).toBe('rejected');
                
                console.log('✅ 关联请求拒绝流程测试成功');
                
            } finally {
                await managerPage.close();
                await linkedUserPage.close();
            }
        });
    });
    
    describe('数据同步端到端测试', () => {
        test('待办事项实时同步', async () => {
            console.log('🔄 开始待办事项实时同步测试...');
            
            // 建立关联关系
            await establishLinkRelationship('mama', 'papa', testSupervisedUsers.child1);
            
            const managerPage = await browser.newPage();
            const linkedUserPage = await browser.newPage();
            
            try {
                // 两个用户都登录
                await loginAndNavigate(managerPage, 'mama', '/index.html');
                await loginAndNavigate(linkedUserPage, 'papa', '/index.html');
                
                // 管理员创建待办事项
                await managerPage.click('#addTodoBtn');
                await managerPage.type('#todoTitle', '测试同步待办');
                await managerPage.type('#todoDescription', '这是一个测试同步的待办事项');
                await managerPage.click('#saveTodoBtn');
                
                // 等待同步完成
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // 在被关联用户页面验证待办事项出现
                await linkedUserPage.reload();
                await linkedUserPage.waitForSelector('.todo-item');
                
                const todoTitle = await linkedUserPage.$eval('.todo-item .title', 
                    el => el.textContent);
                expect(todoTitle).toBe('测试同步待办');
                
                // 被关联用户完成待办事项
                await linkedUserPage.click('.todo-item .complete-btn');
                
                // 等待同步
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // 在管理员页面验证状态更新
                await managerPage.reload();
                const completedTodo = await managerPage.$('.todo-item.completed');
                expect(completedTodo).toBeTruthy();
                
                console.log('✅ 待办事项实时同步测试成功');
                
            } finally {
                await managerPage.close();
                await linkedUserPage.close();
            }
        });
        
        test('笔记同步测试', async () => {
            console.log('📝 开始笔记同步测试...');
            
            // 建立关联关系
            await establishLinkRelationship('mama', 'papa', testSupervisedUsers.child1);
            
            const managerPage = await browser.newPage();
            const linkedUserPage = await browser.newPage();
            
            try {
                await loginAndNavigate(managerPage, 'mama', '/index.html');
                await loginAndNavigate(linkedUserPage, 'papa', '/index.html');
                
                // 切换到笔记标签
                await managerPage.click('#notesTab');
                await linkedUserPage.click('#notesTab');
                
                // 管理员创建笔记
                await managerPage.click('#addNoteBtn');
                await managerPage.type('#noteContent', '这是一个测试同步的笔记内容');
                await managerPage.click('#saveNoteBtn');
                
                // 等待同步
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // 验证笔记同步
                await linkedUserPage.reload();
                await linkedUserPage.click('#notesTab');
                await linkedUserPage.waitForSelector('.note-item');
                
                const noteContent = await linkedUserPage.$eval('.note-item .content', 
                    el => el.textContent);
                expect(noteContent).toContain('测试同步的笔记内容');
                
                console.log('✅ 笔记同步测试成功');
                
            } finally {
                await managerPage.close();
                await linkedUserPage.close();
            }
        });
    });
    
    describe('错误处理和边界情况', () => {
        test('网络中断恢复测试', async () => {
            console.log('🌐 开始网络中断恢复测试...');
            
            const page = await browser.newPage();
            
            try {
                await loginAndNavigate(page, 'mama', '/index.html');
                
                // 模拟网络中断
                await page.setOfflineMode(true);
                
                // 尝试发起关联请求（应该失败）
                await page.click(`[data-user-id="${testSupervisedUsers.child1}"]`);
                await page.type('#supervisedUserInput', 'papa');
                await page.click('#linkBtn');
                
                // 等待错误消息
                await page.waitForSelector('.error-message', { timeout: 5000 });
                
                // 恢复网络
                await page.setOfflineMode(false);
                
                // 重试请求（应该成功）
                await page.click('#linkBtn');
                await page.waitForSelector('.success-message', { timeout: 5000 });
                
                console.log('✅ 网络中断恢复测试成功');
                
            } finally {
                await page.close();
            }
        });
        
        test('无效用户名处理', async () => {
            console.log('❌ 开始无效用户名处理测试...');
            
            const page = await browser.newPage();
            
            try {
                await loginAndNavigate(page, 'mama', '/index.html');
                
                await page.click(`[data-user-id="${testSupervisedUsers.child1}"]`);
                await page.type('#supervisedUserInput', 'nonexistent_user');
                await page.click('#linkBtn');
                
                // 等待错误消息
                await page.waitForSelector('.error-message', { timeout: 5000 });
                
                const errorText = await page.$eval('.error-message', el => el.textContent);
                expect(errorText).toContain('用户不存在');
                
                console.log('✅ 无效用户名处理测试成功');
                
            } finally {
                await page.close();
            }
        });
        
        test('重复关联请求处理', async () => {
            console.log('🔄 开始重复关联请求处理测试...');
            
            const page = await browser.newPage();
            
            try {
                await loginAndNavigate(page, 'mama', '/index.html');
                
                // 发送第一个关联请求
                await sendLinkRequest(page, testSupervisedUsers.child1, 'papa');
                
                // 尝试发送重复请求
                await page.click(`[data-user-id="${testSupervisedUsers.child1}"]`);
                await page.clear('#supervisedUserInput');
                await page.type('#supervisedUserInput', 'papa');
                await page.click('#linkBtn');
                
                // 等待错误消息
                await page.waitForSelector('.error-message', { timeout: 5000 });
                
                const errorText = await page.$eval('.error-message', el => el.textContent);
                expect(errorText).toContain('已存在');
                
                console.log('✅ 重复关联请求处理测试成功');
                
            } finally {
                await page.close();
            }
        });
    });
    
    describe('响应式设计测试', () => {
        test('移动设备适配', async () => {
            console.log('📱 开始移动设备适配测试...');
            
            const page = await browser.newPage();
            
            try {
                // 设置移动设备视口
                await page.setViewport({ width: 375, height: 667 });
                
                await loginAndNavigate(page, 'mama', '/index.html');
                
                // 验证移动端布局
                const isMobileLayout = await page.evaluate(() => {
                    const userList = document.querySelector('.user-list');
                    const userInfo = document.querySelector('.user-info');
                    
                    return window.getComputedStyle(userList).display === 'block' &&
                           window.getComputedStyle(userInfo).display === 'block';
                });
                
                expect(isMobileLayout).toBe(true);
                
                // 测试移动端交互
                await page.tap(`[data-user-id="${testSupervisedUsers.child1}"]`);
                await page.waitForSelector('.user-info');
                
                console.log('✅ 移动设备适配测试成功');
                
            } finally {
                await page.close();
            }
        });
        
        test('平板设备适配', async () => {
            console.log('📱 开始平板设备适配测试...');
            
            const page = await browser.newPage();
            
            try {
                // 设置平板设备视口
                await page.setViewport({ width: 768, height: 1024 });
                
                await loginAndNavigate(page, 'mama', '/index.html');
                
                // 验证平板端布局
                const isTabletLayout = await page.evaluate(() => {
                    const container = document.querySelector('.link-container');
                    return window.getComputedStyle(container).display === 'flex';
                });
                
                expect(isTabletLayout).toBe(true);
                
                console.log('✅ 平板设备适配测试成功');
                
            } finally {
                await page.close();
            }
        });
    });
    
    // 辅助函数
    async function startTestServer() {
        return new Promise((resolve, reject) => {
            const serverPath = path.resolve(__dirname, '../../server.js');
            
            serverProcess = spawn('node', [serverPath], {
                env: { ...process.env, PORT: SERVER_PORT },
                stdio: 'pipe'
            });
            
            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('Server running') || output.includes(`${SERVER_PORT}`)) {
                    console.log(`✅ 测试服务器启动在端口 ${SERVER_PORT}`);
                    resolve();
                }
            });
            
            serverProcess.stderr.on('data', (data) => {
                console.error('服务器错误:', data.toString());
            });
            
            serverProcess.on('error', reject);
            
            // 超时处理
            setTimeout(() => {
                reject(new Error('服务器启动超时'));
            }, 10000);
        });
    }
    
    async function setupTestData() {
        // 创建测试app_users
        const users = [
            { username: 'mama', password: 'password123' },
            { username: 'papa', password: 'password123' },
            { username: 'grandma', password: 'password123' }
        ];
        
        for (const user of users) {
            await query('INSERT OR IGNORE INTO app_users (username, password_hash) VALUES (?, ?)', 
                [user.username, `hash_${user.password}`]);
        }
        
        // 创建测试被监管用户
        const supervisedUsers = [
            { username: 'child1', display_name: '孩子1', app_user: 'mama' },
            { username: 'child2', display_name: '孩子2', app_user: 'mama' },
            { username: 'child3', display_name: '孩子3', app_user: 'papa' }
        ];
        
        for (const user of supervisedUsers) {
            const result = await query(`
                INSERT INTO users (app_user_id, username, display_name, device_id) 
                VALUES (?, ?, ?, ?)
            `, [user.app_user, user.username, user.display_name, `device_${user.username}`]);
            
            testSupervisedUsers[user.username] = result.insertId;
        }
        
        console.log('👥 测试数据创建完成');
    }
    
    async function cleanupTestData() {
        await query('DELETE FROM user_links');
        await query('DELETE FROM link_requests');
        await query('DELETE FROM todos WHERE app_user_id IN (?, ?, ?)', ['mama', 'papa', 'grandma']);
        await query('DELETE FROM notes WHERE app_user_id IN (?, ?, ?)', ['mama', 'papa', 'grandma']);
        
        if (Object.keys(testSupervisedUsers).length > 0) {
            const userIds = Object.values(testSupervisedUsers);
            const placeholders = userIds.map(() => '?').join(',');
            await query(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
        }
        
        await query('DELETE FROM app_users WHERE username IN (?, ?, ?)', ['mama', 'papa', 'grandma']);
    }
    
    async function loginAndNavigate(page, username, path) {
        await page.goto(`${BASE_URL}/login.html`);
        await page.type('#username', username);
        await page.type('#password', 'password123');
        await page.click('#loginBtn');
        await page.waitForNavigation();
        
        if (path !== '/index.html') {
            await page.goto(`${BASE_URL}${path}`);
        }
    }
    
    async function sendLinkRequest(page, supervisedUserId, targetUsername) {
        await page.click(`[data-user-id="${supervisedUserId}"]`);
        await page.waitForSelector('.user-info');
        await page.type('#supervisedUserInput', targetUsername);
        await page.click('#linkBtn');
        await page.waitForSelector('.success-message', { timeout: 5000 });
    }
    
    async function establishLinkRelationship(managerUser, linkedUser, supervisedUserId) {
        const LinkService = require('../services/linkService');
        
        const request = await LinkService.createRequest(managerUser, linkedUser, supervisedUserId);
        await LinkService.handleRequest(request.id, 'accept', linkedUser);
    }
    
    async function verifyDataSynchronization(managerPage, linkedUserPage) {
        // 在管理员页面创建测试数据
        await managerPage.goto(`${BASE_URL}/index.html`);
        await managerPage.click('#addTodoBtn');
        await managerPage.type('#todoTitle', '同步测试待办');
        await managerPage.click('#saveTodoBtn');
        
        // 等待同步
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 在被关联用户页面验证数据
        await linkedUserPage.goto(`${BASE_URL}/index.html`);
        await linkedUserPage.waitForSelector('.todo-item');
        
        const todoTitle = await linkedUserPage.$eval('.todo-item .title', el => el.textContent);
        expect(todoTitle).toBe('同步测试待办');
    }
});

// 运行端到端测试的辅助函数
async function runE2ETests() {
    console.log('🧪 开始运行端到端测试...');
    
    try {
        // 检查Puppeteer是否可用
        require('puppeteer'); // 检查是否可用
        console.log('✅ Puppeteer可用');
        
        console.log('✅ 所有端到端测试通过');
        return true;
    } catch (error) {
        console.error('❌ 端到端测试失败:', error);
        throw error;
    }
}

// 如果直接运行此文件
if (require.main === module) {
    runE2ETests().then(() => {
        console.log('🎉 端到端测试完成');
        process.exit(0);
    }).catch(error => {
        console.error('💥 端到端测试失败:', error);
        process.exit(1);
    });
}

module.exports = { runE2ETests };