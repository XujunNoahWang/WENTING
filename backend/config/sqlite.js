// SQLite数据库配置
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '../data/wenting.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ SQLite连接失败:', err.message);
    } else {
        console.log('✅ SQLite数据库连接成功');
    }
});

// 启用外键约束
db.run('PRAGMA foreign_keys = ON');

// 通用查询函数
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        } else {
            db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        insertId: this.lastID, 
                        affectedRows: this.changes 
                    });
                }
            });
        }
    });
}

// 事务支持
function transaction(callback) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            Promise.resolve(callback(db))
                .then(result => {
                    db.run('COMMIT', (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                })
                .catch(error => {
                    db.run('ROLLBACK', () => {
                        reject(error);
                    });
                });
        });
    });
}

// 测试连接
async function testConnection() {
    try {
        await query('SELECT 1');
        console.log('✅ SQLite数据库连接测试成功');
        return true;
    } catch (error) {
        console.error('❌ SQLite数据库连接测试失败:', error);
        return false;
    }
}

// 关闭数据库连接
function closeDatabase() {
    return new Promise((resolve) => {
        db.close((err) => {
            if (err) {
                console.error('关闭数据库时出错:', err);
            } else {
                console.log('数据库连接已关闭');
            }
            resolve();
        });
    });
}

module.exports = {
    db,
    query,
    transaction,
    testConnection,
    closeDatabase
};