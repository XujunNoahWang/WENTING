// Link功能安全中间件
const { query } = require('../config/sqlite');

// 关联请求频率限制
const requestLimits = new Map(); // 存储用户请求记录

class LinkSecurity {
    
    // 验证用户权限
    static async validateUserPermission(req, res, next) {
        try {
            const { fromAppUser, supervisedUserId } = req.body;
            const userFromHeader = req.headers['x-app-user'] || req.body.appUser;
            
            // 验证请求用户身份
            if (!userFromHeader) {
                return res.status(401).json({
                    success: false,
                    message: '缺少用户身份验证'
                });
            }
            
            // 验证用户是否有权限操作该被监管用户
            if (fromAppUser && supervisedUserId) {
                const hasPermission = await LinkSecurity.checkSupervisedUserPermission(fromAppUser, supervisedUserId);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '无权限操作该被监管用户'
                    });
                }
            }
            
            next();
        } catch (error) {
            console.error('❌ 权限验证失败:', error);
            res.status(500).json({
                success: false,
                message: '权限验证失败'
            });
        }
    }
    
    // 关联请求频率限制
    static rateLimitLinkRequests(req, res, next) {
        const { fromAppUser } = req.body;
        
        if (!fromAppUser) {
            return res.status(400).json({
                success: false,
                message: '缺少发起用户信息'
            });
        }
        
        const now = Date.now();
        const userKey = `link_requests_${fromAppUser}`;
        
        // 获取用户的请求记录
        if (!requestLimits.has(userKey)) {
            requestLimits.set(userKey, []);
        }
        
        const userRequests = requestLimits.get(userKey);
        
        // 清理1小时前的记录
        const oneHourAgo = now - 60 * 60 * 1000;
        const recentRequests = userRequests.filter(timestamp => timestamp > oneHourAgo);
        requestLimits.set(userKey, recentRequests);
        
        // 检查频率限制（每小时最多5个请求）
        if (recentRequests.length >= 5) {
            return res.status(429).json({
                success: false,
                message: '关联请求过于频繁，请稍后再试'
            });
        }
        
        // 记录当前请求
        recentRequests.push(now);
        requestLimits.set(userKey, recentRequests);
        
        next();
    }
    
    // 验证关联请求权限
    static async validateLinkRequestPermission(req, res, next) {
        try {
            const { requestId } = req.params;
            const { appUser } = req.body;
            
            if (!requestId || !appUser) {
                return res.status(400).json({
                    success: false,
                    message: '缺少必要参数'
                });
            }
            
            // 验证请求是否属于当前用户
            const request = await query(`
                SELECT * FROM link_requests 
                WHERE id = ? AND to_app_user = ? AND status = 'pending'
            `, [requestId, appUser]);
            
            if (request.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '请求不存在或无权限处理'
                });
            }
            
            // 检查请求是否过期
            const requestData = request[0];
            if (new Date(requestData.expires_at) < new Date()) {
                return res.status(410).json({
                    success: false,
                    message: '关联请求已过期'
                });
            }
            
            req.linkRequest = requestData;
            next();
        } catch (error) {
            console.error('❌ 关联请求权限验证失败:', error);
            res.status(500).json({
                success: false,
                message: '权限验证失败'
            });
        }
    }
    
    // 验证关联关系权限
    static async validateLinkPermission(req, res, next) {
        try {
            const { linkId } = req.params;
            const { appUser } = req.body;
            
            if (!linkId || !appUser) {
                return res.status(400).json({
                    success: false,
                    message: '缺少必要参数'
                });
            }
            
            // 验证关联关系是否属于当前用户
            const link = await query(`
                SELECT * FROM user_links 
                WHERE id = ? AND (manager_app_user = ? OR linked_app_user = ?) AND status = 'active'
            `, [linkId, appUser, appUser]);
            
            if (link.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '关联关系不存在或无权限操作'
                });
            }
            
            req.userLink = link[0];
            next();
        } catch (error) {
            console.error('❌ 关联关系权限验证失败:', error);
            res.status(500).json({
                success: false,
                message: '权限验证失败'
            });
        }
    }
    
    // 检查被监管用户权限
    static async checkSupervisedUserPermission(appUser, supervisedUserId) {
        try {
            const result = await query(`
                SELECT 1 FROM users 
                WHERE id = ? AND app_user_id = ? AND is_active = 1
            `, [supervisedUserId, appUser]);
            
            return result.length > 0;
        } catch (error) {
            console.error('❌ 检查被监管用户权限失败:', error);
            return false;
        }
    }
    
    // 验证用户名格式
    static validateUsername(username) {
        if (!username || typeof username !== 'string') {
            return false;
        }
        
        // 只允许小写字母和数字，长度1-10
        const regex = /^[a-z0-9]{1,10}$/;
        return regex.test(username);
    }
    
    // 验证关联请求输入数据
    static validateLinkRequestData(req, res, next) {
        const { fromAppUser, toAppUser, supervisedUserId, message } = req.body;
        
        // 验证必需字段
        if (!fromAppUser || !toAppUser || !supervisedUserId) {
            return res.status(400).json({
                success: false,
                message: '缺少必需参数：fromAppUser, toAppUser, supervisedUserId'
            });
        }
        
        // 验证用户名格式
        if (!LinkSecurity.validateUsername(fromAppUser)) {
            return res.status(400).json({
                success: false,
                message: '发起用户名格式无效'
            });
        }
        
        if (!LinkSecurity.validateUsername(toAppUser)) {
            return res.status(400).json({
                success: false,
                message: '目标用户名格式无效'
            });
        }
        
        // 验证被监管用户ID
        if (!Number.isInteger(Number(supervisedUserId)) || Number(supervisedUserId) <= 0) {
            return res.status(400).json({
                success: false,
                message: '被监管用户ID格式无效'
            });
        }
        
        // 验证消息长度
        if (message && message.length > 200) {
            return res.status(400).json({
                success: false,
                message: '消息长度不能超过200字符'
            });
        }
        
        // 防止自己关联自己
        if (fromAppUser === toAppUser) {
            return res.status(400).json({
                success: false,
                message: '不能关联自己'
            });
        }
        
        next();
    }
    
    // IP地址频率限制
    static ipRateLimit(req, res, next) {
        const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const now = Date.now();
        const ipKey = `ip_requests_${clientIP}`;
        
        // 获取IP的请求记录
        if (!requestLimits.has(ipKey)) {
            requestLimits.set(ipKey, []);
        }
        
        const ipRequests = requestLimits.get(ipKey);
        
        // 清理10分钟前的记录
        const tenMinutesAgo = now - 10 * 60 * 1000;
        const recentRequests = ipRequests.filter(timestamp => timestamp > tenMinutesAgo);
        requestLimits.set(ipKey, recentRequests);
        
        // 检查频率限制（每10分钟最多20个请求）
        if (recentRequests.length >= 20) {
            return res.status(429).json({
                success: false,
                message: 'IP请求过于频繁，请稍后再试'
            });
        }
        
        // 记录当前请求
        recentRequests.push(now);
        requestLimits.set(ipKey, recentRequests);
        
        next();
    }
    
    // 验证关联关系状态
    static async validateLinkStatus(req, res, next) {
        try {
            const { linkId } = req.params;
            
            if (!linkId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少关联ID参数'
                });
            }
            
            // 检查关联关系是否存在且为活跃状态
            const link = await query(`
                SELECT * FROM user_links 
                WHERE id = ? AND status = 'active'
            `, [linkId]);
            
            if (link.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '关联关系不存在或已失效'
                });
            }
            
            req.validatedLink = link[0];
            next();
        } catch (error) {
            console.error('❌ 关联状态验证失败:', error);
            res.status(500).json({
                success: false,
                message: '关联状态验证失败'
            });
        }
    }
    
    // 清理过期的频率限制记录
    static cleanupRateLimits() {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        
        for (const [key, timestamps] of requestLimits.entries()) {
            const recentRequests = timestamps.filter(timestamp => timestamp > oneHourAgo);
            if (recentRequests.length === 0) {
                requestLimits.delete(key);
            } else {
                requestLimits.set(key, recentRequests);
            }
        }
    }
    
    // 获取安全统计信息
    static getSecurityStats() {
        return {
            activeRateLimits: requestLimits.size,
            totalTrackedUsers: Array.from(requestLimits.keys()).length,
            lastCleanup: new Date().toISOString()
        };
    }
}

// 定期清理过期的频率限制记录（每小时）
setInterval(() => {
    LinkSecurity.cleanupRateLimits();
}, 60 * 60 * 1000);

module.exports = LinkSecurity;