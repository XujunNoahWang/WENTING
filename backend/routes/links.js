// Link功能API路由
const express = require('express');
const router = express.Router();
const LinkService = require('../services/linkService');
const LinkSecurity = require('../middleware/linkSecurity');
const SecurityAudit = require('../middleware/securityAudit');

// 应用安全审计中间件到所有路由
router.use(SecurityAudit.logPermissionDenied);
router.use(SecurityAudit.logRateLimitExceeded);

// 检查用户的关联状态
router.get('/user/:appUser/status', async (req, res) => {
    try {
        const { appUser } = req.params;
        
        if (!appUser) {
            return res.status(400).json({
                success: false,
                message: '用户名不能为空'
            });
        }
        
        const userLinks = await LinkService.getUserLinks(appUser);
        
        // 将asManager和asLinked合并为一个数组，供前端使用
        const allLinks = [];
        if (userLinks.asManager && userLinks.asManager.length > 0) {
            allLinks.push(...userLinks.asManager);
        }
        if (userLinks.asLinked && userLinks.asLinked.length > 0) {
            allLinks.push(...userLinks.asLinked);
        }
        
        res.json({
            success: true,
            data: {
                appUser,
                links: allLinks, // 前端期望的扁平数组格式
                hasLinks: allLinks.length > 0,
                timestamp: Date.now()
            },
            message: '获取关联状态成功'
        });
        
    } catch (error) {
        console.error('❌ 获取关联状态失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 创建关联请求
router.post('/requests', 
    LinkSecurity.ipRateLimit,
    LinkSecurity.validateLinkRequestData,
    LinkSecurity.validateUserPermission,
    LinkSecurity.rateLimitLinkRequests,
    async (req, res) => {
    try {
        const { fromAppUser, toAppUser, supervisedUserId, message } = req.body;
        
        // 验证必需参数
        if (!fromAppUser || !toAppUser || !supervisedUserId) {
            return res.status(400).json({
                success: false,
                message: '缺少必需参数'
            });
        }
        
        const request = await LinkService.createRequest(fromAppUser, toAppUser, supervisedUserId, message);
        
        res.status(201).json({
            success: true,
            data: request,
            message: '关联请求创建成功'
        });
        
    } catch (error) {
        console.error('❌ 创建关联请求失败:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// 获取用户的待处理请求
router.get('/requests/pending/:appUser', async (req, res) => {
    try {
        const { appUser } = req.params;
        
        const requests = await LinkService.getPendingRequests(appUser);
        
        res.json({
            success: true,
            data: requests,
            message: '获取待处理请求成功'
        });
        
    } catch (error) {
        console.error('❌ 获取待处理请求失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 处理关联请求（接受或拒绝）
router.put('/requests/:requestId', 
    LinkSecurity.validateLinkRequestPermission,
    async (req, res) => {
    try {
        const { requestId } = req.params;
        const { action, appUser } = req.body;
        
        // 验证参数
        if (!action || !appUser) {
            return res.status(400).json({
                success: false,
                message: '缺少必需参数'
            });
        }
        
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: '无效的操作类型'
            });
        }
        
        const result = await LinkService.handleRequest(requestId, action, appUser);
        
        res.json({
            success: true,
            data: result,
            message: `关联请求已${action === 'accept' ? '接受' : '拒绝'}`
        });
        
    } catch (error) {
        console.error('❌ 处理关联请求失败:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// 获取用户的关联关系
router.get('/user/:appUser', async (req, res) => {
    try {
        const { appUser } = req.params;
        
        const links = await LinkService.getUserLinks(appUser);
        
        res.json({
            success: true,
            data: links,
            message: '获取用户关联关系成功'
        });
        
    } catch (error) {
        console.error('❌ 获取用户关联关系失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 取消关联关系
router.delete('/:linkId', 
    LinkSecurity.validateLinkStatus,
    LinkSecurity.validateLinkPermission,
    async (req, res) => {
    try {
        const { linkId } = req.params;
        const { appUser } = req.body;
        
        if (!appUser) {
            return res.status(400).json({
                success: false,
                message: '缺少用户参数'
            });
        }
        
        const result = await LinkService.cancelLink(linkId, appUser);
        
        res.json({
            success: true,
            data: result,
            message: '关联关系已取消'
        });
        
    } catch (error) {
        console.error('❌ 取消关联关系失败:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// 验证用户权限
router.get('/permission/:appUser/:supervisedUserId', async (req, res) => {
    try {
        const { appUser, supervisedUserId } = req.params;
        
        const hasPermission = await LinkService.validateUserPermission(appUser, supervisedUserId);
        
        res.json({
            success: true,
            data: { hasPermission },
            message: '权限验证完成'
        });
        
    } catch (error) {
        console.error('❌ 验证用户权限失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 清理过期请求（管理员接口）
router.post('/cleanup', async (req, res) => {
    try {
        const cleanedCount = await LinkService.cleanupExpiredRequests();
        
        res.json({
            success: true,
            data: { cleanedCount },
            message: `清理了 ${cleanedCount} 个过期请求`
        });
        
    } catch (error) {
        console.error('❌ 清理过期请求失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取关联统计信息
router.get('/stats/:appUser', async (req, res) => {
    try {
        const { appUser } = req.params;
        
        const links = await LinkService.getUserLinks(appUser);
        const pendingRequests = await LinkService.getPendingRequests(appUser);
        
        const stats = {
            totalLinksAsManager: links.asManager.length,
            totalLinksAsLinked: links.asLinked.length,
            pendingRequests: pendingRequests.length,
            totalLinks: links.asManager.length + links.asLinked.length
        };
        
        res.json({
            success: true,
            data: stats,
            message: '获取关联统计信息成功'
        });
        
    } catch (error) {
        console.error('❌ 获取关联统计信息失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取错误处理统计信息（管理员接口）
router.get('/error-stats', async (req, res) => {
    try {
        const ErrorHandlingService = require('../services/errorHandlingService');
        const DataSyncService = require('../services/dataSyncService');
        
        const timeRange = req.query.timeRange || '24h';
        
        const errorStats = await ErrorHandlingService.getErrorStats(timeRange);
        const syncStats = await DataSyncService.getSyncStats();
        
        res.json({
            success: true,
            data: {
                errors: errorStats,
                sync: syncStats,
                timestamp: new Date().toISOString()
            },
            message: '获取错误统计信息成功'
        });
        
    } catch (error) {
        console.error('❌ 获取错误统计信息失败:', error);
        
        const ErrorHandlingService = require('../services/errorHandlingService');
        const errorResult = await ErrorHandlingService.handleError(error, {
            operation: 'getErrorStats',
            endpoint: '/links/error-stats'
        });
        
        res.status(500).json({
            success: false,
            message: errorResult.userMessage || error.message,
            canRetry: errorResult.canRetry
        });
    }
});

// 手动触发错误恢复（管理员接口）
router.post('/recover', async (req, res) => {
    try {
        const ErrorRecoveryScheduler = require('../scripts/error-recovery-scheduler');
        
        const { action } = req.body;
        
        let result;
        switch (action) {
            case 'sync_queue':
                result = await ErrorRecoveryScheduler.triggerSyncQueueProcessing();
                break;
            case 'cleanup':
                result = await ErrorRecoveryScheduler.triggerCleanup();
                break;
            case 'health_check':
                result = await ErrorRecoveryScheduler.getHealthCheck();
                break;
            default:
                throw new Error('无效的恢复操作类型');
        }
        
        res.json({
            success: true,
            data: result,
            message: `${action} 操作完成`
        });
        
    } catch (error) {
        console.error('❌ 手动错误恢复失败:', error);
        
        const ErrorHandlingService = require('../services/errorHandlingService');
        const errorResult = await ErrorHandlingService.handleError(error, {
            operation: 'manualRecovery',
            endpoint: '/links/recover',
            action: req.body.action
        });
        
        res.status(500).json({
            success: false,
            message: errorResult.userMessage || error.message,
            canRetry: errorResult.canRetry
        });
    }
});

module.exports = router;