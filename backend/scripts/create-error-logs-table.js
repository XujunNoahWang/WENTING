// 创建错误日志表和同步队列表
const { query } = require('../config/sqlite');

async function createErrorTables() {
    try {
        console.log('🔄 创建错误处理相关表...');
        
        // 创建错误日志表
        await query(`
            CREATE TABLE IF NOT EXISTS error_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                error_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                stack_trace TEXT,
                context TEXT,
                user_id TEXT,
                operation TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME,
                resolution_method TEXT
            )
        `);
        
        // 创建同步队列表
        await query(`
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation_type TEXT NOT NULL,
                data TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_retry_at DATETIME,
                completed_at DATETIME,
                error_message TEXT,
                priority INTEGER DEFAULT 1
            )
        `);
        
        // 创建索引以提高查询性能
        await query(`
            CREATE INDEX IF NOT EXISTS idx_error_logs_type_severity 
            ON error_logs(error_type, severity)
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_error_logs_created_at 
            ON error_logs(created_at)
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_error_logs_user_id 
            ON error_logs(user_id)
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_sync_queue_status 
            ON sync_queue(status)
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_sync_queue_retry 
            ON sync_queue(retry_count, max_retries)
        `);
        
        console.log('✅ 错误处理相关表创建完成');
        
        // 验证表结构
        const errorLogsInfo = await query("PRAGMA table_info(error_logs)");
        const syncQueueInfo = await query("PRAGMA table_info(sync_queue)");
        
        console.log('📋 error_logs表结构:');
        if (Array.isArray(errorLogsInfo)) {
            errorLogsInfo.forEach(col => {
                console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
            });
        } else {
            console.log('  - 表结构信息获取失败');
        }
        
        console.log('📋 sync_queue表结构:');
        if (Array.isArray(syncQueueInfo)) {
            syncQueueInfo.forEach(col => {
                console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
            });
        } else {
            console.log('  - 表结构信息获取失败');
        }
        
    } catch (error) {
        console.error('❌ 创建错误处理表失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    createErrorTables()
        .then(() => {
            console.log('✅ 错误处理表创建脚本执行完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = { createErrorTables };