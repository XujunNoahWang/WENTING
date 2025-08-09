// Jest全局清理
module.exports = async () => {
    console.log('🧹 开始全局测试环境清理...');
    
    // 清理数据库连接
    try {
        const { closeDatabase } = require('../config/sqlite');
        if (closeDatabase) {
            await closeDatabase();
            console.log('🗄️  数据库连接已关闭');
        }
    } catch (error) {
        console.warn('⚠️  数据库连接关闭失败:', error.message);
    }
    
    // 清理环境变量
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.DB_PATH;
    
    // 清理定时器
    if (global.gc) {
        global.gc();
    }
    
    console.log('✅ 全局测试环境清理完成');
};