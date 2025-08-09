// Jest测试环境设置
const { testConnection } = require('../config/sqlite');

// 全局测试设置
beforeAll(async () => {
    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = ':memory:'; // 使用内存数据库进行测试
    
    // 测试数据库连接
    const connected = await testConnection();
    if (!connected) {
        throw new Error('测试数据库连接失败');
    }
    
    console.log('🔧 测试环境初始化完成');
});

// 全局测试清理
afterAll(async () => {
    console.log('🧹 测试环境清理完成');
});

// 每个测试前的设置
beforeEach(() => {
    // 重置模拟和间谍
    jest.clearAllMocks();
});

// 每个测试后的清理
afterEach(() => {
    // 清理定时器
    jest.clearAllTimers();
});

// 全局测试工具函数
global.testUtils = {
    // 等待指定时间
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // 创建测试用户
    createTestUser: async (username, appUser = 'test_manager') => {
        const { query } = require('../config/sqlite');
        
        const result = await query(`
            INSERT INTO users (app_user_id, username, display_name, device_id) 
            VALUES (?, ?, ?, ?)
        `, [appUser, username, `测试用户_${username}`, `device_${username}`]);
        
        return result.insertId;
    },
    
    // 创建测试app用户
    createTestAppUser: async (username, password = 'test123') => {
        const { query } = require('../config/sqlite');
        
        await query('INSERT OR IGNORE INTO app_users (username, password_hash) VALUES (?, ?)', 
            [username, `hash_${password}`]);
        
        return username;
    },
    
    // 清理测试数据
    cleanupTestData: async () => {
        const { query } = require('../config/sqlite');
        
        await query('DELETE FROM user_links');
        await query('DELETE FROM link_requests');
        await query('DELETE FROM todos WHERE app_user_id LIKE ?', ['test_%']);
        await query('DELETE FROM notes WHERE app_user_id LIKE ?', ['test_%']);
        await query('DELETE FROM users WHERE app_user_id LIKE ?', ['test_%']);
        await query('DELETE FROM app_users WHERE username LIKE ?', ['test_%']);
    }
};

// 扩展Jest匹配器
expect.extend({
    // 检查数据库记录是否存在
    async toExistInDatabase(received, table, conditions) {
        const { query } = require('../config/sqlite');
        
        const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
        const values = Object.values(conditions);
        
        const records = await query(`SELECT * FROM ${table} WHERE ${whereClause}`, values);
        
        const pass = records.length > 0;
        
        if (pass) {
            return {
                message: () => `期望记录不存在于表 ${table} 中，但找到了 ${records.length} 条记录`,
                pass: true
            };
        } else {
            return {
                message: () => `期望记录存在于表 ${table} 中，但没有找到匹配的记录`,
                pass: false
            };
        }
    },
    
    // 检查WebSocket消息
    toBeWebSocketMessage(received, expectedType, expectedData) {
        let message;
        try {
            message = typeof received === 'string' ? JSON.parse(received) : received;
        } catch (error) {
            return {
                message: () => `期望收到有效的JSON消息，但收到: ${received}`,
                pass: false
            };
        }
        
        const typeMatch = message.type === expectedType;
        const dataMatch = expectedData ? 
            JSON.stringify(message.data) === JSON.stringify(expectedData) : true;
        
        const pass = typeMatch && dataMatch;
        
        if (pass) {
            return {
                message: () => `期望消息类型不是 ${expectedType}`,
                pass: true
            };
        } else {
            return {
                message: () => `期望消息类型为 ${expectedType}，但收到 ${message.type}`,
                pass: false
            };
        }
    }
});

// 模拟WebSocket
global.MockWebSocket = class MockWebSocket {
    constructor() {
        this.readyState = 1; // OPEN
        this.messageQueue = [];
        this.listeners = {};
    }
    
    send(data) {
        // 模拟发送消息
        this.messageQueue.push(data);
    }
    
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
    
    close() {
        this.readyState = 3; // CLOSED
        this.emit('close');
    }
};

// 控制台输出过滤（减少测试时的噪音）
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
    // 只在非静默模式下输出
    if (!process.env.JEST_SILENT) {
        originalConsoleLog(...args);
    }
};

console.error = (...args) => {
    // 错误总是输出
    originalConsoleError(...args);
};