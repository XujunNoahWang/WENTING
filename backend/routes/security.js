// 安全管理API路由
const express = require('express');
const router = express.Router();
const SecurityAudit = require('../middleware/securityAudit');
const LinkSecurity = require('../middleware/linkSecurity');
const DataAccessSecurity = require('../middleware/dataAccess');

// 获取安全统计信息
router.get('/stats/:timeRange?', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.params;
        
        // 验证时间范围参数
        if (!['1h', '24h', '7d'].includes(timeRange)) {
            return res.status(400).json({
                success: false,
                message: '无效的时间范围参数，支持: 1h, 24h, 7d'
            });
        }
        
        const stats = await SecurityAudit.getSecurityStats(timeRange);
        const linkStats = LinkSecurity.getSecurityStats();
        const dataAccessStats = DataAccessSecurity.getAccessStats();
        
        res.json({
            success: true,
            data: {
                securityEvents: stats,
                linkSecurity: linkStats,
                dataAccess: dataAccessStats,
                timestamp: new Date().toISOString()
            },
            message: '获取安全统计信息成功'
        });
        
    } catch (error) {
        console.error('❌ 获取安全统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取安全统计失败',
            error: error.message
        });
    }
});

// 检测可疑活动
router.get('/suspicious-activity', async (req, res) => {
    try {
        const suspiciousActivity = await SecurityAudit.detectSuspiciousActivity();
        
        res.json({
            success: true,
            data: suspiciousActivity,
            message: '可疑活动检测完成'
        });
        
    } catch (error) {
        console.error('❌ 检测可疑活动失败:', error);
        res.status(500).json({
            success: false,
            message: '检测可疑活动失败',
            error: error.message
        });
    }
});

// 清理过期的频率限制记录
router.post('/cleanup-rate-limits', async (req, res) => {
    try {
        LinkSecurity.cleanupRateLimits();
        
        res.json({
            success: true,
            message: '频率限制记录清理完成'
        });
        
    } catch (error) {
        console.error('❌ 清理频率限制记录失败:', error);
        res.status(500).json({
            success: false,
            message: '清理频率限制记录失败',
            error: error.message
        });
    }
});

// 获取当前安全配置
router.get('/config', (req, res) => {
    try {
        const config = {
            rateLimits: {
                linkRequests: {
                    MAX_REQUESTS: 5,
                    timeWindow: '1 hour',
                    description: '每小时最多5个关联请求'
                },
                ipRequests: {
                    MAX_REQUESTS: 20,
                    timeWindow: '10 minutes',
                    description: '每IP每10分钟最多20个请求'
                }
            },
            validation: {
                usernameFormat: '^[a-z0-9]{1,10}$',
                MESSAGE_MAX_LENGTH: 200,
                preventSelfLink: true
            },
            audit: {
                logAllEvents: true,
                retentionPeriod: '30 days',
                suspiciousActivityThresholds: {
                    PERMISSION_DENIALS: 10,
                    AUTH_FAILURES: 5,
                    LINK_OPERATIONS: 20
                }
            }
        };
        
        res.json({
            success: true,
            data: config,
            message: '获取安全配置成功'
        });
        
    } catch (error) {
        console.error('❌ 获取安全配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取安全配置失败',
            error: error.message
        });
    }
});

// 手动记录安全事件（用于测试）
router.post('/log-event', async (req, res) => {
    try {
        const { eventType, details } = req.body;
        
        if (!eventType) {
            return res.status(400).json({
                success: false,
                message: '缺少事件类型参数'
            });
        }
        
        await SecurityAudit.logSecurityEvent(eventType, details || {}, req);
        
        res.json({
            success: true,
            message: '安全事件记录成功'
        });
        
    } catch (error) {
        console.error('❌ 记录安全事件失败:', error);
        res.status(500).json({
            success: false,
            message: '记录安全事件失败',
            error: error.message
        });
    }
});

// 健康检查
router.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                securityAudit: 'active',
                linkSecurity: 'active',
                dataAccessSecurity: 'active'
            }
        },
        message: '安全系统运行正常'
    });
});

module.exports = router;