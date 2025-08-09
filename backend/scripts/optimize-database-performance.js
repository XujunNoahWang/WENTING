#!/usr/bin/env node

// 数据库性能优化脚本
const { query } = require('../config/sqlite');

class DatabaseOptimizer {
    
    // 创建性能优化索引
    static async createPerformanceIndexes() {
        console.log('🚀 开始创建数据库性能优化索引...');
        
        try {
            // 1. user_links表索引优化
            await this.createUserLinksIndexes();
            
            // 2. link_requests表索引优化
            await this.createLinkRequestsIndexes();
            
            // 3. users表关联字段索引优化
            await this.createUsersIndexes();
            
            // 4. todos表同步相关索引
            await this.createTodosIndexes();
            
            // 5. notes表同步相关索引
            await this.createNotesIndexes();
            
            // 6. 同步队列表索引
            await this.createSyncQueueIndexes();
            
            // 7. 复合索引优化
            await this.createCompositeIndexes();
            
            console.log('✅ 所有性能优化索引创建完成');
            
        } catch (error) {
            console.error('❌ 创建性能优化索引失败:', error);
            throw error;
        }
    }
    
    // user_links表索引
    static async createUserLinksIndexes() {
        console.log('📊 创建user_links表索引...');
        
        const indexes = [
            // 管理员用户查询索引
            {
                name: 'idx_user_links_manager_status',
                sql: 'CREATE INDEX IF NOT EXISTS idx_user_links_manager_status ON user_links(manager_app_user, status)'
            },
            // 关联用户查询索引
            {
                name: 'idx_user_links_linked_status',
                sql: 'CREATE INDEX IF NOT EXISTS idx_user_links_linked_status ON user_links(linked_app_user, status)'
            },
            // 被监管用户查询索引
            {
                name: 'idx_user_links_supervised',
                sql: 'CREATE INDEX IF NOT EXISTS idx_user_links_supervised ON user_links(supervised_user_id)'
            },
            // 状态查询索引
            {
                name: 'idx_user_links_status',
                sql: 'CREATE INDEX IF NOT EXISTS idx_user_links_status ON user_links(status)'
            },
            // 时间范围查询索引
            {
                name: 'idx_user_links_created',
                sql: 'CREATE INDEX IF NOT EXISTS idx_user_links_created ON user_links(created_at)'
            },
            {
                name: 'idx_user_links_updated',
                sql: 'CREATE INDEX IF NOT EXISTS idx_user_links_updated ON user_links(updated_at)'
            }
        ];
        
        for (const index of indexes) {
            try {
                await query(index.sql);
                console.log(`  ✅ ${index.name}`);
            } catch (error) {
                console.error(`  ❌ ${index.name}: ${error.message}`);
            }
        }
    }
    
    // link_requests表索引
    static async createLinkRequestsIndexes() {
        console.log('📊 创建link_requests表索引...');
        
        const indexes = [
            // 接收用户查询索引
            {
                name: 'idx_link_requests_to_user_status',
                sql: 'CREATE INDEX IF NOT EXISTS idx_link_requests_to_user_status ON link_requests(to_app_user, status)'
            },
            // 发起用户查询索引
            {
                name: 'idx_link_requests_from_user_status',
                sql: 'CREATE INDEX IF NOT EXISTS idx_link_requests_from_user_status ON link_requests(from_app_user, status)'
            },
            // 过期时间查询索引
            {
                name: 'idx_link_requests_expires_status',
                sql: 'CREATE INDEX IF NOT EXISTS idx_link_requests_expires_status ON link_requests(expires_at, status)'
            },
            // 被监管用户查询索引
            {
                name: 'idx_link_requests_supervised',
                sql: 'CREATE INDEX IF NOT EXISTS idx_link_requests_supervised ON link_requests(supervised_user_id)'
            },
            // 状态查询索引
            {
                name: 'idx_link_requests_status',
                sql: 'CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests(status)'
            },
            // 时间范围查询索引
            {
                name: 'idx_link_requests_created',
                sql: 'CREATE INDEX IF NOT EXISTS idx_link_requests_created ON link_requests(created_at)'
            }
        ];
        
        for (const index of indexes) {
            try {
                await query(index.sql);
                console.log(`  ✅ ${index.name}`);
            } catch (error) {
                console.error(`  ❌ ${index.name}: ${error.message}`);
            }
        }
    }
    
    // users表索引
    static async createUsersIndexes() {
        console.log('📊 创建users表关联字段索引...');
        
        const indexes = [
            // 关联app_user查询索引
            {
                name: 'idx_users_supervised_app_user',
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_supervised_app_user ON users(supervised_app_user)'
            },
            // 关联状态查询索引
            {
                name: 'idx_users_is_linked',
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_is_linked ON users(is_linked)'
            },
            // app_user_id查询索引
            {
                name: 'idx_users_app_user_id',
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_app_user_id ON users(app_user_id)'
            },
            // 活跃状态查询索引
            {
                name: 'idx_users_is_active',
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)'
            }
        ];
        
        for (const index of indexes) {
            try {
                await query(index.sql);
                console.log(`  ✅ ${index.name}`);
            } catch (error) {
                console.error(`  ❌ ${index.name}: ${error.message}`);
            }
        }
    }
    
    // todos表同步相关索引
    static async createTodosIndexes() {
        console.log('📊 创建todos表同步相关索引...');
        
        const indexes = [
            // 用户ID和活跃状态索引
            {
                name: 'idx_todos_user_active',
                sql: 'CREATE INDEX IF NOT EXISTS idx_todos_user_active ON todos(user_id, is_active)'
            },
            // 标题查询索引（用于同步匹配）
            {
                name: 'idx_todos_title',
                sql: 'CREATE INDEX IF NOT EXISTS idx_todos_title ON todos(title)'
            },
            // 用户和标题复合索引
            {
                name: 'idx_todos_user_title',
                sql: 'CREATE INDEX IF NOT EXISTS idx_todos_user_title ON todos(user_id, title)'
            },
            // 创建时间索引
            {
                name: 'idx_todos_created',
                sql: 'CREATE INDEX IF NOT EXISTS idx_todos_created ON todos(created_at)'
            },
            // 更新时间索引
            {
                name: 'idx_todos_updated',
                sql: 'CREATE INDEX IF NOT EXISTS idx_todos_updated ON todos(updated_at)'
            }
        ];
        
        for (const index of indexes) {
            try {
                await query(index.sql);
                console.log(`  ✅ ${index.name}`);
            } catch (error) {
                console.error(`  ❌ ${index.name}: ${error.message}`);
            }
        }
    }
    
    // notes表同步相关索引
    static async createNotesIndexes() {
        console.log('📊 创建notes表同步相关索引...');
        
        const indexes = [
            // 用户ID索引
            {
                name: 'idx_notes_user_id',
                sql: 'CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)'
            },
            // 标题查询索引（用于同步匹配）
            {
                name: 'idx_notes_title',
                sql: 'CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title)'
            },
            // 用户和标题复合索引
            {
                name: 'idx_notes_user_title',
                sql: 'CREATE INDEX IF NOT EXISTS idx_notes_user_title ON notes(user_id, title)'
            },
            // 创建时间索引
            {
                name: 'idx_notes_created',
                sql: 'CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at)'
            },
            // 更新时间索引
            {
                name: 'idx_notes_updated',
                sql: 'CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at)'
            }
        ];
        
        for (const index of indexes) {
            try {
                await query(index.sql);
                console.log(`  ✅ ${index.name}`);
            } catch (error) {
                console.error(`  ❌ ${index.name}: ${error.message}`);
            }
        }
    }
    
    // 同步队列表索引
    static async createSyncQueueIndexes() {
        console.log('📊 创建sync_queue表索引...');
        
        // 首先检查sync_queue表是否存在，如果不存在则创建
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    operation_type TEXT NOT NULL,
                    data TEXT NOT NULL,
                    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'permanently_failed')),
                    priority INTEGER DEFAULT 1,
                    retry_count INTEGER DEFAULT 0,
                    max_retries INTEGER DEFAULT 3,
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_retry_at DATETIME,
                    completed_at DATETIME
                )
            `);
            console.log('  ✅ sync_queue表已确保存在');
        } catch (error) {
            console.error('  ❌ 创建sync_queue表失败:', error.message);
        }
        
        const indexes = [
            // 状态和重试次数索引
            {
                name: 'idx_sync_queue_status_retry',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sync_queue_status_retry ON sync_queue(status, retry_count)'
            },
            // 优先级和创建时间索引
            {
                name: 'idx_sync_queue_priority_created',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sync_queue_priority_created ON sync_queue(priority DESC, created_at ASC)'
            },
            // 操作类型索引
            {
                name: 'idx_sync_queue_operation_type',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sync_queue_operation_type ON sync_queue(operation_type)'
            },
            // 状态索引
            {
                name: 'idx_sync_queue_status',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)'
            },
            // 创建时间索引（用于清理）
            {
                name: 'idx_sync_queue_created',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at)'
            }
        ];
        
        for (const index of indexes) {
            try {
                await query(index.sql);
                console.log(`  ✅ ${index.name}`);
            } catch (error) {
                console.error(`  ❌ ${index.name}: ${error.message}`);
            }
        }
    }
    
    // 复合索引优化
    static async createCompositeIndexes() {
        console.log('📊 创建复合索引优化...');
        
        const indexes = [
            // todo_completions表复合索引
            {
                name: 'idx_todo_completions_todo_date',
                sql: 'CREATE INDEX IF NOT EXISTS idx_todo_completions_todo_date ON todo_completions(todo_id, completion_date)'
            },
            // todo_deletions表复合索引
            {
                name: 'idx_todo_deletions_todo_date',
                sql: 'CREATE INDEX IF NOT EXISTS idx_todo_deletions_todo_date ON todo_deletions(todo_id, deletion_date)'
            },
            // 用户关联查询的复合索引
            {
                name: 'idx_users_app_supervised_linked',
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_app_supervised_linked ON users(app_user_id, supervised_app_user, is_linked)'
            }
        ];
        
        for (const index of indexes) {
            try {
                await query(index.sql);
                console.log(`  ✅ ${index.name}`);
            } catch (error) {
                console.error(`  ❌ ${index.name}: ${error.message}`);
            }
        }
    }
    
    // 分析查询性能
    static async analyzeQueryPerformance() {
        console.log('📈 分析查询性能...');
        
        try {
            // 启用查询计划分析
            await query('PRAGMA query_only = ON');
            
            // 测试关键查询的性能
            const testQueries = [
                {
                    name: '获取用户关联关系',
                    sql: `EXPLAIN QUERY PLAN 
                          SELECT manager_app_user, linked_app_user, supervised_user_id
                          FROM user_links 
                          WHERE (manager_app_user = 'test' OR linked_app_user = 'test') 
                          AND status = 'active'`
                },
                {
                    name: '查找待处理请求',
                    sql: `EXPLAIN QUERY PLAN 
                          SELECT * FROM link_requests 
                          WHERE to_app_user = 'test' AND status = 'pending' 
                          AND expires_at > datetime('now')`
                },
                {
                    name: '同步数据查询',
                    sql: `EXPLAIN QUERY PLAN 
                          SELECT id FROM users 
                          WHERE app_user_id = 'test' AND supervised_app_user = 'test' 
                          AND is_linked = 1`
                },
                {
                    name: 'TODO匹配查询',
                    sql: `EXPLAIN QUERY PLAN 
                          SELECT id FROM todos 
                          WHERE user_id = 1 AND title = 'test' 
                          ORDER BY created_at DESC LIMIT 1`
                }
            ];
            
            for (const testQuery of testQueries) {
                try {
                    const result = await query(testQuery.sql);
                    console.log(`\n📊 ${testQuery.name}:`);
                    result.forEach(row => {
                        console.log(`  ${row.detail}`);
                    });
                } catch (error) {
                    console.error(`  ❌ ${testQuery.name}: ${error.message}`);
                }
            }
            
            // 关闭查询计划分析
            await query('PRAGMA query_only = OFF');
            
        } catch (error) {
            console.error('❌ 分析查询性能失败:', error);
        }
    }
    
    // 获取数据库统计信息
    static async getDatabaseStats() {
        console.log('📊 获取数据库统计信息...');
        
        try {
            const stats = {};
            
            // 表记录数统计
            const tables = ['users', 'user_links', 'link_requests', 'todos', 'notes', 'sync_queue'];
            
            for (const table of tables) {
                try {
                    const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
                    stats[table] = result[0].count;
                } catch (error) {
                    stats[table] = 'N/A';
                }
            }
            
            // 索引统计
            const indexResult = await query(`
                SELECT name, tbl_name 
                FROM sqlite_master 
                WHERE type = 'index' AND name LIKE 'idx_%'
                ORDER BY tbl_name, name
            `);
            
            stats.indexes = indexResult.length;
            stats.indexDetails = indexResult;
            
            // 数据库大小
            const sizeResult = await query('PRAGMA page_count');
            const pageSizeResult = await query('PRAGMA page_size');
            const dbSize = sizeResult[0].page_count * pageSizeResult[0].page_size;
            stats.databaseSize = `${(dbSize / 1024 / 1024).toFixed(2)} MB`;
            
            console.log('\n📊 数据库统计信息:');
            console.log('表记录数:');
            Object.entries(stats).forEach(([key, value]) => {
                if (key !== 'indexes' && key !== 'indexDetails' && key !== 'databaseSize') {
                    console.log(`  ${key}: ${value}`);
                }
            });
            console.log(`索引数量: ${stats.indexes}`);
            console.log(`数据库大小: ${stats.databaseSize}`);
            
            return stats;
            
        } catch (error) {
            console.error('❌ 获取数据库统计信息失败:', error);
            return null;
        }
    }
    
    // 优化数据库设置
    static async optimizeDatabaseSettings() {
        console.log('⚙️ 优化数据库设置...');
        
        try {
            const optimizations = [
                // 启用WAL模式提高并发性能
                { name: 'WAL模式', sql: 'PRAGMA journal_mode = WAL' },
                // 设置同步模式为NORMAL提高性能
                { name: '同步模式', sql: 'PRAGMA synchronous = NORMAL' },
                // 增加缓存大小
                { name: '缓存大小', sql: 'PRAGMA cache_size = 10000' },
                // 设置临时存储为内存
                { name: '临时存储', sql: 'PRAGMA temp_store = MEMORY' },
                // 启用内存映射
                { name: '内存映射', sql: 'PRAGMA mmap_size = 268435456' }, // 256MB
                // 优化页面大小
                { name: '页面大小', sql: 'PRAGMA page_size = 4096' }
            ];
            
            for (const opt of optimizations) {
                try {
                    await query(opt.sql);
                    console.log(`  ✅ ${opt.name}`);
                } catch (error) {
                    console.error(`  ❌ ${opt.name}: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.error('❌ 优化数据库设置失败:', error);
        }
    }
    
    // 运行完整的性能优化
    static async runFullOptimization() {
        console.log('🚀 开始完整的数据库性能优化...\n');
        
        try {
            // 1. 创建性能索引
            await this.createPerformanceIndexes();
            console.log('');
            
            // 2. 优化数据库设置
            await this.optimizeDatabaseSettings();
            console.log('');
            
            // 3. 分析查询性能
            await this.analyzeQueryPerformance();
            console.log('');
            
            // 4. 获取统计信息
            await this.getDatabaseStats();
            console.log('');
            
            console.log('✅ 数据库性能优化完成！');
            
        } catch (error) {
            console.error('❌ 数据库性能优化失败:', error);
            throw error;
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    DatabaseOptimizer.runFullOptimization()
        .then(() => {
            console.log('🎉 数据库优化脚本执行完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 数据库优化脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = DatabaseOptimizer;