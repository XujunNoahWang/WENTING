#!/usr/bin/env node

// 性能压力测试脚本
const { query, transaction } = require('../config/sqlite');
const LinkService = require('../services/linkService');
const DataSyncService = require('../services/dataSyncService');

class PerformanceStressTest {
    
    constructor() {
        this.testResults = {
            linkCreation: [],
            dataSync: [],
            queryPerformance: [],
            concurrentOperations: []
        };
    }
    
    // 运行完整的性能测试套件
    async runFullTestSuite() {
        console.log('🚀 开始性能压力测试套件...\n');
        
        try {
            // 1. 准备测试数据
            await this.prepareTestData();
            
            // 2. 测试关联创建性能
            await this.testLinkCreationPerformance();
            
            // 3. 测试数据同步性能
            await this.testDataSyncPerformance();
            
            // 4. 测试查询性能
            await this.testQueryPerformance();
            
            // 5. 测试并发操作性能
            await this.testConcurrentOperations();
            
            // 6. 生成性能报告
            await this.generatePerformanceReport();
            
            console.log('✅ 性能压力测试完成！');
            
        } catch (error) {
            console.error('❌ 性能测试失败:', error);
            throw error;
        }
    }
    
    // 准备测试数据
    async prepareTestData() {
        console.log('📋 准备测试数据...');
        
        try {
            // 创建测试用户
            const testUsers = [];
            for (let i = 1; i <= 10; i++) {
                const username = `test_user_${i}`;
                
                // 创建app_user
                await query(`
                    INSERT OR IGNORE INTO app_users (username, password_hash, email)
                    VALUES (?, 'test_hash', ?)
                `, [username, `${username}@test.com`]);
                
                // 创建被监管用户
                for (let j = 1; j <= 5; j++) {
                    await query(`
                        INSERT OR IGNORE INTO users (username, display_name, app_user_id, is_active)
                        VALUES (?, ?, ?, 1)
                    `, [`supervised_${i}_${j}`, `被监管用户${i}-${j}`, username]);
                }
                
                testUsers.push(username);
            }
            
            console.log(`✅ 创建了 ${testUsers.length} 个测试用户，每个用户有 5 个被监管用户`);
            
            // 为每个被监管用户创建测试数据
            const supervisedUsers = await query('SELECT id FROM users WHERE username LIKE "supervised_%"');
            
            for (const user of supervisedUsers) {
                // 创建TODO数据
                for (let i = 1; i <= 20; i++) {
                    await query(`
                        INSERT OR IGNORE INTO todos (user_id, title, description, priority, is_active)
                        VALUES (?, ?, ?, ?, 1)
                    `, [user.id, `测试TODO ${i}`, `测试描述 ${i}`, 'medium']);
                }
                
                // 创建Notes数据
                for (let i = 1; i <= 10; i++) {
                    await query(`
                        INSERT OR IGNORE INTO notes (user_id, title, description)
                        VALUES (?, ?, ?)
                    `, [user.id, `测试笔记 ${i}`, `测试笔记内容 ${i}`]);
                }
            }
            
            console.log(`✅ 为 ${supervisedUsers.length} 个被监管用户创建了测试数据`);
            
        } catch (error) {
            console.error('❌ 准备测试数据失败:', error);
            throw error;
        }
    }
    
    // 测试关联创建性能
    async testLinkCreationPerformance() {
        console.log('🔗 测试关联创建性能...');
        
        try {
            const testCases = [
                { name: '单个关联创建', count: 1 },
                { name: '批量关联创建(10个)', count: 10 },
                { name: '大批量关联创建(50个)', count: 50 }
            ];
            
            for (const testCase of testCases) {
                const startTime = Date.now();
                const promises = [];
                
                for (let i = 0; i < testCase.count; i++) {
                    const fromUser = `test_user_${(i % 5) + 1}`;
                    const toUser = `test_user_${((i + 1) % 5) + 6}`;
                    
                    // 获取被监管用户ID
                    const supervisedUsers = await query(`
                        SELECT id FROM users 
                        WHERE app_user_id = ? AND username LIKE 'supervised_%'
                        LIMIT 1
                    `, [fromUser]);
                    
                    if (supervisedUsers.length > 0) {
                        promises.push(
                            LinkService.createRequest(fromUser, toUser, supervisedUsers[0].id, `测试关联请求 ${i}`)
                                .catch(error => ({ error: error.message }))
                        );
                    }
                }
                
                const results = await Promise.allSettled(promises);
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                const successCount = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
                const failureCount = results.length - successCount;
                
                const result = {
                    testCase: testCase.name,
                    count: testCase.count,
                    duration,
                    avgTime: duration / testCase.count,
                    successCount,
                    failureCount,
                    throughput: (successCount / duration) * 1000 // 每秒操作数
                };
                
                this.testResults.linkCreation.push(result);
                
                console.log(`  📊 ${testCase.name}:`);
                console.log(`    总时间: ${duration}ms`);
                console.log(`    平均时间: ${result.avgTime.toFixed(2)}ms`);
                console.log(`    成功: ${successCount}, 失败: ${failureCount}`);
                console.log(`    吞吐量: ${result.throughput.toFixed(2)} ops/sec`);
            }
            
        } catch (error) {
            console.error('❌ 关联创建性能测试失败:', error);
        }
    }
    
    // 测试数据同步性能
    async testDataSyncPerformance() {
        console.log('🔄 测试数据同步性能...');
        
        try {
            // 首先建立一些关联关系
            await this.establishTestLinks();
            
            const testCases = [
                { name: 'TODO同步性能', operation: 'syncTodoOperation', dataType: 'todos' },
                { name: 'Notes同步性能', operation: 'syncNotesOperation', dataType: 'notes' }
            ];
            
            for (const testCase of testCases) {
                const startTime = Date.now();
                const promises = [];
                
                // 获取有关联关系的用户
                const linkedUsers = await query(`
                    SELECT DISTINCT u.id, u.app_user_id
                    FROM users u
                    JOIN user_links ul ON u.app_user_id = ul.manager_app_user
                    WHERE ul.status = 'active'
                    LIMIT 10
                `);
                
                for (const user of linkedUsers) {
                    // 获取用户的数据
                    const data = await query(`SELECT * FROM ${testCase.dataType} WHERE user_id = ? LIMIT 5`, [user.id]);
                    
                    for (const item of data) {
                        const syncData = {
                            ...item,
                            originalUserId: user.id
                        };
                        
                        if (testCase.operation === 'syncTodoOperation') {
                            promises.push(
                                DataSyncService.syncTodoOperation('update', syncData, user.id)
                                    .catch(error => ({ error: error.message }))
                            );
                        } else {
                            promises.push(
                                DataSyncService.syncNotesOperation('update', syncData, user.id)
                                    .catch(error => ({ error: error.message }))
                            );
                        }
                    }
                }
                
                const results = await Promise.allSettled(promises);
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                const successCount = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
                const failureCount = results.length - successCount;
                
                const result = {
                    testCase: testCase.name,
                    count: promises.length,
                    duration,
                    avgTime: duration / promises.length,
                    successCount,
                    failureCount,
                    throughput: (successCount / duration) * 1000
                };
                
                this.testResults.dataSync.push(result);
                
                console.log(`  📊 ${testCase.name}:`);
                console.log(`    同步操作数: ${promises.length}`);
                console.log(`    总时间: ${duration}ms`);
                console.log(`    平均时间: ${result.avgTime.toFixed(2)}ms`);
                console.log(`    成功: ${successCount}, 失败: ${failureCount}`);
                console.log(`    吞吐量: ${result.throughput.toFixed(2)} ops/sec`);
            }
            
        } catch (error) {
            console.error('❌ 数据同步性能测试失败:', error);
        }
    }
    
    // 测试查询性能
    async testQueryPerformance() {
        console.log('🔍 测试查询性能...');
        
        try {
            const queries = [
                {
                    name: '获取用户关联关系',
                    sql: `SELECT manager_app_user, linked_app_user, supervised_user_id
                          FROM user_links 
                          WHERE (manager_app_user = ? OR linked_app_user = ?) AND status = 'active'`,
                    params: ['test_user_1', 'test_user_1']
                },
                {
                    name: '查找待处理请求',
                    sql: `SELECT * FROM link_requests 
                          WHERE to_app_user = ? AND status = 'pending' 
                          AND expires_at > datetime('now')`,
                    params: ['test_user_1']
                },
                {
                    name: '同步数据查询',
                    sql: `SELECT id FROM users 
                          WHERE app_user_id = ? AND supervised_app_user = ? AND is_linked = 1`,
                    params: ['test_user_1', 'test_user_1']
                },
                {
                    name: 'TODO匹配查询',
                    sql: `SELECT id FROM todos 
                          WHERE user_id = ? AND title = ? 
                          ORDER BY created_at DESC LIMIT 1`,
                    params: [1, '测试TODO 1']
                },
                {
                    name: '复杂关联查询',
                    sql: `SELECT u.*, ul.status, ul.created_at as link_created
                          FROM users u
                          JOIN user_links ul ON u.id = ul.supervised_user_id
                          WHERE ul.manager_app_user = ? AND ul.status = 'active'`,
                    params: ['test_user_1']
                }
            ];
            
            for (const queryTest of queries) {
                const iterations = 100;
                const times = [];
                
                for (let i = 0; i < iterations; i++) {
                    const startTime = process.hrtime.bigint();
                    
                    try {
                        await query(queryTest.sql, queryTest.params);
                        const endTime = process.hrtime.bigint();
                        const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
                        times.push(duration);
                    } catch (error) {
                        console.error(`查询失败: ${queryTest.name}`, error.message);
                    }
                }
                
                if (times.length > 0) {
                    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
                    const minTime = Math.min(...times);
                    const maxTime = Math.max(...times);
                    
                    const result = {
                        queryName: queryTest.name,
                        iterations,
                        avgTime,
                        minTime,
                        maxTime,
                        throughput: 1000 / avgTime // 每秒查询数
                    };
                    
                    this.testResults.queryPerformance.push(result);
                    
                    console.log(`  📊 ${queryTest.name}:`);
                    console.log(`    平均时间: ${avgTime.toFixed(3)}ms`);
                    console.log(`    最小时间: ${minTime.toFixed(3)}ms`);
                    console.log(`    最大时间: ${maxTime.toFixed(3)}ms`);
                    console.log(`    吞吐量: ${result.throughput.toFixed(2)} queries/sec`);
                }
            }
            
        } catch (error) {
            console.error('❌ 查询性能测试失败:', error);
        }
    }
    
    // 测试并发操作性能
    async testConcurrentOperations() {
        console.log('⚡ 测试并发操作性能...');
        
        try {
            const concurrencyLevels = [5, 10, 20];
            
            for (const concurrency of concurrencyLevels) {
                console.log(`\n  测试并发级别: ${concurrency}`);
                
                const startTime = Date.now();
                const promises = [];
                
                // 创建并发操作
                for (let i = 0; i < concurrency; i++) {
                    const userId = (i % 10) + 1;
                    
                    // 混合操作：查询、插入、更新
                    promises.push(
                        this.performMixedOperations(userId).catch(error => ({ error: error.message }))
                    );
                }
                
                const results = await Promise.allSettled(promises);
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                const successCount = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
                const failureCount = results.length - successCount;
                
                const result = {
                    concurrency,
                    duration,
                    successCount,
                    failureCount,
                    throughput: (successCount / duration) * 1000
                };
                
                this.testResults.concurrentOperations.push(result);
                
                console.log(`    总时间: ${duration}ms`);
                console.log(`    成功: ${successCount}, 失败: ${failureCount}`);
                console.log(`    吞吐量: ${result.throughput.toFixed(2)} ops/sec`);
            }
            
        } catch (error) {
            console.error('❌ 并发操作性能测试失败:', error);
        }
    }
    
    // 执行混合操作
    async performMixedOperations(userId) {
        const operations = [];
        
        // 查询操作
        operations.push(
            query('SELECT * FROM users WHERE app_user_id = ?', [`test_user_${userId}`])
        );
        
        // 插入操作
        operations.push(
            query(`
                INSERT OR IGNORE INTO todos (user_id, title, description, priority)
                VALUES (?, ?, ?, ?)
            `, [userId, `并发测试TODO ${Date.now()}`, '并发测试描述', 'low'])
        );
        
        // 更新操作
        operations.push(
            query(`
                UPDATE todos SET description = ? 
                WHERE user_id = ? AND title LIKE '并发测试TODO%'
                LIMIT 1
            `, [`更新时间: ${new Date().toISOString()}`, userId])
        );
        
        // 关联查询操作
        operations.push(
            query(`
                SELECT ul.*, u.display_name
                FROM user_links ul
                JOIN users u ON ul.supervised_user_id = u.id
                WHERE ul.manager_app_user = ? OR ul.linked_app_user = ?
            `, [`test_user_${userId}`, `test_user_${userId}`])
        );
        
        return Promise.all(operations);
    }
    
    // 建立测试关联关系
    async establishTestLinks() {
        try {
            // 建立一些测试关联关系
            for (let i = 1; i <= 5; i++) {
                const fromUser = `test_user_${i}`;
                const toUser = `test_user_${i + 5}`;
                
                const supervisedUsers = await query(`
                    SELECT id FROM users 
                    WHERE app_user_id = ? AND username LIKE 'supervised_%'
                    LIMIT 1
                `, [fromUser]);
                
                if (supervisedUsers.length > 0) {
                    // 直接创建关联关系（跳过请求流程）
                    await query(`
                        INSERT OR IGNORE INTO user_links (manager_app_user, linked_app_user, supervised_user_id, status)
                        VALUES (?, ?, ?, 'active')
                    `, [fromUser, toUser, supervisedUsers[0].id]);
                    
                    // 更新被监管用户状态
                    await query(`
                        UPDATE users 
                        SET supervised_app_user = ?, is_linked = 1
                        WHERE id = ?
                    `, [toUser, supervisedUsers[0].id]);
                }
            }
            
            console.log('✅ 建立了测试关联关系');
            
        } catch (error) {
            console.error('❌ 建立测试关联关系失败:', error);
        }
    }
    
    // 生成性能报告
    async generatePerformanceReport() {
        console.log('\n📊 生成性能测试报告...');
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: Object.values(this.testResults).reduce((sum, tests) => sum + tests.length, 0),
                linkCreationTests: this.testResults.linkCreation.length,
                dataSyncTests: this.testResults.dataSync.length,
                queryPerformanceTests: this.testResults.queryPerformance.length,
                concurrentOperationTests: this.testResults.concurrentOperations.length
            },
            results: this.testResults,
            recommendations: this.generateRecommendations()
        };
        
        // 保存报告到文件
        const fs = require('fs');
        const reportPath = 'backend/tests/performance-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`✅ 性能报告已保存到: ${reportPath}`);
        
        // 打印摘要
        console.log('\n📈 性能测试摘要:');
        console.log(`总测试数: ${report.summary.totalTests}`);
        
        if (this.testResults.linkCreation.length > 0) {
            const avgLinkTime = this.testResults.linkCreation.reduce((sum, r) => sum + r.avgTime, 0) / this.testResults.linkCreation.length;
            console.log(`关联创建平均时间: ${avgLinkTime.toFixed(2)}ms`);
        }
        
        if (this.testResults.dataSync.length > 0) {
            const avgSyncTime = this.testResults.dataSync.reduce((sum, r) => sum + r.avgTime, 0) / this.testResults.dataSync.length;
            console.log(`数据同步平均时间: ${avgSyncTime.toFixed(2)}ms`);
        }
        
        if (this.testResults.queryPerformance.length > 0) {
            const avgQueryTime = this.testResults.queryPerformance.reduce((sum, r) => sum + r.avgTime, 0) / this.testResults.queryPerformance.length;
            console.log(`查询平均时间: ${avgQueryTime.toFixed(3)}ms`);
        }
        
        // 打印建议
        console.log('\n💡 性能优化建议:');
        report.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
        });
        
        return report;
    }
    
    // 生成优化建议
    generateRecommendations() {
        const recommendations = [];
        
        // 基于测试结果生成建议
        if (this.testResults.queryPerformance.length > 0) {
            const slowQueries = this.testResults.queryPerformance.filter(r => r.avgTime > 10);
            if (slowQueries.length > 0) {
                recommendations.push('考虑为慢查询添加更多索引或优化查询语句');
            }
        }
        
        if (this.testResults.concurrentOperations.length > 0) {
            const highConcurrencyResults = this.testResults.concurrentOperations.filter(r => r.concurrency >= 20);
            if (highConcurrencyResults.some(r => r.failureCount > 0)) {
                recommendations.push('在高并发场景下考虑使用连接池或队列机制');
            }
        }
        
        if (this.testResults.dataSync.length > 0) {
            const slowSyncs = this.testResults.dataSync.filter(r => r.avgTime > 100);
            if (slowSyncs.length > 0) {
                recommendations.push('考虑实现异步数据同步以提高响应性能');
            }
        }
        
        // 通用建议
        recommendations.push('定期运行VACUUM命令清理数据库碎片');
        recommendations.push('监控数据库大小和索引使用情况');
        recommendations.push('考虑实现缓存机制减少数据库查询');
        
        return recommendations;
    }
    
    // 清理测试数据
    async cleanupTestData() {
        console.log('🧹 清理测试数据...');
        
        try {
            // 删除测试关联关系
            await query('DELETE FROM user_links WHERE manager_app_user LIKE "test_user_%" OR linked_app_user LIKE "test_user_%"');
            
            // 删除测试请求
            await query('DELETE FROM link_requests WHERE from_app_user LIKE "test_user_%" OR to_app_user LIKE "test_user_%"');
            
            // 删除测试数据
            await query('DELETE FROM todos WHERE title LIKE "测试TODO%" OR title LIKE "并发测试TODO%"');
            await query('DELETE FROM notes WHERE title LIKE "测试笔记%"');
            
            // 删除测试用户
            await query('DELETE FROM users WHERE username LIKE "supervised_%"');
            await query('DELETE FROM app_users WHERE username LIKE "test_user_%"');
            
            console.log('✅ 测试数据清理完成');
            
        } catch (error) {
            console.error('❌ 清理测试数据失败:', error);
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const tester = new PerformanceStressTest();
    
    tester.runFullTestSuite()
        .then(() => {
            console.log('\n🎉 性能压力测试完成');
            return tester.cleanupTestData();
        })
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 性能测试失败:', error);
            process.exit(1);
        });
}

module.exports = PerformanceStressTest;