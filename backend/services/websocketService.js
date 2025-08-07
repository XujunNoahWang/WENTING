// WebSocket服务 - 实时通信管理
const WebSocket = require('ws');
const Todo = require('../models/Todo');
const Note = require('../models/Note');
const User = require('../models/User');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.connections = new Map(); // deviceId -> { ws, userId, lastActive }
        this.userConnections = new Map(); // userId -> Set of deviceIds
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
        const { type, deviceId, userId, data, timestamp } = message;
        
        console.log('📨 收到WebSocket消息:', { type, deviceId, userId });

        // 注册连接
        if (deviceId && userId) {
            this.registerConnection(ws, deviceId, userId);
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
                    response = await this.handleTodoUncomplete(data.todoId, data.date);
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

                // 连接管理
                case 'PING':
                    response = { type: 'PONG', timestamp: Date.now() };
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
            }

        } catch (error) {
            console.error(`❌ 处理${type}操作失败:`, error);
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
        return { todo };
    }

    async handleTodoUpdate(todoId, updateData) {
        const todo = await Todo.updateById(todoId, updateData);
        return { todo };
    }

    async handleTodoDelete(todoId, deletionType, deletionDate) {
        const success = await Todo.deleteById(todoId, deletionType, deletionDate);
        return { success, todoId, deletionType };
    }

    async handleTodoComplete(todoId, userId, date) {
        await Todo.markCompleted(todoId, userId, date);
        return { todoId, completed: true, date };
    }

    async handleTodoUncomplete(todoId, date) {
        const success = await Todo.markUncompleted(todoId, date);
        return { todoId, completed: false, date, success };
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
    registerConnection(ws, deviceId, userId) {
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
            lastActive: Date.now()
        });

        // 维护用户连接映射
        if (!this.userConnections.has(userId)) {
            this.userConnections.set(userId, new Set());
        }
        this.userConnections.get(userId).add(deviceId);

        // 在WebSocket对象上保存信息，便于清理时使用
        ws.deviceId = deviceId;
        ws.userId = userId;

        console.log(`✅ 设备 ${deviceId} (用户 ${userId}) 连接已注册`);
        console.log(`📊 当前活跃连接数: ${this.connections.size}`);
    }

    removeConnection(ws) {
        if (ws.deviceId) {
            this.connections.delete(ws.deviceId);
            
            // 从用户连接映射中移除
            if (ws.userId && this.userConnections.has(ws.userId)) {
                this.userConnections.get(ws.userId).delete(ws.deviceId);
                // 如果用户没有任何设备连接，清理映射
                if (this.userConnections.get(ws.userId).size === 0) {
                    this.userConnections.delete(ws.userId);
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

    // 判断是否是修改操作（需要广播）
    isModifyOperation(type) {
        const modifyOperations = [
            'TODO_CREATE', 'TODO_UPDATE', 'TODO_DELETE', 'TODO_COMPLETE', 'TODO_UNCOMPLETE',
            'NOTES_CREATE', 'NOTES_UPDATE', 'NOTES_DELETE'
        ];
        return modifyOperations.includes(type);
    }

    // 获取连接统计
    getStats() {
        return {
            totalConnections: this.connections.size,
            totalUsers: this.userConnections.size,
            userDevices: Object.fromEntries(
                Array.from(this.userConnections.entries()).map(([userId, devices]) => 
                    [userId, devices.size]
                )
            )
        };
    }
}

module.exports = new WebSocketService();