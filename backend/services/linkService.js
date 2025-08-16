// Link服务 - 用户关联功能核心逻辑
const { query, transaction } = require('../config/sqlite');

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

    // 创建关联请求（允许覆盖现有待处理请求）
    static async createRequestWithOverride(fromAppUser, toAppUser, supervisedUserId, message = '') {
        const ErrorHandlingService = require('./errorHandlingService');
        
        try {
            console.log(`📤 创建关联请求（允许覆盖）: ${fromAppUser} -> ${toAppUser} (被监管用户: ${supervisedUserId})`);
            
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
            
            let result;
            let isOverride = false;
            
            if (existingRequest.length > 0) {
                // 更新现有请求
                console.log(`🔄 更新现有邀请请求: ID ${existingRequest[0].id}`);
                await query(`
                    UPDATE link_requests 
                    SET message = ?, updated_at = CURRENT_TIMESTAMP, expires_at = datetime('now', '+7 days')
                    WHERE id = ?
                `, [message, existingRequest[0].id]);
                
                result = { id: existingRequest[0].id };
                isOverride = true;
            } else {
                // 创建新的关联请求
                console.log(`➕ 创建新的邀请请求`);
                const insertResult = await query(`
                    INSERT INTO link_requests (from_app_user, to_app_user, supervised_user_id, supervised_user_name, message)
                    VALUES (?, ?, ?, ?, ?)
                `, [fromAppUser, toAppUser, supervisedUserId, supervisedUser[0].display_name, message]);
                
                result = { id: insertResult.insertId };
                isOverride = false;
            }
            
            // 获取完整的请求信息
            const request = await query('SELECT * FROM link_requests WHERE id = ?', [result.id]);
            
            console.log(`✅ 关联请求${isOverride ? '更新' : '创建'}成功，ID: ${result.id}`);
            
            return {
                ...request[0],
                isOverride
            };
            
        } catch (error) {
            console.error('❌ 创建/更新关联请求失败:', error);
            
            // 使用错误处理服务
            const errorResult = await ErrorHandlingService.handleError(error, {
                operation: 'createRequestWithOverride',
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
                    
                    // 检查是否已存在相同的关联关系（可能已取消）
                    const existingLink = await query(`
                        SELECT id, status FROM user_links 
                        WHERE manager_app_user = ? AND linked_app_user = ? AND supervised_user_id = ?
                    `, [requestData.from_app_user, requestData.to_app_user, requestData.supervised_user_id]);
                    
                    if (existingLink.length > 0) {
                        // 更新现有关联关系状态为活跃
                        await query(`
                            UPDATE user_links 
                            SET status = 'active', updated_at = CURRENT_TIMESTAMP 
                            WHERE id = ?
                        `, [existingLink[0].id]);
                        console.log(`🔄 重新激活已存在的关联关系: ${existingLink[0].id}`);
                    } else {
                        // 创建新的关联关系
                        await query(`
                            INSERT INTO user_links (manager_app_user, linked_app_user, supervised_user_id, status)
                            VALUES (?, ?, ?, 'active')
                        `, [requestData.from_app_user, requestData.to_app_user, requestData.supervised_user_id]);
                        console.log(`➕ 创建新的关联关系`);
                    }
                    
                    // 更新被监管用户的关联状态
                    await query(`
                        UPDATE users 
                        SET supervised_app_user = ?, is_linked = 1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [requestData.to_app_user, requestData.supervised_user_id]);
                    
                    // 同步数据
                    await this.syncUserData(requestData.supervised_user_id, requestData.from_app_user, requestData.to_app_user);
                    
                    // 🔥 发送WebSocket通知给发起用户和接受用户
                    try {
                        const websocketService = require('./websocketService');
                        
                        if (websocketService) {
                            // 通知发起用户（管理员）
                            websocketService.broadcastToAppUser(requestData.from_app_user, {
                                type: 'LINK_ACCEPTED',
                                data: {
                                    acceptedBy: appUser,
                                    supervisedUserId: requestData.supervised_user_id,
                                    supervisedUserName: requestData.supervised_user_name,
                                    requestId: requestId,
                                    timestamp: Date.now(),
                                    syncMessage: `数据同步完成：${requestData.supervised_user_name} 的数据已以您的数据为准进行同步`
                                },
                                message: `${appUser} 接受了您的关联邀请，数据已同步`
                            });
                            
                            // 通知接受用户
                            websocketService.broadcastToAppUser(appUser, {
                                type: 'LINK_ESTABLISHED',
                                data: {
                                    linkedUser: requestData.from_app_user,
                                    supervisedUserId: requestData.supervised_user_id,
                                    supervisedUserName: requestData.supervised_user_name,
                                    requestId: requestId,
                                    timestamp: Date.now(),
                                    syncMessage: `数据同步提示：${requestData.supervised_user_name} 的数据已以 ${requestData.from_app_user} 的数据为准进行同步`
                                },
                                message: `关联已建立，数据已同步`
                            });
                            
                            console.log(`🔔 已通知关联双方: 关联建立和数据同步完成`);
                        }
                    } catch (notifyError) {
                        console.error('⚠️ 发送关联建立通知失败:', notifyError);
                        // 不影响主要流程
                    }
                    
                    console.log(`✅ 关联请求已接受，开始数据同步`);
                    return { 
                        status: 'accepted', 
                        synced: true,
                        fromUser: requestData.from_app_user,
                        toUser: appUser,
                        supervisedUserId: requestData.supervised_user_id
                    };
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
            
            // 获取原始被监管用户的数据
            const supervisedUserData = await query('SELECT * FROM users WHERE id = ?', [supervisedUserId]);
            if (supervisedUserData.length === 0) {
                throw new Error('被监管用户不存在');
            }
            
            const originalUser = supervisedUserData[0];
            
            // 检查目标用户是否已经有相同username的被监管用户
            let targetUserId = null;
            const existingTargetUser = await query(`
                SELECT id FROM users 
                WHERE app_user_id = ? AND username = ? AND is_active = 1
            `, [toAppUser, originalUser.username]);
            
            if (existingTargetUser.length > 0) {
                // 如果已存在，使用现有的用户ID
                targetUserId = existingTargetUser[0].id;
                console.log(`✅ 发现目标用户已有相同被监管用户: ${targetUserId}`);
            } else {
                // 如果不存在，创建新的被监管用户记录
                console.log(`📝 为目标用户创建新的被监管用户记录`);
                
                // 获取目标用户的实际设备ID
                let targetDeviceId = 'default_device'; // 默认值
                
                // 尝试从现有用户记录中获取设备ID
                const existingUserDevices = await query(`
                    SELECT DISTINCT device_id FROM users WHERE app_user_id = ? AND device_id IS NOT NULL LIMIT 1
                `, [toAppUser]);
                
                if (existingUserDevices.length > 0) {
                    targetDeviceId = existingUserDevices[0].device_id;
                    console.log(`📱 使用目标用户的现有设备ID: ${targetDeviceId}`);
                } else {
                    console.log(`📱 目标用户没有现有设备ID，使用默认值: ${targetDeviceId}`);
                }
                
                // 为目标用户创建相同的被监管用户记录
                const newUserResult = await query(`
                    INSERT INTO users (app_user_id, username, display_name, email, phone, gender, birthday, 
                                     avatar_color, timezone, device_id, supervised_app_user, is_linked)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    toAppUser, originalUser.username, originalUser.display_name, originalUser.email, originalUser.phone,
                    originalUser.gender, originalUser.birthday, originalUser.avatar_color, originalUser.timezone,
                    targetDeviceId, toAppUser, true
                ]);
                
                targetUserId = newUserResult.insertId;
                console.log(`✅ 为目标用户创建被监管用户记录，ID: ${targetUserId}`);
            }
            
            // 为目标用户也创建相应的关联记录（双向关联）
            console.log(`🔗 创建双向关联记录...`);
            
            // 检查是否已存在目标用户的关联记录
            const existingTargetLink = await query(`
                SELECT id FROM user_links 
                WHERE manager_app_user = ? AND linked_app_user = ? AND supervised_user_id = ?
            `, [toAppUser, fromAppUser, targetUserId]);
            
            if (existingTargetLink.length === 0) {
                // 创建反向关联记录
                await query(`
                    INSERT INTO user_links (manager_app_user, linked_app_user, supervised_user_id, status)
                    VALUES (?, ?, ?, 'active')
                `, [toAppUser, fromAppUser, targetUserId]);
                console.log(`✅ 创建反向关联记录: ${toAppUser} <-> ${fromAppUser} (用户${targetUserId})`);
            } else {
                // 如果存在但状态不是active，更新状态
                await query(`
                    UPDATE user_links 
                    SET status = 'active', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [existingTargetLink[0].id]);
                console.log(`🔄 重新激活反向关联记录: ${existingTargetLink[0].id}`);
            }
            
            // 无论是新创建还是已存在，都需要同步数据
            console.log(`🔄 开始同步Todo和Notes数据...`);
            
            // 同步TODO数据
            await this.syncTodos(supervisedUserId, targetUserId);
            
            // 同步Notes数据
            await this.syncNotes(supervisedUserId, targetUserId);
            
            console.log(`✅ 数据同步和双向关联创建完成`);
            
        } catch (error) {
            console.error('❌ 数据同步失败:', error);
            throw error;
        }
    }
    
    // 同步TODO数据
    static async syncTodos(fromUserId, toUserId) {
        try {
            // 清除目标用户的现有TODO（避免重复）
            await query('DELETE FROM todos WHERE user_id = ?', [toUserId]);
            // 🔥 同时清除完成记录
            await query('DELETE FROM todo_completions WHERE user_id = ?', [toUserId]);
            
            const todos = await query('SELECT * FROM todos WHERE user_id = ? AND is_active = 1', [fromUserId]);
            
            for (const todo of todos) {
                const result = await query(`
                    INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, 
                                     repeat_interval, start_date, end_date, cycle_type, cycle_duration, 
                                     cycle_unit, sort_order, is_completed_today, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    toUserId, todo.title, todo.description, todo.reminder_time, todo.priority,
                    todo.repeat_type, todo.repeat_interval, todo.start_date, todo.end_date,
                    todo.cycle_type, todo.cycle_duration, todo.cycle_unit, todo.sort_order,
                    todo.is_completed_today, todo.is_active, todo.created_at
                ]);
                
                const newTodoId = result.insertId;
                
                // 🔥 同步完成状态历史
                const completions = await query(`
                    SELECT completion_date, notes 
                    FROM todo_completions 
                    WHERE todo_id = ? AND user_id = ?
                `, [todo.id, fromUserId]);
                
                for (const completion of completions) {
                    await query(`
                        INSERT INTO todo_completions (todo_id, user_id, completion_date, notes)
                        VALUES (?, ?, ?, ?)
                    `, [newTodoId, toUserId, completion.completion_date, completion.notes || '']);
                }
                
                if (completions.length > 0) {
                    console.log(`  ✅ 同步了TODO "${todo.title}" 的 ${completions.length} 个完成记录`);
                }
            }
            
            console.log(`✅ 同步了 ${todos.length} 个TODO项目及其完成状态历史`);
        } catch (error) {
            console.error('❌ 同步TODO失败:', error);
            throw error;
        }
    }
    
    // 同步Notes数据
    static async syncNotes(fromUserId, toUserId) {
        try {
            // 清除目标用户的现有Notes（避免重复）
            await query('DELETE FROM notes WHERE user_id = ?', [toUserId]);
            
            const notes = await query('SELECT * FROM notes WHERE user_id = ?', [fromUserId]);
            
            for (const note of notes) {
                // 🔥 不同步AI建议，让每个用户有自己的AI建议
                await query(`
                    INSERT INTO notes (user_id, title, description, precautions, ai_suggestions, created_at, updated_at)
                    VALUES (?, ?, ?, ?, '', ?, ?)
                `, [toUserId, note.title, note.description, note.precautions, note.created_at, note.updated_at]);
            }
            
            console.log(`✅ 同步了 ${notes.length} 个Notes项目（不包含AI建议）`);
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

            // 找出所有相关的双向关联记录（基于两个app用户之间的关联）
            return await transaction(async () => {
                const managerUser = linkData.manager_app_user;
                const linkedUser = linkData.linked_app_user;
                
                console.log(`🔍 正在查找并取消 ${managerUser} 和 ${linkedUser} 之间的所有关联记录...`);

                // 🔥 修复：查找并取消两个用户之间的所有双向关联记录
                const allRelatedLinks = await query(`
                    SELECT * FROM user_links 
                    WHERE ((manager_app_user = ? AND linked_app_user = ?) OR (manager_app_user = ? AND linked_app_user = ?))
                    AND status = 'active'
                `, [managerUser, linkedUser, linkedUser, managerUser]);

                console.log(`🔍 找到需要取消的关联记录数量: ${allRelatedLinks.length}`);
                allRelatedLinks.forEach(link => {
                    console.log(`  - ID ${link.id}: ${link.manager_app_user} -> ${link.linked_app_user} (被监管用户: ${link.supervised_user_id})`);
                });

                // 取消所有相关的关联记录
                const cancelLinkResult = await query(`
                    UPDATE user_links 
                    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                    WHERE ((manager_app_user = ? AND linked_app_user = ?) OR (manager_app_user = ? AND linked_app_user = ?))
                    AND status = 'active'
                `, [managerUser, linkedUser, linkedUser, managerUser]);
                
                console.log(`✅ 取消关联记录影响行数: ${cancelLinkResult.changes}`);

                // 🔥 修复：更新所有相关被监管用户的状态
                const supervisedUserIds = allRelatedLinks.map(link => link.supervised_user_id);
                const uniqueSupervisedUserIds = [...new Set(supervisedUserIds)]; // 去重

                console.log(`🔍 需要更新的被监管用户IDs: [${uniqueSupervisedUserIds.join(', ')}]`);

                for (const supervisedUserId of uniqueSupervisedUserIds) {
                    const userUpdateResult = await query(`
                        UPDATE users 
                        SET supervised_app_user = NULL, is_linked = 0, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [supervisedUserId]);
                    console.log(`✅ 更新被监管用户${supervisedUserId}状态，影响行数: ${userUpdateResult.changes}`);
                }

                // 🔥 发送WebSocket实时通知给关联的另一方
                try {
                    const websocketService = require('./websocketService');
                    const targetUser = linkData.manager_app_user === appUser ? 
                                     linkData.linked_app_user : linkData.manager_app_user;
                    if (websocketService) {
                        websocketService.broadcastToAppUser(targetUser, {
                            type: 'LINK_CANCELLED',
                            data: {
                                cancelledBy: appUser,
                                supervisedUserIds: uniqueSupervisedUserIds, // 通知所有受影响的被监管用户
                                linkId: linkId,
                                timestamp: Date.now()
                            },
                            message: `${appUser} 已取消关联关系`
                        });
                        console.log(`🔔 已通知关联用户 ${targetUser}: 关联已取消，涉及${uniqueSupervisedUserIds.length}个被监管用户`);
                    }
                } catch (notifyError) {
                    console.error('⚠️ 发送取消关联通知失败:', notifyError);
                }

                console.log(`✅ 双向关联关系完全取消，共处理${allRelatedLinks.length}条关联记录，${uniqueSupervisedUserIds.length}个被监管用户`);
                return { 
                    status: 'cancelled', 
                    linkId, 
                    cancelledBy: appUser,
                    supervisedUserIds: uniqueSupervisedUserIds,
                    cancelledLinksCount: allRelatedLinks.length
                };
            });
            
        } catch (error) {
            console.error('❌ 取消关联关系失败:', error);
            throw error;
        }
    }
    
    // 直接创建关联关系（用于接受邀请时）
    static async createLinkDirectly(fromAppUser, toAppUser, supervisedUserId) {
        try {
            console.log(`🔗 直接创建关联关系: ${fromAppUser} <-> ${toAppUser} (被监管用户: ${supervisedUserId})`);
            
            // 验证被监管用户存在且属于发起用户
            const supervisedUser = await query(`
                SELECT id, username, display_name, app_user_id 
                FROM users 
                WHERE id = ? AND app_user_id = ? AND is_active = 1
            `, [supervisedUserId, fromAppUser]);
            
            if (supervisedUser.length === 0) {
                const error = new Error('被监管用户不存在或不属于发起用户');
                error.code = 'SUPERVISED_USER_NOT_FOUND';
                throw error;
            }
            
            // 检查是否已存在活跃的关联关系
            const existingLink = await query(`
                SELECT id FROM user_links 
                WHERE ((manager_app_user = ? AND linked_app_user = ?) OR 
                       (manager_app_user = ? AND linked_app_user = ?)) 
                AND supervised_user_id = ? AND status = 'active'
            `, [fromAppUser, toAppUser, toAppUser, fromAppUser, supervisedUserId]);
            
            if (existingLink.length > 0) {
                throw new Error('关联关系已存在');
            }
            
            // 在事务中创建关联关系
            return await transaction(async () => {
                // 创建关联关系
                const linkResult = await query(`
                    INSERT INTO user_links (
                        manager_app_user, linked_app_user, supervised_user_id, 
                        supervised_user_name, status, created_at
                    ) VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
                `, [fromAppUser, toAppUser, supervisedUserId, supervisedUser[0].display_name]);
                
                const linkId = linkResult.insertId;
                
                // 更新被监管用户的关联状态
                await query(`
                    UPDATE users 
                    SET supervised_app_user = ?, is_linked = 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [toAppUser, supervisedUserId]);
                
                console.log(`✅ 关联关系创建成功，ID: ${linkId}`);
                return { 
                    linkId, 
                    status: 'active',
                    managerUser: fromAppUser,
                    linkedUser: toAppUser,
                    supervisedUserId,
                    supervisedUserName: supervisedUser[0].display_name
                };
            });
            
        } catch (error) {
            console.error('❌ 直接创建关联关系失败:', error);
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
            console.log(`🔄 执行数据同步: ${operation} ${table} between ${managerUser} and ${linkedUser}`);
            
            // 获取关联的目标用户ID们
            const targetUserIds = await this.getLinkedUserIds(supervisedUserId, managerUser, linkedUser);
            
            if (targetUserIds.length === 0) {
                console.log('ℹ️ 没有找到需要同步的目标用户');
                return;
            }
            
            // 根据表类型和操作类型执行同步
            if (table === 'todos') {
                await this.syncTodoOperation(operation, data, targetUserIds);
            } else if (table === 'notes') {
                await this.syncNoteOperation(operation, data, targetUserIds);
            }
            
            console.log(`✅ 数据同步完成: ${operation} ${table}`);
            
        } catch (error) {
            console.error('❌ 执行数据同步失败:', error);
            throw error;
        }
    }
    
    // 获取需要同步的目标用户ID列表
    static async getLinkedUserIds(supervisedUserId, managerUser, linkedUser) {
        try {
            // 获取原始被监管用户信息
            const originalUser = await query('SELECT username, app_user_id FROM users WHERE id = ?', [supervisedUserId]);
            if (originalUser.length === 0) {
                return [];
            }
            
            const username = originalUser[0].username;
            const originalAppUser = originalUser[0].app_user_id;
            
            console.log(`🔍 查找关联用户: 原始用户ID ${supervisedUserId}, 用户名 "${username}", App用户 "${originalAppUser}"`);
            
            // 获取与当前用户有关联关系的所有app_user
            const linkedAppUsers = await query(`
                SELECT DISTINCT 
                    CASE 
                        WHEN ul.manager_app_user = ? THEN ul.linked_app_user
                        WHEN ul.linked_app_user = ? THEN ul.manager_app_user
                        ELSE NULL
                    END as target_app_user
                FROM user_links ul
                WHERE (ul.manager_app_user = ? OR ul.linked_app_user = ?) 
                AND ul.supervised_user_id = ? 
                AND ul.status = 'active'
            `, [originalAppUser, originalAppUser, originalAppUser, originalAppUser, supervisedUserId]);
            
            console.log(`🔗 找到关联的App用户:`, linkedAppUsers.map(u => u.target_app_user));
            
            if (linkedAppUsers.length === 0) {
                console.log('⚠️ 没有找到关联的App用户');
                return [];
            }
            
            // 获取这些关联app_user中相同username的被监管用户ID
            const targetUserIds = [];
            for (const linkedAppUser of linkedAppUsers) {
                if (!linkedAppUser.target_app_user) continue;
                
                const targetUsers = await query(`
                    SELECT id FROM users 
                    WHERE app_user_id = ? AND username = ? AND is_active = 1
                `, [linkedAppUser.target_app_user, username]);
                
                targetUsers.forEach(user => {
                    if (!targetUserIds.includes(user.id)) {
                        targetUserIds.push(user.id);
                    }
                });
                
                console.log(`👤 App用户 "${linkedAppUser.target_app_user}" 中找到用户:`, targetUsers.map(u => u.id));
            }
            
            console.log(`🎯 最终目标用户IDs:`, targetUserIds);
            return targetUserIds;
            
        } catch (error) {
            console.error('❌ 获取关联用户ID失败:', error);
            return [];
        }
    }
    
    // 同步Todo操作
    static async syncTodoOperation(operation, data, targetUserIds) {
        try {
            for (const targetUserId of targetUserIds) {
                switch (operation) {
                    case 'CREATE':
                        await query(`
                            INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, 
                                             repeat_interval, start_date, end_date, cycle_type, cycle_duration, 
                                             cycle_unit, sort_order, is_completed_today, is_active, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            targetUserId, 
                            data.title, 
                            data.description || '', 
                            data.reminder_time || 'all_day', 
                            typeof data.priority === 'number' ? 
                                (data.priority === 1 ? 'high' : data.priority === 2 ? 'medium' : 'low') : 
                                (data.priority || 'medium'),
                            data.repeat_type || 'none', 
                            data.repeat_interval || 1, 
                            data.start_date || new Date().toISOString().split('T')[0], 
                            data.end_date,
                            data.cycle_type || 'long_term', 
                            data.cycle_duration, 
                            data.cycle_unit || 'days', 
                            data.sort_order || 0,
                            data.is_completed_today || false, 
                            data.is_active !== false, 
                            data.created_at || new Date().toISOString()
                        ]);
                        break;
                        
                    case 'UPDATE':
                        // 根据title和description匹配（因为没有共享的唯一标识符）
                        await query(`
                            UPDATE todos 
                            SET title = ?, description = ?, reminder_time = ?, priority = ?, 
                                is_completed_today = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = ? AND title = ? AND description = ?
                        `, [
                            data.title, data.description, data.reminder_time, data.priority,
                            data.is_completed_today, targetUserId, data.original_title || data.title, 
                            data.original_description || data.description
                        ]);
                        break;
                        
                    case 'DELETE':
                        // 找到目标todo（基于标题匹配）
                        const targetTodosDelete = await query(`
                            SELECT id FROM todos 
                            WHERE user_id = ? AND title = ? AND is_active = 1
                            ORDER BY created_at DESC LIMIT 1
                        `, [targetUserId, data.title]);
                        
                        if (targetTodosDelete.length > 0) {
                            const targetTodoId = targetTodosDelete[0].id;
                            
                            // 根据删除类型处理
                            if (data.deletionType === 'single' && data.deletionDate) {
                                // 单个实例删除：插入删除记录
                                await query(`
                                    INSERT OR REPLACE INTO todo_deletions (todo_id, deletion_date, deletion_type)
                                    VALUES (?, ?, 'single')
                                `, [targetTodoId, data.deletionDate]);
                                
                                console.log(`✅ 已同步TODO单个实例删除到用户${targetUserId}, TODO ID ${targetTodoId}, 日期 ${data.deletionDate}`);
                            } else if (data.deletionType === 'from_date' && data.deletionDate) {
                                // 从指定日期开始删除：插入删除记录
                                await query(`
                                    INSERT OR REPLACE INTO todo_deletions (todo_id, deletion_date, deletion_type)
                                    VALUES (?, ?, 'from_date')
                                `, [targetTodoId, data.deletionDate]);
                                
                                console.log(`✅ 已同步TODO从日期删除到用户${targetUserId}, TODO ID ${targetTodoId}, 从日期 ${data.deletionDate}`);
                            } else {
                                // 全部删除：标记为不活跃
                                await query(`
                                    UPDATE todos SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                                    WHERE id = ?
                                `, [targetTodoId]);
                                
                                console.log(`✅ 已同步TODO完全删除到用户${targetUserId}, TODO ID ${targetTodoId}`);
                            }
                        } else {
                            console.log(`⚠️ 未找到要删除的目标TODO (用户${targetUserId}, 标题: "${data.title}")`);
                        }
                        break;
                        
                    case 'COMPLETE':
                        // 找到目标todo
                        const targetTodos = await query(`
                            SELECT id FROM todos 
                            WHERE user_id = ? AND title = ? AND is_active = 1
                            ORDER BY created_at DESC LIMIT 1
                        `, [targetUserId, data.title]);
                        
                        if (targetTodos.length > 0) {
                            const targetTodoId = targetTodos[0].id;
                            
                            // 插入完成记录到todo_completions表
                            await query(`
                                INSERT OR REPLACE INTO todo_completions (todo_id, user_id, completion_date, notes)
                                VALUES (?, ?, ?, ?)
                            `, [targetTodoId, targetUserId, data.date || new Date().toISOString().split('T')[0], data.notes || '']);
                            
                            // 更新todos表中的完成状态
                            await query(`
                                UPDATE todos 
                                SET is_completed_today = 1, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [targetTodoId]);
                            
                            console.log(`✅ 已同步TODO完成状态到用户${targetUserId}, TODO ID ${targetTodoId}`);
                        }
                        break;
                        
                    case 'UNCOMPLETE':
                        // 找到目标todo
                        const targetTodosUncomplete = await query(`
                            SELECT id FROM todos 
                            WHERE user_id = ? AND title = ? AND is_active = 1
                            ORDER BY created_at DESC LIMIT 1
                        `, [targetUserId, data.title]);
                        
                        if (targetTodosUncomplete.length > 0) {
                            const targetTodoId = targetTodosUncomplete[0].id;
                            
                            // 删除完成记录
                            await query(`
                                DELETE FROM todo_completions 
                                WHERE todo_id = ? AND completion_date = ?
                            `, [targetTodoId, data.date || new Date().toISOString().split('T')[0]]);
                            
                            // 更新todos表中的完成状态
                            await query(`
                                UPDATE todos 
                                SET is_completed_today = 0, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [targetTodoId]);
                            
                            console.log(`✅ 已同步TODO取消完成状态到用户${targetUserId}, TODO ID ${targetTodoId}`);
                        }
                        break;
                }
            }
        } catch (error) {
            console.error('❌ 同步Todo操作失败:', error);
            throw error;
        }
    }
    
    // 同步Note操作
    static async syncNoteOperation(operation, data, targetUserIds) {
        try {
            for (const targetUserId of targetUserIds) {
                switch (operation) {
                    case 'CREATE':
                        // 🔥 不同步AI建议，让每个用户有自己的AI建议
                        await query(`
                            INSERT INTO notes (user_id, title, description, precautions, ai_suggestions, created_at, updated_at)
                            VALUES (?, ?, ?, ?, '', ?, ?)
                        `, [
                            targetUserId, data.title, data.description, data.precautions, 
                            data.created_at || new Date(), data.updated_at || new Date()
                        ]);
                        break;
                        
                    case 'UPDATE':
                        // 使用original_title进行匹配，如果没有则使用title
                        const matchTitle = data.original_title || data.title;
                        console.log(`🔍 [Notes] 更新同步 - 查找标题: "${matchTitle}" -> 更新为: "${data.title}"`);
                        
                        // 🔥 不同步AI建议，保持各自用户的AI建议不变
                        const updateResult = await query(`
                            UPDATE notes 
                            SET title = ?, description = ?, precautions = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = ? AND title = ?
                        `, [
                            data.title, data.description, data.precautions,
                            targetUserId, matchTitle
                        ]);
                        
                        console.log(`✅ [Notes] 更新同步结果: 影响行数 ${updateResult.affectedRows}`);
                        break;
                        
                    case 'DELETE':
                        console.log(`🗑️ [Notes] 删除同步 - 查找标题: "${data.title}"`);
                        
                        const deleteResult = await query(`
                            DELETE FROM notes 
                            WHERE user_id = ? AND title = ?
                        `, [targetUserId, data.title]);
                        
                        console.log(`✅ [Notes] 删除同步结果: 影响行数 ${deleteResult.affectedRows}`);
                        break;
                }
            }
        } catch (error) {
            console.error('❌ 同步Note操作失败:', error);
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