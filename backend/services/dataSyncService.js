// 数据同步服务
const { query, transaction } = require('../config/sqlite');
const websocketService = require('./websocketService');

class DataSyncService {
    
    // 同步TODO操作
    static async syncTodoOperation(operation, todoData, originalUserId) {
        const ErrorHandlingService = require('./errorHandlingService');
        const LinkService = require('./linkService');
        
        try {
            console.log(`🔄 [DataSync] TODO操作: ${operation}, 用户: ${originalUserId}`);
            
            // 执行实时数据同步到关联用户的数据库
            await LinkService.syncDataChange(operation.toUpperCase(), 'todos', todoData, originalUserId);
            
            // 发送TODO_SYNC_UPDATE消息给关联用户，通知UI更新
            await this.broadcastTodoSyncNotification(operation, todoData, originalUserId);
            
            console.log(`✅ [DataSync] TODO同步完成: ${operation}`);
            
        } catch (error) {
            console.error('❌ [DataSync] TODO同步失败:', error);
            
            // 使用错误处理服务
            const errorResult = await ErrorHandlingService.handleError(error, {
                operation: 'syncTodoOperation',
                userId: originalUserId,
                todoOperation: operation,
                todoId: todoData.id
            });
            
            if (!errorResult.success) {
                throw error;
            }
        }
    }
    
    // 广播TODO同步通知
    static async broadcastTodoSyncNotification(operation, todoData, originalUserId) {
        try {
            // 获取关联关系
            const links = await query(`
                SELECT manager_app_user, linked_app_user
                FROM user_links ul
                JOIN users u ON ul.supervised_user_id = u.id
                WHERE u.id = ? AND ul.status = 'active'
            `, [originalUserId]);
            
            if (links.length === 0) {
                return;
            }
            
            // 获取操作用户的app_user_id
            const operatingUser = await query('SELECT app_user_id FROM users WHERE id = ?', [originalUserId]);
            if (operatingUser.length === 0) return;
            
            const operatingAppUser = operatingUser[0].app_user_id;
            
            // 向所有关联用户发送实时通知
            for (const link of links) {
                const targetAppUser = operatingAppUser === link.manager_app_user ? 
                                    link.linked_app_user : link.manager_app_user;
                
                // 发送WebSocket通知
                if (websocketService) {
                    websocketService.broadcastToAppUser(targetAppUser, {
                        type: 'TODO_SYNC_UPDATE',
                        operation: operation.toUpperCase(),
                        data: todoData,
                        sync: {
                            fromUser: operatingAppUser,
                            userId: originalUserId,
                            timestamp: Date.now()
                        }
                    });
                    
                    console.log(`🔔 [WebSocket] 已通知关联用户 ${targetAppUser}: TODO ${operation}`);
                }
            }
            
        } catch (error) {
            console.error('❌ 广播TODO同步通知失败:', error);
        }
    }
    
    // 同步Notes操作  
    static async syncNotesOperation(operation, noteData, originalUserId) {
        const ErrorHandlingService = require('./errorHandlingService');
        const LinkService = require('./linkService');
        
        try {
            console.log(`🔄 [DataSync] Notes操作: ${operation}, 用户: ${originalUserId}`);
            
            // 调用LinkService执行实时数据同步
            await LinkService.syncDataChange(operation.toUpperCase(), 'notes', noteData, originalUserId);
            
            // 发送WebSocket实时通知给关联用户
            await this.broadcastNotesSyncNotification(operation, noteData, originalUserId);
            
            console.log(`✅ [DataSync] Notes同步完成: ${operation}`);
            
        } catch (error) {
            console.error('❌ [DataSync] Notes同步失败:', error);
            
            // 使用错误处理服务
            const errorResult = await ErrorHandlingService.handleError(error, {
                operation: 'syncNotesOperation',
                userId: originalUserId,
                notesOperation: operation,
                noteId: noteData.id
            });
            
            if (!errorResult.success) {
                throw error;
            }
        }
    }
    
    // 广播Notes同步通知
    static async broadcastNotesSyncNotification(operation, noteData, originalUserId) {
        try {
            // 获取关联关系
            const links = await query(`
                SELECT manager_app_user, linked_app_user
                FROM user_links ul
                JOIN users u ON ul.supervised_user_id = u.id
                WHERE u.id = ? AND ul.status = 'active'
            `, [originalUserId]);
            
            if (links.length === 0) {
                return;
            }
            
            // 获取操作用户的app_user_id
            const operatingUser = await query('SELECT app_user_id FROM users WHERE id = ?', [originalUserId]);
            if (operatingUser.length === 0) return;
            
            const operatingAppUser = operatingUser[0].app_user_id;
            
            // 向所有关联用户发送实时通知
            for (const link of links) {
                const targetAppUser = operatingAppUser === link.manager_app_user ? 
                                    link.linked_app_user : link.manager_app_user;
                
                // 发送WebSocket通知
                if (websocketService) {
                    websocketService.broadcastToAppUser(targetAppUser, {
                        type: 'NOTES_SYNC_UPDATE',
                        operation: operation.toUpperCase(),
                        data: noteData,
                        sync: {
                            fromUser: operatingAppUser,
                            userId: originalUserId,
                            timestamp: Date.now()
                        }
                    });
                    
                    console.log(`🔔 [WebSocket] 已通知关联用户 ${targetAppUser}: Notes ${operation}`);
                }
            }
            
        } catch (error) {
            console.error('❌ 广播Notes同步通知失败:', error);
        }
    }
    
    // 执行具体的TODO同步
    static async performTodoSync(operation, todoData, link, originalUserId) {
        try {
            // 确定目标用户
            const originalAppUser = await query('SELECT app_user_id FROM users WHERE id = ?', [originalUserId]);
            if (originalAppUser.length === 0) return;
            
            const sourceAppUser = originalAppUser[0].app_user_id;
            const targetAppUser = sourceAppUser === link.manager_app_user ? link.linked_app_user : link.manager_app_user;
            
            // 获取目标用户的对应被监管用户ID
            const targetUser = await query(`
                SELECT id FROM users 
                WHERE app_user_id = ? AND supervised_app_user = ? AND is_linked = 1
            `, [targetAppUser, targetAppUser]);
            
            if (targetUser.length === 0) {
                console.log(`⚠️  目标用户 ${targetAppUser} 没有对应的被监管用户记录`);
                return;
            }
            
            const targetUserId = targetUser[0].id;
            
            switch (operation) {
                case 'create':
                    await this.syncTodoCreate(todoData, targetUserId);
                    break;
                case 'update':
                    await this.syncTodoUpdate(todoData, targetUserId);
                    break;
                case 'delete':
                    await this.syncTodoDelete(todoData, targetUserId);
                    break;
                case 'complete':
                    await this.syncTodoComplete(todoData, targetUserId);
                    break;
                case 'uncomplete':
                    await this.syncTodoUncomplete(todoData, targetUserId);
                    break;
            }
            
            console.log(`✅ TODO同步完成: ${operation} -> 用户 ${targetUserId}`);
            
        } catch (error) {
            console.error(`❌ 执行TODO同步失败 (${operation}):`, error);
            // 不抛出错误，避免影响其他同步操作
        }
    }
    
    // 同步TODO创建
    static async syncTodoCreate(todoData, targetUserId) {
        const { 
            title, 
            description = '', 
            reminder_time = 'all_day', 
            priority = 'medium', 
            repeat_type = 'none', 
            repeat_interval = 1, 
            start_date = new Date().toISOString().split('T')[0], 
            end_date = null, 
            cycle_type = 'long_term', 
            cycle_duration = null, 
            cycle_unit = 'days', 
            sort_order = 0 
        } = todoData;
        
        await query(`
            INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, 
                             repeat_interval, start_date, end_date, cycle_type, cycle_duration, 
                             cycle_unit, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [targetUserId, title, description, reminder_time, priority, repeat_type, 
            repeat_interval, start_date, end_date, cycle_type, cycle_duration, cycle_unit, sort_order]);
    }
    
    // 同步TODO更新
    static async syncTodoUpdate(todoData, targetUserId) {
        const { originalTodoId, updateData } = todoData;
        
        // 查找对应的TODO（基于标题和创建时间匹配）
        const targetTodos = await query(`
            SELECT id FROM todos 
            WHERE user_id = ? AND title = ? 
            ORDER BY created_at DESC LIMIT 1
        `, [targetUserId, updateData.title || '']);
        
        if (targetTodos.length > 0) {
            const targetTodoId = targetTodos[0].id;
            
            const fields = [];
            const values = [];
            
            Object.keys(updateData).forEach(key => {
                if (key !== 'id' && key !== 'user_id') {
                    fields.push(`${key} = ?`);
                    values.push(updateData[key]);
                }
            });
            
            if (fields.length > 0) {
                values.push(targetTodoId);
                await query(`UPDATE todos SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
            }
        }
    }
    
    // 同步TODO删除
    static async syncTodoDelete(todoData, targetUserId) {
        const { originalTodoId, deletionType, deletionDate } = todoData;
        
        // 查找对应的TODO
        const targetTodos = await query(`
            SELECT id FROM todos 
            WHERE user_id = ? AND title = ?
            ORDER BY created_at DESC LIMIT 1
        `, [targetUserId, todoData.title || '']);
        
        if (targetTodos.length > 0) {
            const targetTodoId = targetTodos[0].id;
            
            if (deletionType === 'single' && deletionDate) {
                await query(`
                    INSERT OR REPLACE INTO todo_deletions (todo_id, deletion_date, deletion_type)
                    VALUES (?, ?, 'single')
                `, [targetTodoId, deletionDate]);
            } else {
                await query('UPDATE todos SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [targetTodoId]);
            }
        }
    }
    
    // 同步TODO完成状态
    static async syncTodoComplete(todoData, targetUserId) {
        const { originalTodoId, date, notes } = todoData;
        
        const targetTodos = await query(`
            SELECT id FROM todos 
            WHERE user_id = ? AND title = ?
            ORDER BY created_at DESC LIMIT 1
        `, [targetUserId, todoData.title || '']);
        
        if (targetTodos.length > 0) {
            const targetTodoId = targetTodos[0].id;
            
            await query(`
                INSERT OR REPLACE INTO todo_completions (todo_id, user_id, completion_date, notes)
                VALUES (?, ?, ?, ?)
            `, [targetTodoId, targetUserId, date, notes || '']);
        }
    }
    
    // 同步TODO取消完成
    static async syncTodoUncomplete(todoData, targetUserId) {
        const { originalTodoId, date } = todoData;
        
        const targetTodos = await query(`
            SELECT id FROM todos 
            WHERE user_id = ? AND title = ?
            ORDER BY created_at DESC LIMIT 1
        `, [targetUserId, todoData.title || '']);
        
        if (targetTodos.length > 0) {
            const targetTodoId = targetTodos[0].id;
            
            await query('DELETE FROM todo_completions WHERE todo_id = ? AND completion_date = ?', [targetTodoId, date]);
        }
    }
    
    // 同步Notes操作
    static async syncNotesOperation(operation, notesData, originalUserId) {
        try {
            console.log(`🔄 同步Notes操作: ${operation}, 用户: ${originalUserId}`);
            
            // 获取该用户的所有关联关系
            const links = await query(`
                SELECT manager_app_user, linked_app_user, supervised_user_id
                FROM user_links 
                WHERE (
                    (manager_app_user IN (
                        SELECT app_user_id FROM users WHERE id = ?
                    )) OR 
                    (linked_app_user IN (
                        SELECT app_user_id FROM users WHERE id = ?
                    ))
                ) AND status = 'active'
            `, [originalUserId, originalUserId]);
            
            if (links.length === 0) {
                console.log('ℹ️  该用户没有关联关系，跳过同步');
                return;
            }
            
            // 为每个关联关系执行同步
            for (const link of links) {
                await this.performNotesSync(operation, notesData, link, originalUserId);
            }
            
            // 发送WebSocket通知
            this.broadcastDataSyncNotification('notes', operation, notesData, links);
            
        } catch (error) {
            console.error('❌ 同步Notes操作失败:', error);
            throw error;
        }
    }
    
    // 执行具体的Notes同步
    static async performNotesSync(operation, notesData, link, originalUserId) {
        try {
            // 确定目标用户
            const originalAppUser = await query('SELECT app_user_id FROM users WHERE id = ?', [originalUserId]);
            if (originalAppUser.length === 0) return;
            
            const sourceAppUser = originalAppUser[0].app_user_id;
            const targetAppUser = sourceAppUser === link.manager_app_user ? link.linked_app_user : link.manager_app_user;
            
            // 获取目标用户的对应被监管用户ID
            const targetUser = await query(`
                SELECT id FROM users 
                WHERE app_user_id = ? AND supervised_app_user = ? AND is_linked = 1
            `, [targetAppUser, targetAppUser]);
            
            if (targetUser.length === 0) {
                console.log(`⚠️  目标用户 ${targetAppUser} 没有对应的被监管用户记录`);
                return;
            }
            
            const targetUserId = targetUser[0].id;
            
            switch (operation) {
                case 'create':
                    await this.syncNotesCreate(notesData, targetUserId);
                    break;
                case 'update':
                    await this.syncNotesUpdate(notesData, targetUserId);
                    break;
                case 'delete':
                    await this.syncNotesDelete(notesData, targetUserId);
                    break;
            }
            
            console.log(`✅ Notes同步完成: ${operation} -> 用户 ${targetUserId}`);
            
        } catch (error) {
            console.error(`❌ 执行Notes同步失败 (${operation}):`, error);
        }
    }
    
    // 同步Notes创建
    static async syncNotesCreate(notesData, targetUserId) {
        const { title, description, precautions, ai_suggestions } = notesData;
        
        await query(`
            INSERT INTO notes (user_id, title, description, precautions, ai_suggestions)
            VALUES (?, ?, ?, ?, ?)
        `, [targetUserId, title, description, precautions || '', ai_suggestions || '']);
    }
    
    // 同步Notes更新
    static async syncNotesUpdate(notesData, targetUserId) {
        const { originalNoteId, updateData } = notesData;
        
        // 查找对应的Note
        const targetNotes = await query(`
            SELECT id FROM notes 
            WHERE user_id = ? AND title = ?
            ORDER BY created_at DESC LIMIT 1
        `, [targetUserId, updateData.title || '']);
        
        if (targetNotes.length > 0) {
            const targetNoteId = targetNotes[0].id;
            
            const fields = [];
            const values = [];
            
            Object.keys(updateData).forEach(key => {
                if (key !== 'id' && key !== 'user_id') {
                    fields.push(`${key} = ?`);
                    values.push(updateData[key]);
                }
            });
            
            if (fields.length > 0) {
                values.push(targetNoteId);
                await query(`UPDATE notes SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
            }
        }
    }
    
    // 同步Notes删除
    static async syncNotesDelete(notesData, targetUserId) {
        const { originalNoteId, title } = notesData;
        
        // 查找对应的Note
        const targetNotes = await query(`
            SELECT id FROM notes 
            WHERE user_id = ? AND title = ?
            ORDER BY created_at DESC LIMIT 1
        `, [targetUserId, title || '']);
        
        if (targetNotes.length > 0) {
            const targetNoteId = targetNotes[0].id;
            await query('DELETE FROM notes WHERE id = ?', [targetNoteId]);
        }
    }
    
    // 广播数据同步通知
    static broadcastDataSyncNotification(table, operation, data, links) {
        try {
            // 收集所有相关用户
            const affectedUsers = new Set();
            
            links.forEach(link => {
                affectedUsers.add(link.manager_app_user);
                affectedUsers.add(link.linked_app_user);
            });
            
            // 向所有相关用户发送同步通知
            affectedUsers.forEach(appUser => {
                websocketService.sendLinkNotificationToUser(appUser, {
                    type: 'DATA_SYNC_UPDATE',
                    data: {
                        table,
                        operation,
                        data: {
                            title: data.title,
                            id: data.id
                        }
                    }
                });
            });
            
            console.log(`📡 向 ${affectedUsers.size} 个用户发送数据同步通知`);
            
        } catch (error) {
            console.error('❌ 广播数据同步通知失败:', error);
        }
    }
    
    // 处理数据冲突
    static async resolveDataConflict(table, localData, remoteData) {
        try {
            console.log(`🔄 解决数据冲突: ${table}`);
            
            // 基于时间戳的冲突解决策略
            const localTime = new Date(localData.updated_at || localData.created_at);
            const remoteTime = new Date(remoteData.updated_at || remoteData.created_at);
            
            if (remoteTime > localTime) {
                console.log('✅ 使用远程数据（更新）');
                return remoteData;
            } else {
                console.log('✅ 保留本地数据（更新）');
                return localData;
            }
            
        } catch (error) {
            console.error('❌ 解决数据冲突失败:', error);
            // 默认返回本地数据
            return localData;
        }
    }
    
    // 验证数据完整性
    static async validateDataIntegrity(userId) {
        try {
            console.log(`🔍 验证用户 ${userId} 的数据完整性...`);
            
            // 检查TODO数据完整性
            const todos = await query('SELECT COUNT(*) as count FROM todos WHERE user_id = ? AND is_active = 1', [userId]);
            const todoCompletions = await query(`
                SELECT COUNT(*) as count FROM todo_completions tc
                JOIN todos t ON tc.todo_id = t.id
                WHERE t.user_id = ?
            `, [userId]);
            
            // 检查Notes数据完整性
            const notes = await query('SELECT COUNT(*) as count FROM notes WHERE user_id = ?', [userId]);
            
            console.log(`✅ 数据完整性验证完成: TODO ${todos[0].count} 条, 完成记录 ${todoCompletions[0].count} 条, Notes ${notes[0].count} 条`);
            
            return {
                todos: todos[0].count,
                todoCompletions: todoCompletions[0].count,
                notes: notes[0].count
            };
            
        } catch (error) {
            console.error('❌ 验证数据完整性失败:', error);
            throw error;
        }
    }
    
    // 同步队列处理（用于处理失败的同步操作）
    static async processSyncQueue() {
        try {
            console.log('🔄 处理同步队列...');
            
            // 这里可以实现一个同步队列，存储失败的同步操作
            // 并定期重试
            
            // 暂时返回成功
            return true;
            
        } catch (error) {
            console.error('❌ 处理同步队列失败:', error);
            return false;
        }
    }
    
    // 添加到同步队列
    static async addToSyncQueue(operationType, data, errorMessage = null) {
        try {
            await query(`
                INSERT INTO sync_queue (operation_type, data, status, error_message)
                VALUES (?, ?, 'failed', ?)
            `, [operationType, JSON.stringify(data), errorMessage]);
            
            console.log(`📝 同步操作已加入队列: ${operationType}`);
            
        } catch (error) {
            console.error('❌ 添加到同步队列失败:', error);
        }
    }
    
    // 处理同步队列
    static async processSyncQueue() {
        try {
            console.log('🔄 处理同步队列...');
            
            // 获取待重试的同步操作
            const pendingSyncs = await query(`
                SELECT * FROM sync_queue 
                WHERE status = 'failed' AND retry_count < max_retries
                ORDER BY priority DESC, created_at ASC
                LIMIT 10
            `);
            
            let processedCount = 0;
            let successCount = 0;
            
            for (const sync of pendingSyncs) {
                try {
                    processedCount++;
                    
                    // 更新重试次数
                    await query(`
                        UPDATE sync_queue 
                        SET retry_count = retry_count + 1, last_retry_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [sync.id]);
                    
                    // 解析数据
                    const syncData = JSON.parse(sync.data);
                    
                    // 根据操作类型执行相应的同步
                    switch (sync.operation_type) {
                        case 'todo_sync':
                            await this.performTodoSync(
                                syncData.operation, 
                                syncData.todoData, 
                                syncData.link, 
                                syncData.originalUserId
                            );
                            break;
                            
                        case 'notes_sync':
                            await this.performNotesSync(
                                syncData.operation, 
                                syncData.notesData, 
                                syncData.link, 
                                syncData.originalUserId
                            );
                            break;
                            
                        default:
                            throw new Error(`未知的同步操作类型: ${sync.operation_type}`);
                    }
                    
                    // 标记为成功
                    await query(`
                        UPDATE sync_queue 
                        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [sync.id]);
                    
                    successCount++;
                    console.log(`✅ 同步队列项目处理成功: ${sync.id}`);
                    
                } catch (retryError) {
                    console.error(`❌ 同步队列项目重试失败: ${sync.id}`, retryError);
                    
                    // 更新错误信息
                    await query(`
                        UPDATE sync_queue 
                        SET error_message = ?
                        WHERE id = ?
                    `, [retryError.message, sync.id]);
                    
                    // 如果达到最大重试次数，标记为永久失败
                    if (sync.retry_count + 1 >= sync.max_retries) {
                        await query(`
                            UPDATE sync_queue 
                            SET status = 'permanently_failed'
                            WHERE id = ?
                        `, [sync.id]);
                        
                        console.error(`💀 同步队列项目永久失败: ${sync.id}`);
                    }
                }
            }
            
            console.log(`✅ 同步队列处理完成: 处理 ${processedCount} 项，成功 ${successCount} 项`);
            
            return {
                processed: processedCount,
                succeeded: successCount,
                failed: processedCount - successCount
            };
            
        } catch (error) {
            console.error('❌ 处理同步队列失败:', error);
            return { processed: 0, succeeded: 0, failed: 0 };
        }
    }
    
    // 清理已完成的同步队列项目
    static async cleanupSyncQueue(daysToKeep = 7) {
        try {
            const result = await query(`
                DELETE FROM sync_queue 
                WHERE status IN ('completed', 'permanently_failed') 
                AND created_at < datetime('now', '-${daysToKeep} days')
            `);
            
            console.log(`🧹 清理了 ${result.affectedRows} 个旧的同步队列项目`);
            return result.affectedRows;
            
        } catch (error) {
            console.error('❌ 清理同步队列失败:', error);
            return 0;
        }
    }
    
    // 获取同步统计信息
    static async getSyncStats() {
        try {
            const activeLinks = await query('SELECT COUNT(*) as count FROM user_links WHERE status = "active"');
            const totalSyncs = await query(`
                SELECT COUNT(*) as count FROM (
                    SELECT user_id FROM todos WHERE user_id IN (
                        SELECT id FROM users WHERE is_linked = 1
                    )
                    UNION ALL
                    SELECT user_id FROM notes WHERE user_id IN (
                        SELECT id FROM users WHERE is_linked = 1
                    )
                ) as synced_data
            `);
            
            // 获取同步队列统计
            const queueStats = await query(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM sync_queue 
                GROUP BY status
            `);
            
            const queueStatsMap = {};
            queueStats.forEach(stat => {
                queueStatsMap[stat.status] = stat.count;
            });
            
            return {
                activeLinks: activeLinks[0].count,
                totalSyncedItems: totalSyncs[0].count,
                queueStats: queueStatsMap,
                lastSyncTime: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ 获取同步统计失败:', error);
            return null;
        }
    }
}

module.exports = DataSyncService;