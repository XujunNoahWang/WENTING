// 错误恢复和清理调度器
const cron = require('node-cron');
const ErrorHandlingService = require('../services/errorHandlingService');
const DataSyncService = require('../services/dataSyncService');

class ErrorRecoveryScheduler {
    
    static isRunning = false;
    static tasks = [];
    
    // 启动调度器
    static start() {
        if (this.isRunning) {
            console.log('⚠️  错误恢复调度器已在运行');
            return;
        }
        
        console.log('🚀 启动错误恢复调度器...');
        
        // 每5分钟处理一次同步队列
        const syncQueueTask = cron.schedule('*/5 * * * *', async () => {
            try {
                console.log('🔄 定时处理同步队列...');
                const result = await DataSyncService.processSyncQueue();
                
                if (result.processed > 0) {
                    console.log(`✅ 同步队列处理完成: ${result.succeeded}/${result.processed} 成功`);
                }
            } catch (error) {
                console.error('❌ 定时处理同步队列失败:', error);
            }
        }, {
            scheduled: false
        });
        
        // 每小时清理过期的关联请求
        const cleanupRequestsTask = cron.schedule('0 * * * *', async () => {
            try {
                console.log('🧹 定时清理过期请求...');
                const LinkService = require('../services/linkService');
                const cleanedCount = await LinkService.cleanupExpiredRequests();
                
                if (cleanedCount > 0) {
                    console.log(`✅ 清理了 ${cleanedCount} 个过期请求`);
                }
            } catch (error) {
                console.error('❌ 定时清理过期请求失败:', error);
            }
        }, {
            scheduled: false
        });
        
        // 每天凌晨2点清理旧的错误日志
        const cleanupLogsTask = cron.schedule('0 2 * * *', async () => {
            try {
                console.log('🧹 定时清理错误日志...');
                const errorLogsCleaned = await ErrorHandlingService.cleanupOldLogs(30);
                const syncQueueCleaned = await DataSyncService.cleanupSyncQueue(7);
                
                console.log(`✅ 清理完成: 错误日志 ${errorLogsCleaned} 条, 同步队列 ${syncQueueCleaned} 条`);
            } catch (error) {
                console.error('❌ 定时清理日志失败:', error);
            }
        }, {
            scheduled: false
        });
        
        // 每30分钟生成错误统计报告
        const errorStatsTask = cron.schedule('*/30 * * * *', async () => {
            try {
                const stats = await ErrorHandlingService.getErrorStats('1h');
                const syncStats = await DataSyncService.getSyncStats();
                
                if (stats && stats.total > 0) {
                    console.log('📊 错误统计报告:');
                    console.log(`  - 总错误数: ${stats.total}`);
                    stats.breakdown.forEach(item => {
                        console.log(`  - ${item.error_type}(${item.severity}): ${item.count} 次, 平均重试: ${item.avg_retries.toFixed(1)}`);
                    });
                }
                
                if (syncStats) {
                    console.log('📊 同步统计报告:');
                    console.log(`  - 活跃关联: ${syncStats.activeLinks}`);
                    console.log(`  - 同步项目: ${syncStats.totalSyncedItems}`);
                    if (syncStats.queueStats) {
                        Object.entries(syncStats.queueStats).forEach(([status, count]) => {
                            console.log(`  - 队列${status}: ${count}`);
                        });
                    }
                }
            } catch (error) {
                console.error('❌ 生成统计报告失败:', error);
            }
        }, {
            scheduled: false
        });
        
        // 启动所有任务
        syncQueueTask.start();
        cleanupRequestsTask.start();
        cleanupLogsTask.start();
        errorStatsTask.start();
        
        this.tasks = [syncQueueTask, cleanupRequestsTask, cleanupLogsTask, errorStatsTask];
        this.isRunning = true;
        
        console.log('✅ 错误恢复调度器启动完成');
        console.log('📋 调度任务:');
        console.log('  - 同步队列处理: 每5分钟');
        console.log('  - 过期请求清理: 每小时');
        console.log('  - 日志清理: 每天凌晨2点');
        console.log('  - 统计报告: 每30分钟');
    }
    
    // 停止调度器
    static stop() {
        if (!this.isRunning) {
            console.log('⚠️  错误恢复调度器未在运行');
            return;
        }
        
        console.log('🛑 停止错误恢复调度器...');
        
        this.tasks.forEach(task => {
            task.stop();
        });
        
        this.tasks = [];
        this.isRunning = false;
        
        console.log('✅ 错误恢复调度器已停止');
    }
    
    // 手动触发同步队列处理
    static async triggerSyncQueueProcessing() {
        try {
            console.log('🔄 手动触发同步队列处理...');
            const result = await DataSyncService.processSyncQueue();
            console.log(`✅ 手动处理完成: ${result.succeeded}/${result.processed} 成功`);
            return result;
        } catch (error) {
            console.error('❌ 手动处理同步队列失败:', error);
            throw error;
        }
    }
    
    // 手动触发清理操作
    static async triggerCleanup() {
        try {
            console.log('🧹 手动触发清理操作...');
            
            const LinkService = require('../services/linkService');
            const expiredRequests = await LinkService.cleanupExpiredRequests();
            const errorLogs = await ErrorHandlingService.cleanupOldLogs(30);
            const syncQueue = await DataSyncService.cleanupSyncQueue(7);
            
            const result = {
                expiredRequests,
                errorLogs,
                syncQueue
            };
            
            console.log(`✅ 手动清理完成:`, result);
            return result;
        } catch (error) {
            console.error('❌ 手动清理失败:', error);
            throw error;
        }
    }
    
    // 获取调度器状态
    static getStatus() {
        return {
            isRunning: this.isRunning,
            tasksCount: this.tasks.length,
            tasks: this.tasks.map(task => ({
                running: task.running,
                scheduled: task.scheduled
            }))
        };
    }
    
    // 获取健康检查信息
    static async getHealthCheck() {
        try {
            const errorStats = await ErrorHandlingService.getErrorStats('1h');
            const syncStats = await DataSyncService.getSyncStats();
            const schedulerStatus = this.getStatus();
            
            // 计算健康分数
            let healthScore = 100;
            
            // 如果调度器未运行，扣分
            if (!schedulerStatus.isRunning) {
                healthScore -= 30;
            }
            
            // 如果有大量错误，扣分
            if (errorStats && errorStats.total > 50) {
                healthScore -= 20;
            }
            
            // 如果同步队列积压严重，扣分
            if (syncStats && syncStats.queueStats) {
                const failedCount = syncStats.queueStats.failed || 0;
                const pendingCount = syncStats.queueStats.pending || 0;
                
                if (failedCount + pendingCount > 20) {
                    healthScore -= 25;
                }
            }
            
            return {
                healthScore: Math.max(0, healthScore),
                status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
                scheduler: schedulerStatus,
                errors: errorStats,
                sync: syncStats,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ 获取健康检查信息失败:', error);
            return {
                healthScore: 0,
                status: 'critical',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    console.log('🚀 启动错误恢复调度器...');
    ErrorRecoveryScheduler.start();
    
    // 优雅关闭
    process.on('SIGINT', () => {
        console.log('\n🛑 接收到关闭信号...');
        ErrorRecoveryScheduler.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 接收到终止信号...');
        ErrorRecoveryScheduler.stop();
        process.exit(0);
    });
    
    // 保持进程运行
    setInterval(() => {
        // 空操作，保持进程活跃
    }, 60000);
}

module.exports = ErrorRecoveryScheduler;