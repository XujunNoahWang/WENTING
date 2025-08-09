// 创建安全日志表
const { query } = require('../config/sqlite');

async function createSecurityLogsTable() {
    try {
        console.log('🔒 开始创建安全日志表...');
        
        // 创建安全日志表
        await query(`
            CREATE TABLE IF NOT EXISTS security_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                details TEXT,
                client_ip TEXT,
                user_agent TEXT,
                app_user TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 创建索引
        await query(`CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_security_logs_app_user ON security_logs(app_user)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_security_logs_client_ip ON security_logs(client_ip)`);
        
        console.log('✅ 安全日志表创建成功');
        
        // 验证表结构
        const tableInfo = await query(`PRAGMA table_info(security_logs)`);
        console.log('📋 安全日志表结构:', tableInfo);
        
        // 插入测试记录
        await query(`
            INSERT INTO security_logs (event_type, details, client_ip, app_user)
            VALUES ('SYSTEM_INIT', '{"message": "安全日志系统初始化"}', '127.0.0.1', 'system')
        `);
        
        console.log('✅ 安全日志系统初始化完成');
        
    } catch (error) {
        console.error('❌ 创建安全日志表失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    createSecurityLogsTable()
        .then(() => {
            console.log('🎉 安全日志表创建完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 创建失败:', error);
            process.exit(1);
        });
}

module.exports = { createSecurityLogsTable };