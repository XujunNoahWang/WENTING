// Jest全局设置
const path = require('path');
const fs = require('fs').promises;

module.exports = async () => {
    console.log('🚀 开始全局测试环境设置...');
    
    // 设置环境变量
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.DB_PATH = ':memory:';
    
    // 创建测试报告目录
    const reportsDir = path.resolve(__dirname, '../test-reports');
    try {
        await fs.mkdir(reportsDir, { recursive: true });
        console.log('📁 测试报告目录创建成功');
    } catch (error) {
        console.warn('⚠️  测试报告目录创建失败:', error.message);
    }
    
    // 初始化测试数据库
    try {
        const { initializeDatabase } = require('../config/sqlite');
        await initializeDatabase();
        console.log('🗄️  测试数据库初始化成功');
    } catch (error) {
        console.error('❌ 测试数据库初始化失败:', error);
        throw error;
    }
    
    // 设置全局测试超时
    jest.setTimeout(30000);
    
    console.log('✅ 全局测试环境设置完成');
};