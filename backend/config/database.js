// 使用SQLite数据库
const { query, transaction, testConnection, closeDatabase } = require('./sqlite');

module.exports = {
    query,
    transaction,
    testConnection,
    closePool: closeDatabase
};