// 检查数据库结构脚本
const { query, testConnection } = require('../config/sqlite');

async function checkDatabaseStructure() {
    try {
        console.log('🔄 检查数据库结构...');
        
        // 测试连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 检查todos表结构
        console.log('\n📋 todos表结构:');
        const todosInfo = await query('PRAGMA table_info(todos)');
        console.log('todosInfo:', todosInfo);
        if (Array.isArray(todosInfo) && todosInfo.length > 0) {
            todosInfo.forEach(column => {
                console.log(`  ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''} ${column.dflt_value ? `DEFAULT ${column.dflt_value}` : ''}`);
            });
        } else {
            console.log('  表不存在或查询结果异常');
        }
        
        // 检查todo_deletions表是否存在
        console.log('\n📋 todo_deletions表结构:');
        try {
            const deletionsInfo = await query('PRAGMA table_info(todo_deletions)');
            if (deletionsInfo.length > 0) {
                deletionsInfo.forEach(column => {
                    console.log(`  ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''} ${column.dflt_value ? `DEFAULT ${column.dflt_value}` : ''}`);
                });
            } else {
                console.log('  表不存在或为空');
            }
        } catch (error) {
            console.log('  表不存在:', error.message);
        }
        
        // 检查所有表
        console.log('\n📋 所有表:');
        const tables = await query('SELECT name FROM sqlite_master WHERE type="table"');
        tables.forEach(table => {
            console.log(`  - ${table.name}`);
        });
        
        console.log('\n✅ 数据库结构检查完成！');
        
    } catch (error) {
        console.error('❌ 检查数据库结构失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    checkDatabaseStructure().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { checkDatabaseStructure };