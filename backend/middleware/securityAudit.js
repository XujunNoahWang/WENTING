// 安全审计日志中间件
const { query } = require('../config/sqlite');

class SecurityAudit {
    
    // 记录安全事件
    static async logSecurityEvent(eventType, details, req = null) {
        try {
            const timestamp = new Date().toISOString();
            const clientIP = req ? (req.ip || req.connection.remoteAddress || req.socket.remoteAddress) : 'system';
            const userAgent = req ? req.get('User-Agent') : 'system';
            const appUser = req ? (req.headers['x-app-user'] || req.body.appUser) : 'system';
            
            // 记录到数据库（如果有安全日志表）
            try {
                await query(`
                    INSERT INTO security_logs (event_type, details, client_ip, user_agent, app_user, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [eventType, JSON.stringify(details), clientIP, userAgent, appUser, timestamp]);
            } catch (dbError) {
                // 如果数据库记录失败，至少记录到控制台
                console.log(`🔒 安全事件 [${timestamp}]: ${eventType}`, details);
            }
            
            // 同时记录到控制台
            console.log(`🔒 安全事件 [${timestamp}]: ${eventType}`, {
                details,
                clientIP,
                appUser,
                userAgent: userAgent ? userAgent.substring(0, 100) : 'unknown'
            });
            
        } catch (error) {
            console.error('❌ 记录安全事件失败:', error);
        }
    }
    
    // 记录权限拒绝事件
    static async logPermissionDenied(req, res, next) {
        const originalSend = res.json;
        
        res.json = function(data) {
            if (data && !data.success && res.statusCode === 403) {
                SecurityAudit.logSecurityEvent('PERMISSION_DENIED', {
                    url: req.originalUrl,
                    method: req.method,
                    statusCode: res.statusCode,
                    message: data.message,
                    params: req.params,
                    body: req.body ? Object.keys(req.body) : []
                }, req);
            }
            return originalSend.call(this, data);
        };
        
        next();
    }
    
    // 记录频率限制事件
    static async logRateLimitExceeded(req, res, next) {
        const originalSend = res.json;
        
        res.json = function(data) {
            if (data && !data.success && res.statusCode === 429) {
                SecurityAudit.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
                    url: req.originalUrl,
                    method: req.method,
                    statusCode: res.statusCode,
                    message: data.message,
                    clientIP: req.ip || req.connection.remoteAddress
                }, req);
            }
            return originalSend.call(this, data);
        };
        
        next();
    }
    
    // 记录关联操作事件
    static async logLinkOperation(operation, details, req) {
        await this.logSecurityEvent('LINK_OPERATION', {
            operation,
            ...details
        }, req);
    }
    
    // 记录数据访问事件
    static async logDataAccess(operation, table, userId, req) {
        await this.logSecurityEvent('DATA_ACCESS', {
            operation,
            table,
            userId,
            url: req.originalUrl
        }, req);
    }
    
    // 记录认证失败事件
    static async logAuthFailure(reason, req) {
        await this.logSecurityEvent('AUTH_FAILURE', {
            reason,
            url: req.originalUrl,
            method: req.method
        }, req);
    }
    
    // 获取安全统计信息
    static async getSecurityStats(timeRange = '24h') {
        try {
            let timeCondition = '';
            switch (timeRange) {
                case '1h':
                    timeCondition = "datetime('now', '-1 hour')";
                    break;
                case '24h':
                    timeCondition = "datetime('now', '-1 day')";
                    break;
                case '7d':
                    timeCondition = "datetime('now', '-7 days')";
                    break;
                default:
                    timeCondition = "datetime('now', '-1 day')";
            }
            
            const stats = await query(`
                SELECT 
                    event_type,
                    COUNT(*) as count,
                    COUNT(DISTINCT client_ip) as unique_ips,
                    COUNT(DISTINCT app_user) as unique_users
                FROM security_logs 
                WHERE created_at >= ${timeCondition}
                GROUP BY event_type
                ORDER BY count DESC
            `);
            
            return {
                timeRange,
                events: stats,
                totalEvents: stats.reduce((sum, event) => sum + event.count, 0),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ 获取安全统计失败:', error);
            return {
                error: '获取安全统计失败',
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // 检测可疑活动
    static async detectSuspiciousActivity() {
        try {
            const oneHourAgo = "datetime('now', '-1 hour')";
            
            // 检测频繁的权限拒绝
            const frequentDenials = await query(`
                SELECT client_ip, COUNT(*) as denial_count
                FROM security_logs 
                WHERE event_type = 'PERMISSION_DENIED' 
                AND created_at >= ${oneHourAgo}
                GROUP BY client_ip
                HAVING denial_count >= 10
                ORDER BY denial_count DESC
            `);
            
            // 检测频繁的认证失败
            const frequentAuthFailures = await query(`
                SELECT client_ip, COUNT(*) as failure_count
                FROM security_logs 
                WHERE event_type = 'AUTH_FAILURE' 
                AND created_at >= ${oneHourAgo}
                GROUP BY client_ip
                HAVING failure_count >= 5
                ORDER BY failure_count DESC
            `);
            
            // 检测异常的关联操作
            const unusualLinkOps = await query(`
                SELECT app_user, COUNT(*) as operation_count
                FROM security_logs 
                WHERE event_type = 'LINK_OPERATION' 
                AND created_at >= ${oneHourAgo}
                GROUP BY app_user
                HAVING operation_count >= 20
                ORDER BY operation_count DESC
            `);
            
            return {
                frequentPermissionDenials: frequentDenials,
                frequentAuthFailures: frequentAuthFailures,
                unusualLinkOperations: unusualLinkOps,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ 检测可疑活动失败:', error);
            return {
                error: '检测可疑活动失败',
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = SecurityAudit;