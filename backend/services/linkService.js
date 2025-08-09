// Link服务 - 用户关联功能核心逻辑
const { query, transaction } = require('../config/sqlite');
const User = require('../models/User');
const Todo = require('../models/Todo');

class LinkService {
    
    // 创建关联请求
    static async createRequest(fromAppUser, toAppUser, supervisedUserId, message = '') {
        const ErrorHandlingService = require('./errorHandlingService');
        
        try {
            console.log(`📤 创建关联请求: ${fromAppUser} -> ${toAppUser} (被监管用户: ${supervisedUserId})`);
            
            // 验证发起用户存在
            const fromUserExists = await query('SELECT username FROM app_users WHERE username = ?', [fromAppUser]);
            if (fromUserExists.length === 0) {
                const error = new Error('发起用户不存在');
                error.code = 'USER_NOT_FOUND';
                throw error;
            }
            
            // 验证目标用户存在
            const toUserExists = await query('SELECT username FROM app_users WHERE username = ?', [toAppUser]);
            if (toUserExists.length === 0) {
                const error = new Error('目标用户不存在');
                error.code = 'TARGET_USER_NOT_FOUND';
                throw error;
            }
            
            // 验证被监管用户存在且属于发起用户
            const supervisedUser = await query(`
                SELECT id, username, display_name, app_user_id 
                FROM users 
                WHERE id = ? AND app_user_id = ? AND is_active = 1
            `, [supervisedUserId, fromAppUser]);
            
            if (supervisedUser.length === 0) {
                const error = new Error('被监管用户不存在或不属于当前用户');
                error.code = 'SUPERVISED_USER_NOT_FOUND';
                throw error;
            }
            
            // 检查是否已存在活跃的关联关系
            const existingLink = await query(`
                SELECT id FROM user_links 
                WHERE manager_app_user = ? AND linked_app_user = ? AND supervised_user_id = ? AND status = 'active'
            `, [fromAppUser, toAppUser, supervisedUserId]);
            
            if (existingLink.length > 0) {
                const error = new Error('该用户已经与此被监管用户建立了关联');
                error.code = 'LINK_ALREADY_EXISTS';
                throw error;
            }
            
            // 检查是否已存在待处理的请求
            const existingRequest = await query(`
                SELECT id FROM link_requests 
                WHERE from_app_user = ? AND to_app_user = ? AND supervised_user_id = ? 
                AND status = 'pending' AND expires_at > datetime('now')
            `, [fromAppUser, toAppUser, supervisedUserId]);
            
            if (existingRequest.length > 0) {
                const error = new Error('已存在待处理的关联请求');
                error.code = 'REQUEST_ALREADY_EXISTS';
                throw error;
            }
            
            // 创建关联请求
            const result = await query(`
                INSERT INTO link_requests (from_app_user, to_app_user, supervised_user_id, supervised_user_name, message)
                VALUES (?, ?, ?, ?, ?)
            `, [fromAppUser, toAppUser, supervisedUserId, supervisedUser[0].display_name, message]);
            
            // 获取创建的请求
            const request = await query('SELECT * FROM link_requests WHERE id = ?', [result.insertId]);
            
            console.log(`✅ 关联请求创建成功，ID: ${result.insertId}`);
            return request[0];
            
        } catch (error) {
            console.error('❌ 创建关联请求失败:', error);
            
            // 使用错误处理服务
            const errorResult = await ErrorHandlingService.handleError(error, {
                operation: 'createLinkRequest',
                userId: fromAppUser,
                targetUser: toAppUser,
                supervisedUserId
            });
            
            // 如果错误处理服务无法恢复，重新抛出错误
            if (!errorResult.success) {
                throw error;
            }
            
            return errorResult.result;
        }
    }
    
    // 获取用户的待处理请求
    static async getPendingRequests(appUser) {
        try {
            const requests = await query(`
                SELECT lr.*, 
                       fu.username as from_username,
                       tu.username as to_username
                FROM link_requests lr
                LEFT JOIN app_users fu ON lr.from_app_user = fu.username
                LEFT JOIN app_users tu ON lr.to_app_user = tu.username
                WHERE lr.to_app_user = ? AND lr.status = 'pending' AND lr.expires_at > datetime('now')
                ORDER BY lr.created_at DESC
            `, [appUser]);
            
            return requests;
        } catch (error) {
            console.error('❌ 获取待处理请求失败:', error);
            throw error;
        }
    }
    
    // 处理关联请求（接受或拒绝）
    static async handleRequest(requestId, action, appUser) {
        try {
            console.log(`🔄 处理关联请求: ${requestId}, 操作: ${action}, 用户: ${appUser}`);
            
            // 验证请求存在且属于当前用户
            const request = await query(`
                SELECT * FROM link_requests 
                WHERE id = ? AND to_app_user = ? AND status = 'pending' AND expires_at > datetime('now')
            `, [requestId, appUser]);
            
            if (request.length === 0) {
                throw new Error('请求不存在、已过期或无权限处理');
            }
            
            const requestData = request[0];
            
            if (action === 'accept') {
                // 使用事务确保数据一致性
                return await transaction(async () => {
                    // 更新请求状态
                    await query(`
                        UPDATE link_requests 
                        SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `, [requestId]);
                    
                    // 创建关联关系
                    await query(`
                        INSERT INTO user_links (manager_app_user, linked_app_user, supervised_user_id, status)
                        VALUES (?, ?, ?, 'active')
                    `, [requestData.from_app_user, requestData.to_app_user, requestData.supervised_user_id]);
                    
                    // 更新被监管用户的关联状态
                    await query(`
                        UPDATE users 
                        SET supervised_app_user = ?, is_linked = 1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [requestData.to_app_user, requestData.supervised_user_id]);
                    
                    // 同步数据
                    await this.syncUserData(requestData.supervised_user_id, requestData.from_app_user, requestData.to_app_user);
                    
                    console.log(`✅ 关联请求已接受，开始数据同步`);
                    return { status: 'accepted', synced: true };
                });
                
            } else if (action === 'reject') {
                // 更新请求状态为拒绝
                await query(`
                    UPDATE link_requests 
                    SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [requestId]);
                
                console.log(`✅ 关联请求已拒绝`);
                return { status: 'rejected' };
                
            } else {
                throw new Error('无效的操作类型');
            }
            
        } catch (error) {
            console.error('❌ 处理关联请求失败:', error);
            throw error;
        }
    }
    
    // 同步用户数据
    static async syncUserData(supervisedUserId, fromAppUser, toAppUser) {
        try {
            console.log(`🔄 开始同步数据: 被监管用户${supervisedUserId}, ${fromAppUser} -> ${toAppUser}`);
            
            // 获取目标用户的设备ID（假设使用第一个设备）
            const toUserDevices = await query(`
                SELECT DISTINCT device_id FROM users WHERE app_user_id = ? LIMIT 1
            `, [toAppUser]);
            
            if (toUserDevices.length === 0) {
                // 如果目标用户没有设备记录，创建一个默认的被监管用户记录
                const supervisedUserData = await query('SELECT * FROM users WHERE id = ?', [supervisedUserId]);
                if (supervisedUserData.length > 0) {
                    const userData = supervisedUserData[0];
                    
                    // 为目标用户创建相同的被监管用户记录
                    const newUserResult = await query(`
                        INSERT INTO users (app_user_id, username, display_name, email, phone, gender, birthday, 
                                         avatar_color, timezone, device_id, supervised_app_user, is_linked)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        toAppUser, userData.username, userData.display_name, userData.email, userData.phone,
                        userData.gender, userData.birthday, userData.avatar_color, userData.timezone,
                        'default_device', toAppUser, true
                    ]);
                    
                    const newUserId = newUserResult.insertId;
                    console.log(`✅ 为目标用户创建被监管用户记录，ID: ${newUserId}`);
                    
                    // 同步TODO数据
                    await this.syncTodos(supervisedUserId, newUserId);
                    
                    // 同步Notes数据
                    await this.syncNotes(supervisedUserId, newUserId);
                }
            } else {
                // 如果目标用户已有设备记录，需要更复杂的同步逻辑
                console.log('⚠️  目标用户已有设备记录，需要实现更复杂的同步逻辑');
            }
            
            console.log(`✅ 数据同步完成`);
            
        } catch (error) {
            console.error('❌ 数据同步失败:', error);
            throw error;
        }
    }
    
    // 同步TODO数据
    static async syncTodos(fromUserId, toUserId) {
        try {
            const todos = await query('SELECT * FROM todos WHERE user_id = ? AND is_active = 1', [fromUserId]);
            
            for (const todo of todos) {
                await query(`
                    INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, 
                                     repeat_interval, start_date, end_date, cycle_type, cycle_duration, 
                                     cycle_unit, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    toUserId, todo.title, todo.description, todo.reminder_time, todo.priority,
                    todo.repeat_type, todo.repeat_interval, todo.start_date, todo.end_date,
                    todo.cycle_type, todo.cycle_duration, todo.cycle_unit, todo.sort_order
                ]);
            }
            
            console.log(`✅ 同步了 ${todos.length} 个TODO项目`);
        } catch (error) {
            console.error('❌ 同步TODO失败:', error);
            throw error;
        }
    }
    
    // 同步Notes数据
    static async syncNotes(fromUserId, toUserId) {
        try {
            const notes = await query('SELECT * FROM notes WHERE user_id = ?', [fromUserId]);
            
            for (const note of notes) {
                await query(`
                    INSERT INTO notes (user_id, title, description, precautions, ai_suggestions)
                    VALUES (?, ?, ?, ?, ?)
                `, [toUserId, note.title, note.description, note.precautions, note.ai_suggestions]);
            }
            
            console.log(`✅ 同步了 ${notes.length} 个Notes项目`);
        } catch (error) {
            console.error('❌ 同步Notes失败:', error);
            throw error;
        }
    }
    
    // 获取用户的关联关系
    static async getUserLinks(appUser) {
        try {
            // 获取作为管理员的关联关系
            const managerLinks = await query(`
                SELECT ul.*, u.username, u.display_name, u.avatar_color,
                       la.username as linked_username
                FROM user_links ul
                JOIN users u ON ul.supervised_user_id = u.id
                JOIN app_users la ON ul.linked_app_user = la.username
                WHERE ul.manager_app_user = ? AND ul.status = 'active'
                ORDER BY ul.created_at DESC
            `, [appUser]);
            
            // 获取作为被关联用户的关联关系
            const linkedLinks = await query(`
                SELECT ul.*, u.username, u.display_name, u.avatar_color,
                       ma.username as manager_username
                FROM user_links ul
                JOIN users u ON ul.supervised_user_id = u.id
                JOIN app_users ma ON ul.manager_app_user = ma.username
                WHERE ul.linked_app_user = ? AND ul.status = 'active'
                ORDER BY ul.created_at DESC
            `, [appUser]);
            
            return {
                asManager: managerLinks,
                asLinked: linkedLinks
            };
        } catch (error) {
            console.error('❌ 获取用户关联关系失败:', error);
            throw error;
        }
    }
    
    // 取消关联关系
    static async cancelLink(linkId, appUser) {
        try {
            console.log(`🔄 取消关联关系: ${linkId}, 用户: ${appUser}`);
            
            // 验证关联关系存在且用户有权限
            const link = await query(`
                SELECT * FROM user_links 
                WHERE id = ? AND (manager_app_user = ? OR linked_app_user = ?) AND status = 'active'
            `, [linkId, appUser, appUser]);
            
            if (link.length === 0) {
                throw new Error('关联关系不存在或无权限操作');
            }
            
            const linkData = link[0];
            
            // 使用事务确保数据一致性
            return await transaction(async () => {
                // 更新关联状态
                await query(`
                    UPDATE user_links 
                    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [linkId]);
                
                // 更新被监管用户的关联状态
                await query(`
                    UPDATE users 
                    SET supervised_app_user = NULL, is_linked = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [linkData.supervised_user_id]);
                
                console.log(`✅ 关联关系已取消`);
                return { status: 'cancelled', linkId };
            });
            
        } catch (error) {
            console.error('❌ 取消关联关系失败:', error);
            throw error;
        }
    }
    
    // 实时同步数据变更
    static async syncDataChange(operation, table, data, supervisedUserId) {
        try {
            console.log(`🔄 实时同步数据变更: ${operation} ${table} for user ${supervisedUserId}`);
            
            // 获取该被监管用户的所有关联关系
            const links = await query(`
                SELECT manager_app_user, linked_app_user FROM user_links 
                WHERE supervised_user_id = ? AND status = 'active'
            `, [supervisedUserId]);
            
            if (links.length === 0) {
                console.log('ℹ️  该用户没有关联关系，跳过同步');
                return;
            }
            
            // 为每个关联关系同步数据
            for (const link of links) {
                await this.performDataSync(operation, table, data, link.manager_app_user, link.linked_app_user, supervisedUserId);
            }
            
        } catch (error) {
            console.error('❌ 实时同步数据变更失败:', error);
            throw error;
        }
    }
    
    // 执行具体的数据同步
    static async performDataSync(operation, table, data, managerUser, linkedUser, supervisedUserId) {
        try {
            // 根据操作类型和表类型执行相应的同步逻辑
            // 这里需要根据具体的业务逻辑来实现
            console.log(`🔄 执行数据同步: ${operation} ${table} between ${managerUser} and ${linkedUser}`);
            
            // TODO: 实现具体的同步逻辑
            // 这将在后续的任务中详细实现
            
        } catch (error) {
            console.error('❌ 执行数据同步失败:', error);
            throw error;
        }
    }
    
    // 验证用户权限
    static async validateUserPermission(appUser, supervisedUserId) {
        try {
            // 检查用户是否是该被监管用户的管理员或关联用户
            const hasPermission = await query(`
                SELECT 1 FROM users u
                LEFT JOIN user_links ul ON u.id = ul.supervised_user_id
                WHERE u.id = ? AND (
                    u.app_user_id = ? OR 
                    (ul.manager_app_user = ? OR ul.linked_app_user = ?) AND ul.status = 'active'
                )
            `, [supervisedUserId, appUser, appUser, appUser]);
            
            return hasPermission.length > 0;
        } catch (error) {
            console.error('❌ 验证用户权限失败:', error);
            return false;
        }
    }
    
    // 清理过期请求
    static async cleanupExpiredRequests() {
        try {
            const result = await query(`
                UPDATE link_requests 
                SET status = 'expired', updated_at = CURRENT_TIMESTAMP 
                WHERE status = 'pending' AND expires_at <= datetime('now')
            `);
            
            if (result.affectedRows > 0) {
                console.log(`🧹 清理了 ${result.affectedRows} 个过期的关联请求`);
            }
            
            return result.affectedRows;
        } catch (error) {
            console.error('❌ 清理过期请求失败:', error);
            throw error;
        }
    }
}

module.exports = LinkService;