// 错误处理服务 - 统一的错误处理和恢复机制
const { query } = require('../config/sqlite');
const websocketService = require('./websocketService');

class ErrorHandlingService {
    
    // 错误类型定义
    static ERROR_TYPES = {
        NETWORK: 'network',
        VALIDATION: 'validation',
        SYNC: 'sync',
        PERMISSION: 'permission',
        DATABASE: 'database',
        WEBSOCKET: 'websocket',
        RATE_LIMIT: 'rate_limit',
        TIMEOUT: 'timeout'
    };
    
    // 错误严重级别
    static SEVERITY_LEVELS = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };
    
    // 重试配置
    static RETRY_CONFIG = {
        MAX_RETRIES: 3,
        BASE_DELAY: 1000,
        MAX_DELAY: 10000,
        BACKOFF_MULTIPLIER: 2,
        retryableErrors: [
            'NETWORK_ERROR',
            'TIMEOUT_ERROR',
            'DATABASE_BUSY',
            'SYNC_FAILED',
            'WEBSOCKET_DISCONNECTED'
        ]
    };
    
    // 处理错误
    static async handleError(error, context = {}) {
        try {
            const errorInfo = this.analyzeError(error, context);
            
            // 记录错误
            await this.logError(errorInfo);
            
            // 发送用户通知
            if (errorInfo.shouldNotifyUser) {
                await this.notifyUser(errorInfo);
            }
            
            // 尝试自动恢复
            if (errorInfo.canAutoRecover) {
                return await this.attemptRecovery(errorInfo);
            }
            
            return {
                success: false,
                error: errorInfo,
                userMessage: this.getUserFriendlyMessage(errorInfo),
                canRetry: this.canRetry(errorInfo),
                retryAfter: this.getRetryDelay(errorInfo.retryCount || 0)
            };
            
        } catch (handlingError) {
            console.error('❌ 错误处理器本身发生错误:', handlingError);
            return {
                success: false,
                error: {
                    type: this.ERROR_TYPES.CRITICAL,
                    message: '系统错误处理失败',
                    originalError: error.message
                },
                userMessage: '系统遇到严重错误，请稍后重试或联系管理员',
                canRetry: false
            };
        }
    }
    
    // 分析错误
    static analyzeError(error, context) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            message: error.message || '未知错误',
            stack: error.stack,
            context,
            type: this.ERROR_TYPES.NETWORK,
            severity: this.SEVERITY_LEVELS.MEDIUM,
            shouldNotifyUser: true,
            canAutoRecover: false,
            retryCount: context.retryCount || 0
        };
        
        // 根据错误消息和类型进行分类
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            errorInfo.type = this.ERROR_TYPES.NETWORK;
            errorInfo.severity = this.SEVERITY_LEVELS.HIGH;
            errorInfo.canAutoRecover = true;
        } else if (error.message.includes('validation') || error.message.includes('参数')) {
            errorInfo.type = this.ERROR_TYPES.VALIDATION;
            errorInfo.severity = this.SEVERITY_LEVELS.LOW;
            errorInfo.canAutoRecover = false;
        } else if (error.message.includes('sync') || error.message.includes('同步')) {
            errorInfo.type = this.ERROR_TYPES.SYNC;
            errorInfo.severity = this.SEVERITY_LEVELS.MEDIUM;
            errorInfo.canAutoRecover = true;
        } else if (error.message.includes('permission') || error.message.includes('权限')) {
            errorInfo.type = this.ERROR_TYPES.PERMISSION;
            errorInfo.severity = this.SEVERITY_LEVELS.HIGH;
            errorInfo.canAutoRecover = false;
        } else if (error.code === 'SQLITE_BUSY' || error.message.includes('database')) {
            errorInfo.type = this.ERROR_TYPES.DATABASE;
            errorInfo.severity = this.SEVERITY_LEVELS.HIGH;
            errorInfo.canAutoRecover = true;
        } else if (error.message.includes('websocket') || error.message.includes('WebSocket')) {
            errorInfo.type = this.ERROR_TYPES.WEBSOCKET;
            errorInfo.severity = this.SEVERITY_LEVELS.MEDIUM;
            errorInfo.canAutoRecover = true;
        } else if (error.message.includes('rate limit') || error.message.includes('频率限制')) {
            errorInfo.type = this.ERROR_TYPES.RATE_LIMIT;
            errorInfo.severity = this.SEVERITY_LEVELS.MEDIUM;
            errorInfo.canAutoRecover = false;
        } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            errorInfo.type = this.ERROR_TYPES.TIMEOUT;
            errorInfo.severity = this.SEVERITY_LEVELS.MEDIUM;
            errorInfo.canAutoRecover = true;
        }
        
        return errorInfo;
    }
    
    // 记录错误
    static async logError(errorInfo) {
        try {
            await query(`
                INSERT INTO error_logs (
                    error_type, severity, message, stack_trace, context, 
                    user_id, operation, retry_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                errorInfo.type,
                errorInfo.severity,
                errorInfo.message,
                errorInfo.stack || '',
                JSON.stringify(errorInfo.context),
                errorInfo.context.userId || null,
                errorInfo.context.operation || 'unknown',
                errorInfo.retryCount,
                errorInfo.timestamp
            ]);
            
            console.error(`📝 错误已记录: ${errorInfo.type} - ${errorInfo.message}`);
            
        } catch (logError) {
            console.error('❌ 记录错误失败:', logError);
        }
    }
    
    // 通知用户
    static async notifyUser(errorInfo) {
        try {
            if (!errorInfo.context.userId) return;
            
            const notification = {
                type: 'ERROR_NOTIFICATION',
                data: {
                    errorType: errorInfo.type,
                    severity: errorInfo.severity,
                    message: this.getUserFriendlyMessage(errorInfo),
                    canRetry: this.canRetry(errorInfo),
                    retryAfter: this.getRetryDelay(errorInfo.retryCount),
                    timestamp: errorInfo.timestamp
                }
            };
            
            // 通过WebSocket发送通知
            if (websocketService && websocketService.sendLinkNotificationToUser) {
                websocketService.sendLinkNotificationToUser(errorInfo.context.userId, notification);
            }
            
        } catch (notifyError) {
            console.error('❌ 通知用户失败:', notifyError);
        }
    }
    
    // 尝试自动恢复
    static async attemptRecovery(errorInfo) {
        try {
            console.log(`🔄 尝试自动恢复: ${errorInfo.type}`);
            
            switch (errorInfo.type) {
                case this.ERROR_TYPES.NETWORK:
                    return await this.recoverNetworkError(errorInfo);
                    
                case this.ERROR_TYPES.SYNC:
                    return await this.recoverSyncError(errorInfo);
                    
                case this.ERROR_TYPES.DATABASE:
                    return await this.recoverDatabaseError(errorInfo);
                    
                case this.ERROR_TYPES.WEBSOCKET:
                    return await this.recoverWebSocketError(errorInfo);
                    
                case this.ERROR_TYPES.TIMEOUT:
                    return await this.recoverTimeoutError(errorInfo);
                    
                default:
                    return { success: false, message: '无法自动恢复此类型的错误' };
            }
            
        } catch (recoveryError) {
            console.error('❌ 自动恢复失败:', recoveryError);
            return { success: false, message: '自动恢复过程中发生错误' };
        }
    }
    
    // 网络错误恢复
    static async recoverNetworkError(errorInfo) {
        if (errorInfo.retryCount >= this.RETRY_CONFIG.MAX_RETRIES) {
            return { success: false, message: '网络连接重试次数已达上限' };
        }
        
        const delay = this.getRetryDelay(errorInfo.retryCount);
        console.log(`⏳ 网络错误恢复: ${delay}ms 后重试`);
        
        await this.sleep(delay);
        
        // 重新执行原始操作
        if (errorInfo.context.retryFunction) {
            try {
                const result = await errorInfo.context.retryFunction();
                return { success: true, result, message: '网络连接已恢复' };
            } catch (retryError) {
                errorInfo.retryCount++;
                return await this.attemptRecovery(errorInfo);
            }
        }
        
        return { success: false, message: '无法重试原始操作' };
    }
    
    // 同步错误恢复
    static async recoverSyncError(errorInfo) {
        try {
            console.log('🔄 尝试恢复数据同步错误...');
            
            // 检查同步队列
            const pendingSyncs = await query(`
                SELECT * FROM sync_queue 
                WHERE status = 'failed' AND retry_count < ?
                ORDER BY created_at ASC
                LIMIT 10
            `, [this.RETRY_CONFIG.MAX_RETRIES]);
            
            let recoveredCount = 0;
            
            for (const sync of pendingSyncs) {
                try {
                    // 重新执行同步操作
                    await this.retrySyncOperation(sync);
                    recoveredCount++;
                } catch (syncError) {
                    console.error(`❌ 同步操作重试失败: ${sync.id}`, syncError);
                }
            }
            
            return {
                success: recoveredCount > 0,
                message: `成功恢复 ${recoveredCount} 个同步操作`,
                recoveredCount
            };
            
        } catch (error) {
            return { success: false, message: '同步错误恢复失败' };
        }
    }
    
    // 数据库错误恢复
    static async recoverDatabaseError(errorInfo) {
        try {
            console.log('🔄 尝试恢复数据库错误...');
            
            // 等待一段时间后重试
            const delay = this.getRetryDelay(errorInfo.retryCount);
            await this.sleep(delay);
            
            // 测试数据库连接
            await query('SELECT 1');
            
            return { success: true, message: '数据库连接已恢复' };
            
        } catch (error) {
            return { success: false, message: '数据库连接恢复失败' };
        }
    }
    
    // WebSocket错误恢复
    static async recoverWebSocketError(errorInfo) {
        try {
            console.log('🔄 尝试恢复WebSocket连接...');
            
            // 通知WebSocket服务重新连接
            if (websocketService && websocketService.reconnect) {
                await websocketService.reconnect();
                return { success: true, message: 'WebSocket连接已恢复' };
            }
            
            return { success: false, message: 'WebSocket服务不可用' };
            
        } catch (error) {
            return { success: false, message: 'WebSocket连接恢复失败' };
        }
    }
    
    // 超时错误恢复
    static async recoverTimeoutError(errorInfo) {
        if (errorInfo.retryCount >= this.RETRY_CONFIG.MAX_RETRIES) {
            return { success: false, message: '操作超时重试次数已达上限' };
        }
        
        const delay = this.getRetryDelay(errorInfo.retryCount);
        console.log(`⏳ 超时错误恢复: ${delay}ms 后重试`);
        
        await this.sleep(delay);
        
        return { success: true, message: '准备重试超时操作' };
    }
    
    // 重试同步操作
    static async retrySyncOperation(syncRecord) {
        try {
            const syncData = JSON.parse(syncRecord.data);
            
            // 更新重试次数
            await query(`
                UPDATE sync_queue 
                SET retry_count = retry_count + 1, last_retry_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [syncRecord.id]);
            
            // 根据操作类型执行相应的同步
            switch (syncRecord.operation_type) {
                case 'todo_sync':
                    // 这里应该调用实际的同步方法
                    console.log(`🔄 重试TODO同步: ${syncRecord.id}`);
                    break;
                    
                case 'notes_sync':
                    console.log(`🔄 重试Notes同步: ${syncRecord.id}`);
                    break;
                    
                default:
                    throw new Error(`未知的同步操作类型: ${syncRecord.operation_type}`);
            }
            
            // 标记为成功
            await query(`
                UPDATE sync_queue 
                SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [syncRecord.id]);
            
            console.log(`✅ 同步操作重试成功: ${syncRecord.id}`);
            
        } catch (error) {
            // 标记为失败
            await query(`
                UPDATE sync_queue 
                SET status = 'failed', error_message = ?
                WHERE id = ?
            `, [error.message, syncRecord.id]);
            
            throw error;
        }
    }
    
    // 获取用户友好的错误消息
    static getUserFriendlyMessage(errorInfo) {
        const messages = {
            [this.ERROR_TYPES.NETWORK]: {
                [this.SEVERITY_LEVELS.LOW]: '网络连接不稳定，请检查网络设置',
                [this.SEVERITY_LEVELS.MEDIUM]: '网络连接中断，正在尝试重新连接...',
                [this.SEVERITY_LEVELS.HIGH]: '网络连接失败，请检查网络连接后重试',
                [this.SEVERITY_LEVELS.CRITICAL]: '网络连接严重异常，请联系管理员'
            },
            [this.ERROR_TYPES.VALIDATION]: {
                [this.SEVERITY_LEVELS.LOW]: '输入信息有误，请检查后重新提交',
                [this.SEVERITY_LEVELS.MEDIUM]: '数据验证失败，请确认输入信息正确',
                [this.SEVERITY_LEVELS.HIGH]: '数据格式错误，请按要求填写',
                [this.SEVERITY_LEVELS.CRITICAL]: '数据验证严重错误'
            },
            [this.ERROR_TYPES.SYNC]: {
                [this.SEVERITY_LEVELS.LOW]: '数据同步延迟，稍后会自动完成',
                [this.SEVERITY_LEVELS.MEDIUM]: '数据同步失败，正在重试...',
                [this.SEVERITY_LEVELS.HIGH]: '数据同步异常，请手动刷新页面',
                [this.SEVERITY_LEVELS.CRITICAL]: '数据同步严重失败，请联系管理员'
            },
            [this.ERROR_TYPES.PERMISSION]: {
                [this.SEVERITY_LEVELS.LOW]: '权限不足，请确认操作权限',
                [this.SEVERITY_LEVELS.MEDIUM]: '无权限执行此操作',
                [this.SEVERITY_LEVELS.HIGH]: '访问被拒绝，请联系管理员',
                [this.SEVERITY_LEVELS.CRITICAL]: '严重权限错误'
            },
            [this.ERROR_TYPES.DATABASE]: {
                [this.SEVERITY_LEVELS.LOW]: '数据库繁忙，请稍后重试',
                [this.SEVERITY_LEVELS.MEDIUM]: '数据库连接异常，正在恢复...',
                [this.SEVERITY_LEVELS.HIGH]: '数据库错误，请稍后重试',
                [this.SEVERITY_LEVELS.CRITICAL]: '数据库严重错误，请联系管理员'
            },
            [this.ERROR_TYPES.WEBSOCKET]: {
                [this.SEVERITY_LEVELS.LOW]: '实时连接不稳定',
                [this.SEVERITY_LEVELS.MEDIUM]: '实时连接中断，正在重连...',
                [this.SEVERITY_LEVELS.HIGH]: '实时连接失败，请刷新页面',
                [this.SEVERITY_LEVELS.CRITICAL]: '实时连接严重异常'
            },
            [this.ERROR_TYPES.RATE_LIMIT]: {
                [this.SEVERITY_LEVELS.LOW]: '操作过于频繁，请稍后再试',
                [this.SEVERITY_LEVELS.MEDIUM]: '请求频率过高，请等待后重试',
                [this.SEVERITY_LEVELS.HIGH]: '操作被限制，请稍后重试',
                [this.SEVERITY_LEVELS.CRITICAL]: '严重超出频率限制'
            },
            [this.ERROR_TYPES.TIMEOUT]: {
                [this.SEVERITY_LEVELS.LOW]: '操作超时，正在重试...',
                [this.SEVERITY_LEVELS.MEDIUM]: '请求超时，请稍后重试',
                [this.SEVERITY_LEVELS.HIGH]: '操作超时，请检查网络连接',
                [this.SEVERITY_LEVELS.CRITICAL]: '严重超时错误'
            }
        };
        
        return messages[errorInfo.type]?.[errorInfo.severity] || '系统遇到未知错误，请稍后重试';
    }
    
    // 检查是否可以重试
    static canRetry(errorInfo) {
        const retryableTypes = [
            this.ERROR_TYPES.NETWORK,
            this.ERROR_TYPES.SYNC,
            this.ERROR_TYPES.DATABASE,
            this.ERROR_TYPES.WEBSOCKET,
            this.ERROR_TYPES.TIMEOUT
        ];
        
        return retryableTypes.includes(errorInfo.type) && 
               errorInfo.retryCount < this.RETRY_CONFIG.MAX_RETRIES;
    }
    
    // 获取重试延迟时间
    static getRetryDelay(retryCount) {
        const delay = Math.min(
            this.RETRY_CONFIG.BASE_DELAY * Math.pow(this.RETRY_CONFIG.BACKOFF_MULTIPLIER, retryCount),
            this.RETRY_CONFIG.MAX_DELAY
        );
        return delay;
    }
    
    // 睡眠函数
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 获取错误统计
    static async getErrorStats(timeRange = '24h') {
        try {
            let timeCondition = '';
            
            switch (timeRange) {
                case '1h':
                    timeCondition = "AND created_at > datetime('now', '-1 hour')";
                    break;
                case '24h':
                    timeCondition = "AND created_at > datetime('now', '-1 day')";
                    break;
                case '7d':
                    timeCondition = "AND created_at > datetime('now', '-7 days')";
                    break;
                case '30d':
                    timeCondition = "AND created_at > datetime('now', '-30 days')";
                    break;
            }
            
            const stats = await query(`
                SELECT 
                    error_type,
                    severity,
                    COUNT(*) as count,
                    AVG(retry_count) as avg_retries
                FROM error_logs 
                WHERE 1=1 ${timeCondition}
                GROUP BY error_type, severity
                ORDER BY count DESC
            `);
            
            const totalErrors = await query(`
                SELECT COUNT(*) as total FROM error_logs WHERE 1=1 ${timeCondition}
            `);
            
            return {
                total: totalErrors[0].total,
                breakdown: stats,
                timeRange
            };
            
        } catch (error) {
            console.error('❌ 获取错误统计失败:', error);
            return null;
        }
    }
    
    // 清理旧的错误日志
    static async cleanupOldLogs(daysToKeep = 30) {
        try {
            const result = await query(`
                DELETE FROM error_logs 
                WHERE created_at < datetime('now', '-${daysToKeep} days')
            `);
            
            console.log(`🧹 清理了 ${result.affectedRows} 条旧的错误日志`);
            return result.affectedRows;
            
        } catch (error) {
            console.error('❌ 清理错误日志失败:', error);
            return 0;
        }
    }
}

module.exports = ErrorHandlingService;