// 数据访问权限中间件
const { query } = require('../config/sqlite');
const LinkService = require('../services/linkService');

class DataAccessSecurity {
    
    // 验证用户对被监管用户数据的访问权限
    static async validateDataAccess(req, res, next) {
        try {
            const { userId } = req.params;
            const appUser = req.headers['x-app-user'] || req.body.appUser || req.query.appUser;
            
            if (!appUser) {
                return res.status(401).json({
                    success: false,
                    message: '缺少用户身份验证'
                });
            }
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少用户ID参数'
                });
            }
            
            // 验证用户是否有权限访问该被监管用户的数据
            const hasPermission = await LinkService.validateUserPermission(appUser, userId);
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: '无权限访问该用户数据'
                });
            }
            
            // 将验证信息添加到请求对象
            req.validatedAccess = {
                appUser,
                supervisedUserId: userId,
                hasPermission: true
            };
            
            // 记录数据访问事件
            const SecurityAudit = require('./securityAudit');
            await SecurityAudit.logDataAccess('READ', 'user_data', userId, req);
            
            next();
        } catch (error) {
            console.error('❌ 数据访问权限验证失败:', error);
            res.status(500).json({
                success: false,
                message: '权限验证失败'
            });
        }
    }
    
    // 验证TODO操作权限
    static async validateTodoAccess(req, res, next) {
        try {
            // 兼容不同的参数名：todoId 或 id
            const todoId = req.params.todoId || req.params.id;
            const appUser = req.headers['x-app-user'] || req.body.appUser || req.query.appUser;
            
            if (!appUser) {
                return res.status(401).json({
                    success: false,
                    message: '缺少用户身份验证'
                });
            }
            
            if (!todoId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少TODO ID参数'
                });
            }
            
            // 获取TODO信息
            const todo = await query(`
                SELECT t.*, u.app_user_id 
                FROM todos t 
                JOIN users u ON t.user_id = u.id 
                WHERE t.id = ?
            `, [todoId]);
            
            if (todo.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'TODO不存在'
                });
            }
            
            const todoData = todo[0];
            
            // 验证用户是否有权限操作该TODO
            const hasPermission = await LinkService.validateUserPermission(appUser, todoData.user_id);
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: '无权限操作该TODO'
                });
            }
            
            // 将验证信息添加到请求对象
            req.validatedTodo = {
                ...todoData,
                appUser,
                hasPermission: true
            };
            
            // 记录TODO访问事件
            const SecurityAudit = require('./securityAudit');
            await SecurityAudit.logDataAccess('ACCESS', 'todos', todoData.user_id, req);
            
            next();
        } catch (error) {
            console.error('❌ TODO访问权限验证失败:', error);
            res.status(500).json({
                success: false,
                message: '权限验证失败'
            });
        }
    }
    
    // 验证笔记操作权限
    static async validateNoteAccess(req, res, next) {
        try {
            const { noteId } = req.params;
            const appUser = req.headers['x-app-user'] || req.body.appUser || req.query.appUser;
            
            if (!appUser) {
                return res.status(401).json({
                    success: false,
                    message: '缺少用户身份验证'
                });
            }
            
            if (!noteId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少笔记ID参数'
                });
            }
            
            // 获取笔记信息
            const note = await query(`
                SELECT n.*, u.app_user_id 
                FROM notes n 
                JOIN users u ON n.user_id = u.id 
                WHERE n.id = ?
            `, [noteId]);
            
            if (note.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '笔记不存在'
                });
            }
            
            const noteData = note[0];
            
            // 验证用户是否有权限操作该笔记
            const hasPermission = await LinkService.validateUserPermission(appUser, noteData.user_id);
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: '无权限操作该笔记'
                });
            }
            
            // 将验证信息添加到请求对象
            req.validatedNote = {
                ...noteData,
                appUser,
                hasPermission: true
            };
            
            next();
        } catch (error) {
            console.error('❌ 笔记访问权限验证失败:', error);
            res.status(500).json({
                success: false,
                message: '权限验证失败'
            });
        }
    }
    
    // 验证用户设置访问权限
    static async validateUserSettingsAccess(req, res, next) {
        try {
            const { userId } = req.params;
            const appUser = req.headers['x-app-user'] || req.body.appUser || req.query.appUser;
            
            if (!appUser) {
                return res.status(401).json({
                    success: false,
                    message: '缺少用户身份验证'
                });
            }
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少用户ID参数'
                });
            }
            
            // 验证用户是否有权限访问该用户设置
            const hasPermission = await LinkService.validateUserPermission(appUser, userId);
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: '无权限访问该用户设置'
                });
            }
            
            // 将验证信息添加到请求对象
            req.validatedUserSettings = {
                appUser,
                supervisedUserId: userId,
                hasPermission: true
            };
            
            next();
        } catch (error) {
            console.error('❌ 用户设置访问权限验证失败:', error);
            res.status(500).json({
                success: false,
                message: '权限验证失败'
            });
        }
    }
    
    // 验证创建数据的权限（从请求体中获取user_id）
    static async validateCreateDataAccess(req, res, next) {
        try {
            const { user_id } = req.body;
            const appUser = req.headers['x-app-user'] || req.body.appUser || req.query.appUser;
            
            if (!appUser) {
                return res.status(401).json({
                    success: false,
                    message: '缺少用户身份验证'
                });
            }
            
            if (!user_id) {
                return res.status(400).json({
                    success: false,
                    message: '缺少用户ID参数'
                });
            }
            
            // 验证用户是否有权限为该被监管用户创建数据
            const hasPermission = await LinkService.validateUserPermission(appUser, user_id);
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: '无权限为该用户创建数据'
                });
            }
            
            // 将验证信息添加到请求对象
            req.validatedCreateAccess = {
                appUser,
                supervisedUserId: user_id,
                hasPermission: true
            };
            
            // 记录数据创建权限验证事件
            const SecurityAudit = require('./securityAudit');
            await SecurityAudit.logDataAccess('CREATE_PERMISSION', 'user_data', user_id, req);
            
            next();
        } catch (error) {
            console.error('❌ 创建数据权限验证失败:', error);
            res.status(500).json({
                success: false,
                message: '权限验证失败'
            });
        }
    }
    
    // 记录数据访问日志
    static logDataAccess(operation, table, userId, appUser) {
        const timestamp = new Date().toISOString();
        console.log(`🔒 数据访问日志 [${timestamp}]: ${appUser} ${operation} ${table} for user ${userId}`);
    }
    
    // 获取数据访问统计
    static getAccessStats() {
        return {
            timestamp: new Date().toISOString(),
            message: '数据访问权限中间件运行正常'
        };
    }
}

module.exports = DataAccessSecurity;