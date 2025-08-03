// 数据库初始化脚本
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initDatabase() {
    let connection;
    
    try {
        console.log('🔄 开始初始化数据库...');
        
        // 连接到MySQL服务器（不指定数据库）
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            charset: 'utf8mb4',
            authPlugins: {
                mysql_native_password: () => () => Buffer.alloc(0)
            }
        });
        
        console.log('✅ 连接到MySQL服务器成功');
        
        // 读取SQL文件
        const sqlPath = path.join(__dirname, '../../database_schema.sql');
        const sqlContent = await fs.readFile(sqlPath, 'utf8');
        
        // 分割SQL语句（按分号分割，但要处理存储过程等复杂情况）
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`📄 读取到 ${statements.length} 条SQL语句`);
        
        // 执行每条SQL语句
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement) {
                try {
                    await connection.execute(statement);
                    console.log(`✅ 执行语句 ${i + 1}/${statements.length}`);
                } catch (error) {
                    // 忽略一些常见的警告
                    if (error.code === 'ER_DB_CREATE_EXISTS' || 
                        error.code === 'ER_TABLE_EXISTS_ERROR' ||
                        error.message.includes('already exists')) {
                        console.log(`⚠️  语句 ${i + 1} 已存在，跳过: ${error.message}`);
                    } else {
                        console.error(`❌ 执行语句 ${i + 1} 失败:`, error.message);
                        console.error('语句内容:', statement.substring(0, 100) + '...');
                    }
                }
            }
        }
        
        // 验证数据库结构
        await connection.execute(`USE ${process.env.DB_NAME || 'wenting_db'}`);
        
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('📊 创建的表:');
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`  - ${tableName}`);
        });
        
        // 检查示例数据
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
        const [todos] = await connection.execute('SELECT COUNT(*) as count FROM todos');
        const [patterns] = await connection.execute('SELECT COUNT(*) as count FROM repeat_patterns');
        
        console.log('📈 数据统计:');
        console.log(`  - 用户: ${users[0].count} 条`);
        console.log(`  - TODO: ${todos[0].count} 条`);
        console.log(`  - 重复模式: ${patterns[0].count} 条`);
        
        console.log('🎉 数据库初始化完成！');
        
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };