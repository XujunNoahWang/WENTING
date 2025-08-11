// WebSocket服务 - 实时通信管理
const WebSocket = require('ws');
const Todo = require('../models/Todo');
const Note = require('../models/Note');
const User = require('../models/User');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.connections = new Map(); // deviceId -> { ws, userId, appUserId, lastActive }
        this.userConnections = new Map(); // userId -> Set of deviceIds
        this.appUserConnections = new Map(); // appUserId -> Set of deviceIds
    }

    // 初始化WebSocket服务器
    init(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws'
        });

        this.wss.on('connection', (ws, req) => {
            console.log('🔌 新的WebSocket连接');
            
            // 连接建立时的处理
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            // 消息处理
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleMessage(ws, message);
                } catch (error) {
                    console.error('❌ WebSocket消息处理失败:', error);
                    this.sendError(ws, 'MESSAGE_PARSE_ERROR', error.message);
                }
            });

            // 连接关闭处理
            ws.on('close', () => {
                console.log('🔌 WebSocket连接关闭');
                this.removeConnection(ws);
            });

            // 错误处理
            ws.on('error', (error) => {
                console.error('❌ WebSocket连接错误:', error);
                this.removeConnection(ws);
            });
        });

        // 心跳检测 - 每30秒检查一次
        const heartbeat = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    console.log('💔 检测到死连接，正在关闭...');
                    this.removeConnection(ws);
                    return ws.terminate();
                }
                
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        this.wss.on('close', () => {
            clearInterval(heartbeat);
        });

        console.log('✅ WebSocket服务器初始化完成');
    }

    // 处理WebSocket消息
    async handleMessage(ws, message) {
        const { type, deviceId, userId, appUserId, data, timestamp } = message;
        
        console.log('📨 收到WebSocket消息:', { type, deviceId, userId, appUserId });

        // 注册连接
        if (deviceId && (userId || appUserId)) {
            console.log(`📝 [WebSocket] 注册连接: deviceId=${deviceId}, userId=${userId}, appUserId=${appUserId}`);
            this.registerConnection(ws, deviceId, userId, appUserId);
        } else {
            console.log(`⚠️ [WebSocket] 连接信息不完整: deviceId=${deviceId}, userId=${userId}, appUserId=${appUserId}`);
        }

        try {
            let response;

            switch (type) {
                // TODO相关操作
                case 'TODO_GET_TODAY':
                    response = await this.handleTodoGetToday(userId);
                    break;
                case 'TODO_GET_BY_DATE':
                    response = await this.handleTodoGetByDate(userId, data.date);
                    break;
                case 'TODO_CREATE':
                    response = await this.handleTodoCreate(data);
                    break;
                case 'TODO_UPDATE':
                    response = await this.handleTodoUpdate(data.todoId, data.updateData);
                    break;
                case 'TODO_DELETE':
                    response = await this.handleTodoDelete(data.todoId, data.deletionType, data.deletionDate);
                    break;
                case 'TODO_COMPLETE':
                    response = await this.handleTodoComplete(data.todoId, data.userId, data.date);
                    break;
                case 'TODO_UNCOMPLETE':
                    response = await this.handleTodoUncomplete(data.todoId, data.date, data.userId);
                    break;

                // Notes相关操作
                case 'NOTES_GET_BY_USER':
                    response = await this.handleNotesGetByUser(userId);
                    break;
                case 'NOTES_CREATE':
                    response = await this.handleNotesCreate(data);
                    break;
                case 'NOTES_UPDATE':
                    response = await this.handleNotesUpdate(data.noteId, data.updateData);
                    break;
                case 'NOTES_DELETE':
                    response = await this.handleNotesDelete(data.noteId);
                    break;
                case 'NOTES_AI_SUGGESTIONS':
                    response = await this.handleNotesAISuggestions(data.noteId, data.userLocation, data.weatherData);
                    break;

                // Link相关操作
                case 'LINK_CHECK_STATUS':
                    response = await this.handleLinkCheckStatus(data.appUser);
                    break;
                case 'LINK_CREATE_REQUEST':
                    response = await this.handleLinkCreateRequest(data);
                    break;
                case 'LINK_GET_PENDING_REQUESTS':
                    response = await this.handleLinkGetPendingRequests(userId);
                    break;
                case 'LINK_HANDLE_REQUEST':
                    response = await this.handleLinkHandleRequest(data);
                    break;
                case 'LINK_GET_USER_LINKS':
                    response = await this.handleLinkGetUserLinks(userId);
                    break;
                case 'LINK_SEND_INVITATION':
                    response = await this.handleLinkSendInvitation(data, deviceId);
                    break;
                case 'LINK_ACCEPT_INVITATION':
                    response = await this.handleLinkAcceptInvitation(data, deviceId);
                    break;
                case 'LINK_REJECT_INVITATION':
                    response = await this.handleLinkRejectInvitation(data, deviceId);
                    break;
                case 'LINK_CANCEL':
                    response = await this.handleLinkCancel(data, deviceId);
                    break;
                    
                // 在线状态检测和关联邀请
                case 'LINK_CHECK_USER_ONLINE':
                    response = await this.handleCheckUserOnline(data.appUserId);
                    break;
                case 'LINK_SEND_INVITATION':
                    response = await this.handleSendLinkInvitation(data);
                    break;
                case 'LINK_INVITATION_RESPONSE':
                    response = await this.handleLinkInvitationResponse(data);
                    break;

                // 连接管理
                case 'USER_REGISTRATION':
                    response = await this.handleUserRegistration(deviceId, userId, appUserId);
                    break;
                case 'PING':
                    response = await this.handlePing(userId, appUserId);
                    break;

                default:
                    throw new Error(`未知的消息类型: ${type}`);
            }

            // 发送响应
            this.sendMessage(ws, {
                type: `${type}_RESPONSE`,
                success: true,
                data: response,
                timestamp: Date.now()
            });

            // 如果是修改操作，广播给该用户的其他设备
            if (this.isModifyOperation(type)) {
                this.broadcastToUserDevices(userId, deviceId, {
                    type: `${type}_BROADCAST`,
                    success: true,
                    data: response,
                    timestamp: Date.now()
                });
                
                // 如果是TODO或Notes修改操作，也要广播给关联用户
                if (this.isDataModifyOperation(type) && userId) {
                    const tableMap = {
                        'TODO_CREATE': 'todos',
                        'TODO_UPDATE': 'todos', 
                        'TODO_DELETE': 'todos',
                        'TODO_COMPLETE': 'todos',
                        'TODO_UNCOMPLETE': 'todos',
                        'NOTES_CREATE': 'notes',
                        'NOTES_UPDATE': 'notes',
                        'NOTES_DELETE': 'notes'
                    };
                    
                    const table = tableMap[type];
                    if (table) {
                        this.broadcastDataSyncToLinkedUsers(userId, type, table, response);
                    }
                }
            }

        } catch (error) {
            console.error(`❌ 处理${type}操作失败:`, error);
            console.error('错误详情:', error.stack);
            this.sendError(ws, type, error.message);
        }
    }

    // TODO操作处理函数
    async handleTodoGetToday(userId) {
        const today = new Date().toISOString().split('T')[0];
        const todos = await Todo.findByUserIdAndDate(userId, today);
        return { todos, date: today };
    }

    async handleTodoGetByDate(userId, date) {
        const todos = await Todo.findByUserIdAndDate(userId, date);
        return { todos, date };
    }

    async handleTodoCreate(todoData) {
        const todo = await Todo.create(todoData);
        
        // 🔥 关键修复：触发同步逻辑
        try {
            const DataSyncService = require('./dataSyncService');
            await DataSyncService.syncTodoOperation('create', todo, todo.user_id);
            console.log('✅ [WebSocket] TODO创建同步完成');
        } catch (syncError) {
            console.error('⚠️ [WebSocket] TODO创建同步失败，但创建成功:', syncError);
        }
        
        return { todo };
    }

    async handleTodoUpdate(todoId, updateData) {
        const todo = await Todo.updateById(todoId, updateData);
        
        // 🔥 关键修复：触发同步逻辑
        try {
            const DataSyncService = require('./dataSyncService');
            await DataSyncService.syncTodoOperation('update', {
                originalTodoId: todoId,
                updateData: todo,
                title: todo.title
            }, todo.user_id);
            console.log('✅ [WebSocket] TODO更新同步完成');
        } catch (syncError) {
            console.error('⚠️ [WebSocket] TODO更新同步失败，但更新成功:', syncError);
        }
        
        return { todo };
    }

    async handleTodoDelete(todoId, deletionType, deletionDate) {
        // 先获取todo信息用于同步
        const { query } = require('../config/sqlite');
        const todo = await query('SELECT title, user_id FROM todos WHERE id = ?', [todoId]);
        
        const success = await Todo.deleteById(todoId, deletionType, deletionDate);
        
        // 🔥 关键修复：触发同步逻辑
        if (success && todo.length > 0) {
            try {
                const DataSyncService = require('./dataSyncService');
                await DataSyncService.syncTodoOperation('delete', {
                    originalTodoId: todoId,
                    deletionType: deletionType,
                    deletionDate: deletionDate,
                    title: todo[0].title
                }, todo[0].user_id);
                console.log('✅ [WebSocket] TODO删除同步完成');
            } catch (syncError) {
                console.error('⚠️ [WebSocket] TODO删除同步失败，但删除成功:', syncError);
            }
        }
        
        return { success, todoId, deletionType };
    }

    async handleTodoComplete(todoId, userId, date) {
        // 先获取todo信息用于同步
        const { query } = require('../config/sqlite');
        const todo = await query('SELECT title FROM todos WHERE id = ?', [todoId]);
        
        await Todo.markCompleted(todoId, userId, date);
        
        // 同步到关联用户
        if (todo.length > 0) {
            try {
                const DataSyncService = require('./dataSyncService');
                await DataSyncService.syncTodoOperation('complete', {
                    originalTodoId: todoId,
                    date: date,
                    notes: '',
                    title: todo[0].title
                }, userId);
                console.log(`✅ [WebSocket] TODO完成同步已触发: ${todo[0].title}`);
            } catch (syncError) {
                console.error('⚠️ [WebSocket] TODO完成同步失败:', syncError);
            }
        }
        
        return { todoId, completed: true, date };
    }

    async handleTodoUncomplete(todoId, date, userId) {
        // 先获取todo信息用于同步
        const { query } = require('../config/sqlite');
        const todo = await query('SELECT title FROM todos WHERE id = ?', [todoId]);
        
        const success = await Todo.markUncompleted(todoId, date);
        
        // 同步到关联用户
        if (todo.length > 0) {
            try {
                const DataSyncService = require('./dataSyncService');
                await DataSyncService.syncTodoOperation('uncomplete', {
                    originalTodoId: todoId,
                    date: date,
                    notes: '',
                    title: todo[0].title
                }, userId);
                console.log(`✅ [WebSocket] TODO取消完成同步已触发: ${todo[0].title}`);
            } catch (syncError) {
                console.error('⚠️ [WebSocket] TODO取消完成同步失败:', syncError);
            }
        }
        
        return { todoId, completed: false, date, success, userId };
    }

    // Notes操作处理函数
    async handleNotesGetByUser(userId) {
        const notes = await Note.findByUserId(userId);
        return { notes };
    }

    async handleNotesCreate(noteData) {
        const note = await Note.create(noteData);
        return { note };
    }

    async handleNotesUpdate(noteId, updateData) {
        const note = await Note.updateById(noteId, updateData);
        return { note };
    }

    async handleNotesDelete(noteId) {
        const success = await Note.deleteById(noteId);
        return { noteId, success };
    }

    async handleNotesAISuggestions(noteId, userLocation, weatherData) {
        // 这里需要调用现有的AI服务
        const aiService = require('./aiService');
        const note = await Note.findById(noteId);
        const suggestions = await aiService.generateSuggestions(note, userLocation, weatherData);
        return { noteId, suggestions };
    }

    // 连接管理
    registerConnection(ws, deviceId, userId, appUserId) {
        // 如果该设备已有连接，先关闭旧连接
        if (this.connections.has(deviceId)) {
            const oldConnection = this.connections.get(deviceId);
            if (oldConnection.ws !== ws && oldConnection.ws.readyState === WebSocket.OPEN) {
                oldConnection.ws.close();
            }
        }

        // 注册新连接
        this.connections.set(deviceId, {
            ws,
            userId,
            appUserId,
            lastActive: Date.now()
        });

        // 维护被监管用户连接映射
        if (userId) {
            if (!this.userConnections.has(userId)) {
                this.userConnections.set(userId, new Set());
            }
            this.userConnections.get(userId).add(deviceId);
        }

        // 维护注册用户连接映射
        if (appUserId) {
            if (!this.appUserConnections.has(appUserId)) {
                this.appUserConnections.set(appUserId, new Set());
            }
            this.appUserConnections.get(appUserId).add(deviceId);
        }

        // 在WebSocket对象上保存信息，便于清理时使用
        ws.deviceId = deviceId;
        ws.userId = userId;
        ws.appUserId = appUserId;

        console.log(`✅ 设备 ${deviceId} (用户 ${userId}, app用户 ${appUserId}) 连接已注册`);
        console.log(`📊 当前活跃连接数: ${this.connections.size}`);
    }

    removeConnection(ws) {
        if (ws.deviceId) {
            this.connections.delete(ws.deviceId);
            
            // 从被监管用户连接映射中移除
            if (ws.userId && this.userConnections.has(ws.userId)) {
                this.userConnections.get(ws.userId).delete(ws.deviceId);
                // 如果用户没有任何设备连接，清理映射
                if (this.userConnections.get(ws.userId).size === 0) {
                    this.userConnections.delete(ws.userId);
                }
            }
            
            // 从注册用户连接映射中移除
            if (ws.appUserId && this.appUserConnections.has(ws.appUserId)) {
                this.appUserConnections.get(ws.appUserId).delete(ws.deviceId);
                // 如果app用户没有任何设备连接，清理映射
                if (this.appUserConnections.get(ws.appUserId).size === 0) {
                    this.appUserConnections.delete(ws.appUserId);
                }
            }
            
            console.log(`🗑️ 设备 ${ws.deviceId} 连接已清理`);
            console.log(`📊 当前活跃连接数: ${this.connections.size}`);
        }
    }

    // 广播给用户的其他设备
    broadcastToUserDevices(userId, excludeDeviceId, message) {
        if (this.userConnections.has(userId)) {
            const deviceIds = this.userConnections.get(userId);
            let broadcastCount = 0;

            deviceIds.forEach(deviceId => {
                if (deviceId !== excludeDeviceId) {
                    const connection = this.connections.get(deviceId);
                    if (connection && connection.ws.readyState === WebSocket.OPEN) {
                        this.sendMessage(connection.ws, message);
                        broadcastCount++;
                    }
                }
            });

            if (broadcastCount > 0) {
                console.log(`📡 已向用户 ${userId} 的 ${broadcastCount} 个其他设备广播消息`);
            }
        }
    }

    // 广播给指定app用户的所有设备
    broadcastToAppUser(appUserId, message) {
        if (this.appUserConnections.has(appUserId)) {
            const deviceIds = this.appUserConnections.get(appUserId);
            let broadcastCount = 0;

            deviceIds.forEach(deviceId => {
                const connection = this.connections.get(deviceId);
                if (connection && connection.ws.readyState === WebSocket.OPEN) {
                    this.sendMessage(connection.ws, message);
                    broadcastCount++;
                }
            });

            if (broadcastCount > 0) {
                console.log(`📡 已向app用户 ${appUserId} 的 ${broadcastCount} 个设备广播消息`);
            }
        } else {
            console.log(`⚠️ app用户 ${appUserId} 当前没有活跃连接`);
        }
    }

    // 发送消息
    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    // 发送错误消息
    sendError(ws, type, message) {
        this.sendMessage(ws, {
            type: `${type}_ERROR`,
            success: false,
            error: message,
            timestamp: Date.now()
        });
    }

    // Link操作处理函数
    async handleLinkCreateRequest(data) {
        const LinkService = require('./linkService');
        const { fromAppUser, toAppUser, supervisedUserId, message } = data;
        
        const request = await LinkService.createRequest(fromAppUser, toAppUser, supervisedUserId, message);
        
        // 向目标用户发送实时通知
        this.sendLinkNotificationToUser(toAppUser, {
            type: 'LINK_REQUEST_RECEIVED',
            data: {
                requestId: request.id,
                fromUser: fromAppUser,
                supervisedUserName: request.supervised_user_name,
                message: request.message,
                expiresAt: request.expires_at
            }
        });
        
        return { request };
    }

    async handleLinkGetPendingRequests(appUser) {
        const LinkService = require('./linkService');
        const requests = await LinkService.getPendingRequests(appUser);
        return { requests };
    }

    async handleLinkHandleRequest(data) {
        const LinkService = require('./linkService');
        const { requestId, action, appUser } = data;
        
        // 获取请求详情用于通知
        const { query } = require('../config/sqlite');
        const requestDetails = await query('SELECT * FROM link_requests WHERE id = ?', [requestId]);
        
        const result = await LinkService.handleRequest(requestId, action, appUser);
        
        if (requestDetails.length > 0) {
            const request = requestDetails[0];
            
            // 向发起请求的用户发送状态更新通知
            this.sendLinkNotificationToUser(request.from_app_user, {
                type: 'LINK_REQUEST_RESPONSE',
                data: {
                    requestId,
                    action,
                    supervisedUserName: request.supervised_user_name,
                    respondedBy: appUser,
                    result
                }
            });
            
            // 如果接受了请求，向双方发送关联建立通知
            if (action === 'accept') {
                this.sendLinkNotificationToUser(request.from_app_user, {
                    type: 'LINK_ESTABLISHED',
                    data: {
                        linkedUser: appUser,
                        supervisedUserName: request.supervised_user_name,
                        role: 'manager'
                    }
                });
                
                this.sendLinkNotificationToUser(appUser, {
                    type: 'LINK_ESTABLISHED',
                    data: {
                        linkedUser: request.from_app_user,
                        supervisedUserName: request.supervised_user_name,
                        role: 'linked'
                    }
                });
            }
        }
        
        return result;
    }

    async handleLinkGetUserLinks(appUser) {
        const LinkService = require('./linkService');
        const links = await LinkService.getUserLinks(appUser);
        return { links };
    }

    async handleLinkCancelLink(data) {
        const LinkService = require('./linkService');
        const { linkId, appUser } = data;
        
        // 获取关联详情用于通知
        const { query } = require('../config/sqlite');
        const linkDetails = await query(`
            SELECT ul.*, u.display_name as supervised_user_name
            FROM user_links ul
            JOIN users u ON ul.supervised_user_id = u.id
            WHERE ul.id = ?
        `, [linkId]);
        
        const result = await LinkService.cancelLink(linkId, appUser);
        
        if (linkDetails.length > 0) {
            const link = linkDetails[0];
            const otherUser = link.manager_app_user === appUser ? link.linked_app_user : link.manager_app_user;
            
            // 向另一方发送关联取消通知
            this.sendLinkNotificationToUser(otherUser, {
                type: 'LINK_CANCELLED',
                data: {
                    cancelledBy: appUser,
                    supervisedUserName: link.supervised_user_name,
                    linkId
                }
            });
        }
        
        return result;
    }

    // 向特定用户发送Link通知
    sendLinkNotificationToUser(appUser, notification) {
        console.log(`📡 尝试向用户 ${appUser} 发送Link通知`);
        
        // 查找该注册用户的所有连接设备（使用appUserConnections）
        if (this.appUserConnections.has(appUser)) {
            const deviceIds = this.appUserConnections.get(appUser);
            let sentCount = 0;

            deviceIds.forEach(deviceId => {
                const connection = this.connections.get(deviceId);
                if (connection && connection.ws.readyState === WebSocket.OPEN) {
                    this.sendMessage(connection.ws, {
                        ...notification,
                        timestamp: Date.now()
                    });
                    sentCount++;
                }
            });
            
            if (sentCount > 0) {
                console.log(`📡 向用户 ${appUser} 的 ${sentCount} 个设备发送Link通知成功`);
            } else {
                console.log(`⚠️  用户 ${appUser} 的设备都不在线，无法发送Link通知`);
            }
        } else {
            console.log(`⚠️  用户 ${appUser} 当前不在线，无法发送Link通知`);
        }
    }

    // 向关联用户广播数据同步通知
    broadcastDataSyncToLinkedUsers(supervisedUserId, operation, table, data) {
        // 获取该被监管用户的所有关联关系
        const { query } = require('../config/sqlite');
        
        query(`
            SELECT manager_app_user, linked_app_user FROM user_links 
            WHERE supervised_user_id = ? AND status = 'active'
        `, [supervisedUserId]).then(links => {
            links.forEach(link => {
                // 向管理员和关联用户发送同步通知
                [link.manager_app_user, link.linked_app_user].forEach(appUser => {
                    // 根据表类型发送对应的同步更新消息
                    const messageType = table === 'todos' ? 'TODO_SYNC_UPDATE' : 
                                       table === 'notes' ? 'NOTES_SYNC_UPDATE' : 'DATA_SYNC_UPDATE';
                    
                    this.sendLinkNotificationToUser(appUser, {
                        type: messageType,
                        operation: operation,
                        data: data,
                        sync: {
                            supervisedUserId: supervisedUserId,
                            fromTable: table,
                            timestamp: Date.now()
                        }
                    });
                });
            });
        }).catch(error => {
            console.error('❌ 广播数据同步通知失败:', error);
        });
    }

    // 判断是否是修改操作（需要广播）
    isModifyOperation(type) {
        const modifyOperations = [
            'TODO_CREATE', 'TODO_UPDATE', 'TODO_DELETE', 'TODO_COMPLETE', 'TODO_UNCOMPLETE',
            'NOTES_CREATE', 'NOTES_UPDATE', 'NOTES_DELETE',
            'LINK_CREATE_REQUEST', 'LINK_HANDLE_REQUEST', 'LINK_CANCEL_LINK'
        ];
        return modifyOperations.includes(type);
    }

    // 判断是否是数据修改操作（需要同步给关联用户）
    isDataModifyOperation(type) {
        const dataModifyOperations = [
            'TODO_CREATE', 'TODO_UPDATE', 'TODO_DELETE', 'TODO_COMPLETE', 'TODO_UNCOMPLETE',
            'NOTES_CREATE', 'NOTES_UPDATE', 'NOTES_DELETE'
        ];
        return dataModifyOperations.includes(type);
    }

    // 检查用户在线状态
    async handleCheckUserOnline(appUserId) {
        console.log(`🔍 检查用户 ${appUserId} 在线状态`);
        
        const isOnline = this.appUserConnections.has(appUserId);
        const deviceCount = isOnline ? this.appUserConnections.get(appUserId).size : 0;
        
        console.log(`👤 用户 ${appUserId} 在线状态: ${isOnline}, 设备数: ${deviceCount}`);
        
        return {
            appUserId,
            isOnline,
            deviceCount,
            timestamp: Date.now()
        };
    }

    // 发送关联邀请
    async handleSendLinkInvitation(data) {
        console.log('📨 发送关联邀请:', data);
        
        const { targetAppUser, fromAppUser, supervisedUserId, supervisedUserName, message } = data;
        
        // 检查目标用户是否在线
        if (!this.appUserConnections.has(targetAppUser)) {
            throw new Error(`用户 ${targetAppUser} 当前不在线`);
        }
        
        // 构造邀请消息
        const invitationData = {
            type: 'LINK_INVITATION_RECEIVED',
            data: {
                fromUser: fromAppUser,
                supervisedUserId,
                supervisedUserName,
                message: message || `${fromAppUser} 想要与您关联 ${supervisedUserName} 的健康数据`,
                timestamp: Date.now(),
                expiresIn: 300000 // 5分钟过期
            }
        };
        
        // 向目标用户的所有设备发送邀请
        this.sendLinkNotificationToUser(targetAppUser, invitationData);
        
        return {
            success: true,
            targetUser: targetAppUser,
            message: '邀请已发送'
        };
    }

    // 处理关联邀请响应
    async handleLinkInvitationResponse(data) {
        console.log('📝 处理关联邀请响应:', data);
        
        const { action, fromAppUser, toAppUser, supervisedUserId, supervisedUserName } = data;
        
        if (action === 'accept') {
            // 接受邀请，创建关联关系
            try {
                const LinkService = require('./linkService');
                const result = await LinkService.createLinkDirectly(
                    fromAppUser, 
                    toAppUser, 
                    supervisedUserId
                );
                
                // 通知发起用户邀请被接受
                this.sendLinkNotificationToUser(fromAppUser, {
                    type: 'LINK_INVITATION_ACCEPTED',
                    data: {
                        acceptedBy: toAppUser,
                        supervisedUserName,
                        linkId: result.linkId
                    }
                });
                
                // 通知双方关联建立成功
                this.sendLinkNotificationToUser(fromAppUser, {
                    type: 'LINK_ESTABLISHED',
                    data: {
                        linkedUser: toAppUser,
                        supervisedUserName,
                        role: 'manager'
                    }
                });
                
                this.sendLinkNotificationToUser(toAppUser, {
                    type: 'LINK_ESTABLISHED',
                    data: {
                        linkedUser: fromAppUser,
                        supervisedUserName,
                        role: 'linked'
                    }
                });
                
                return { success: true, message: '关联建立成功', linkId: result.linkId };
                
            } catch (error) {
                console.error('❌ 创建关联失败:', error);
                throw new Error('创建关联失败: ' + error.message);
            }
        } else if (action === 'reject') {
            // 拒绝邀请
            this.sendLinkNotificationToUser(fromAppUser, {
                type: 'LINK_INVITATION_REJECTED',
                data: {
                    rejectedBy: toAppUser,
                    supervisedUserName
                }
            });
            
            return { success: true, message: '邀请已拒绝' };
        } else {
            throw new Error('无效的响应操作');
        }
    }

    // 检查Link状态
    async handleLinkCheckStatus(appUser) {
        const LinkService = require('./linkService');
        try {
            // 获取用户的关联状态
            const links = await LinkService.getUserLinks(appUser);
            console.log(`🔍 [WebSocket] ${appUser} 的关联状态:`, links);
            
            return {
                appUser,
                links,
                hasLinks: links && links.length > 0,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('❌ 检查关联状态失败:', error);
            throw error;
        }
    }

    // 发送关联邀请 (新版本)
    async handleLinkSendInvitation(data, deviceId) {
        const LinkService = require('./linkService');
        try {
            const { toUser, supervisedUserId, message } = data;
            const fromUser = this.getAppUserFromConnection(deviceId);
            
            console.log(`🔍 [WebSocket] 查找发送用户: deviceId=${deviceId}, fromUser=${fromUser}`);
            
            if (!fromUser) {
                throw new Error('无法确定发送用户');
            }
            
            // 1. 首先检查目标用户是否在线
            const targetOnlineStatus = await this.handleCheckUserOnline(toUser);
            console.log(`👤 [WebSocket] 目标用户 ${toUser} 在线状态:`, targetOnlineStatus);
            
            if (!targetOnlineStatus.isOnline) {
                // 如果目标用户不在线，不创建邀请记录，直接提示用户
                return {
                    success: false,
                    error: 'TARGET_USER_OFFLINE',
                    message: `用户 ${toUser} 当前不在线，请稍后再试或通过其他方式联系对方`,
                    targetUser: toUser,
                    isOnline: false
                };
            }
            
            // 2. 目标用户在线，检查是否存在待处理的邀请
            const result = await LinkService.createRequestWithOverride(fromUser, toUser, supervisedUserId, message);
            
            console.log(`📨 [WebSocket] 关联邀请发送成功:`, result);
            
            // 3. 实时推送邀请通知给目标用户
            this.sendLinkNotificationToUser(toUser, {
                type: 'LINK_REQUEST_RECEIVED',
                data: {
                    requestId: result.id,
                    fromUser: fromUser,
                    supervisedUserId: supervisedUserId,
                    supervisedUserName: result.supervised_user_name,
                    message: message,
                    isUpdate: result.isOverride || false,
                    timestamp: Date.now(),
                    expiresIn: 7 * 24 * 60 * 60 * 1000 // 7天过期
                }
            });
            
            console.log(`📡 [WebSocket] 邀请通知已推送给 ${toUser}`);
            
            return {
                success: true,
                requestId: result.id,
                message: result.isOverride ? '邀请已更新并重新发送' : '邀请已发送',
                isOverride: result.isOverride || false
            };
        } catch (error) {
            console.error('❌ 发送关联邀请失败:', error);
            throw error;
        }
    }

    // 接受关联邀请
    async handleLinkAcceptInvitation(data, deviceId) {
        const LinkService = require('./linkService');
        try {
            const { requestId } = data;
            const appUser = this.getAppUserFromConnection(deviceId);
            
            console.log(`🔍 [WebSocket] 接受邀请: deviceId=${deviceId}, appUser=${appUser}, requestId=${requestId}`);
            
            if (!appUser) {
                throw new Error('无法确定用户身份');
            }
            
            // 调用LinkService处理请求（接受）
            const result = await LinkService.handleRequest(requestId, 'accept', appUser);
            
            console.log(`✅ [WebSocket] 关联邀请接受成功:`, result);
            
            // 发送Link建立成功的广播通知给接受邀请的用户
            this.broadcastToAppUser(appUser, {
                type: 'LINK_ESTABLISHED',
                success: true,
                data: {
                    status: result.status,
                    synced: result.synced,
                    message: '关联建立成功，数据已同步'
                },
                timestamp: Date.now()
            });
            
            return {
                success: true,
                status: result.status,
                synced: result.synced,
                message: '关联建立成功'
            };
        } catch (error) {
            console.error('❌ 接受关联邀请失败:', error);
            throw error;
        }
    }

    // 拒绝关联邀请
    async handleLinkRejectInvitation(data, deviceId) {
        const LinkService = require('./linkService');
        try {
            const { requestId } = data;
            const appUser = this.getAppUserFromConnection(deviceId);
            
            console.log(`🔍 [WebSocket] 拒绝邀请: deviceId=${deviceId}, appUser=${appUser}, requestId=${requestId}`);
            
            if (!appUser) {
                throw new Error('无法确定用户身份');
            }
            
            // 调用LinkService处理请求（拒绝）
            const result = await LinkService.handleRequest(requestId, 'reject', appUser);
            
            console.log(`❌ [WebSocket] 关联邀请拒绝成功:`, result);
            
            return {
                success: true,
                status: result.status,
                message: '邀请已拒绝'
            };
        } catch (error) {
            console.error('❌ 拒绝关联邀请失败:', error);
            throw error;
        }
    }

    // 取消关联
    async handleLinkCancel(data, deviceId) {
        const LinkService = require('./linkService');
        try {
            const { linkId } = data;
            const appUser = this.getAppUserFromConnection(deviceId);
            
            console.log(`🔍 [WebSocket] 取消关联: deviceId=${deviceId}, appUser=${appUser}`);
            
            if (!appUser) {
                throw new Error('无法确定用户身份');
            }
            
            // 调用LinkService取消关联
            const result = await LinkService.cancelLink(linkId, appUser);
            
            console.log(`🔗 [WebSocket] 取消关联成功:`, result);
            
            return {
                success: true,
                message: '关联已取消'
            };
        } catch (error) {
            console.error('❌ 取消关联失败:', error);
            throw error;
        }
    }

    // 从连接中获取app_user
    getAppUserFromConnection(deviceId) {
        const connection = this.connections.get(deviceId);
        return connection ? connection.appUserId : null;
    }

    // 处理用户注册
    async handleUserRegistration(deviceId, userId, appUserId) {
        console.log(`👤 [WebSocket] 处理用户注册: deviceId=${deviceId}, userId=${userId}, appUserId=${appUserId}`);
        
        if (!deviceId || !appUserId) {
            throw new Error('用户注册信息不完整');
        }
        
        // 这里不需要再次调用registerConnection，因为在handleMessage中已经调用了
        // 只是返回注册成功的确认
        console.log(`✅ [WebSocket] 用户 ${appUserId} 注册成功`);
        
        return {
            success: true,
            message: '用户注册成功',
            deviceId,
            userId,
            appUserId,
            timestamp: Date.now()
        };
    }

    // 处理心跳请求并检查数据更新
    async handlePing(userId, appUserId) {
        try {
            const { query } = require('../config/sqlite');
            
            let lastTodoUpdate = null;
            let lastNoteUpdate = null;
            let hasLinkedData = false;
            
            if (userId) {
                // 检查该用户的todos最后更新时间
                const todoUpdate = await query(`
                    SELECT MAX(updated_at) as last_update 
                    FROM todos 
                    WHERE user_id = ? AND is_active = 1
                `, [userId]);
                
                if (todoUpdate.length > 0 && todoUpdate[0].last_update) {
                    lastTodoUpdate = todoUpdate[0].last_update;
                }
                
                // 检查该用户的todo完成记录最后更新时间
                const completionUpdate = await query(`
                    SELECT MAX(created_at) as last_completion
                    FROM todo_completions tc
                    JOIN todos t ON tc.todo_id = t.id
                    WHERE t.user_id = ?
                `, [userId]);
                
                if (completionUpdate.length > 0 && completionUpdate[0].last_completion) {
                    const completionTime = completionUpdate[0].last_completion;
                    if (!lastTodoUpdate || completionTime > lastTodoUpdate) {
                        lastTodoUpdate = completionTime;
                    }
                }
                
                // 检查该用户的notes最后更新时间
                const noteUpdate = await query(`
                    SELECT MAX(updated_at) as last_update 
                    FROM notes 
                    WHERE user_id = ?
                `, [userId]);
                
                if (noteUpdate.length > 0 && noteUpdate[0].last_update) {
                    lastNoteUpdate = noteUpdate[0].last_update;
                }
                
                // 检查是否有关联关系
                const linkCheck = await query(`
                    SELECT COUNT(*) as count 
                    FROM user_links ul
                    JOIN users u ON ul.supervised_user_id = u.id
                    WHERE u.id = ? AND ul.status = 'active'
                `, [userId]);
                
                hasLinkedData = linkCheck.length > 0 && linkCheck[0].count > 0;
            }
            
            return {
                type: 'PONG',
                timestamp: Date.now(),
                dataStatus: {
                    lastTodoUpdate: lastTodoUpdate,
                    lastNoteUpdate: lastNoteUpdate,
                    hasLinkedData: hasLinkedData,
                    userId: userId
                }
            };
        } catch (error) {
            console.error('❌ 处理心跳请求失败:', error);
            return { type: 'PONG', timestamp: Date.now() };
        }
    }

    // 获取连接统计
    getStats() {
        return {
            totalConnections: this.connections.size,
            totalUsers: this.userConnections.size,
            totalAppUsers: this.appUserConnections.size,
            userDevices: Object.fromEntries(
                Array.from(this.userConnections.entries()).map(([userId, devices]) => 
                    [userId, devices.size]
                )
            ),
            appUserDevices: Object.fromEntries(
                Array.from(this.appUserConnections.entries()).map(([appUserId, devices]) => 
                    [appUserId, devices.size]
                )
            )
        };
    }
}

module.exports = new WebSocketService();