// WebSocket客户端 - 实时通信管理
const WebSocketClient = {
    ws: null,
    isConnected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectInterval: 2000,
    heartbeatInterval: null,
    messageHandlers: new Map(),
    
    // 获取WebSocket URL
    getWebSocketURL() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let wsHost;

        // 自动适配 cloudflare tunnel 的域名
        if (protocol === 'wss:' && hostname.endsWith('.trycloudflare.com')) {
            wsHost = `wss://${hostname}`;
        } else if (hostname === '192.168.3.5') {
            wsHost = 'ws://192.168.3.5:3001';
        } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
            wsHost = 'ws://localhost:3001';
        } else {
            wsHost = `ws://${hostname}:3001`;
        }

        return `${wsHost}/ws`;
    },

    // 初始化WebSocket连接
    async init() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('⚠️ WebSocket已连接，无需重复初始化');
            return true;
        }

        return new Promise((resolve, reject) => {
            try {
                const wsUrl = this.getWebSocketURL();
                console.log('🔄 正在连接WebSocket:', wsUrl);
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket连接成功');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    
                    // 连接建立后立即发送注册消息
                    this.sendRegistrationMessage();
                    
                    resolve(true);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('❌ WebSocket消息解析失败:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('🔌 WebSocket连接关闭:', event.code, event.reason);
                    this.isConnected = false;
                    this.stopHeartbeat();
                    
                    // 如果不是主动关闭，尝试重连
                    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.scheduleReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket连接错误:', error);
                    this.isConnected = false;
                    reject(error);
                };

            } catch (error) {
                console.error('❌ WebSocket初始化失败:', error);
                reject(error);
            }
        });
    },

    // 发送消息
    async sendMessage(type, data = {}) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket未连接');
        }

        const deviceId = window.DeviceManager ? window.DeviceManager.getCurrentDeviceId() : null;
        const userId = window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null;
        const appUserId = localStorage.getItem('wenting_current_app_user') || null;

        const message = {
            type,
            deviceId,
            userId,
            appUserId,
            data,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            try {
                // 注册响应处理器
                const responseType = `${type}_RESPONSE`;
                const errorType = `${type}_ERROR`;
                
                const timeout = setTimeout(() => {
                    this.messageHandlers.delete(responseType);
                    this.messageHandlers.delete(errorType);
                    reject(new Error('请求超时'));
                }, 60000); // 60秒超时

                this.messageHandlers.set(responseType, (response) => {
                    clearTimeout(timeout);
                    this.messageHandlers.delete(responseType);
                    this.messageHandlers.delete(errorType);
                    resolve(response);
                });

                this.messageHandlers.set(errorType, (error) => {
                    clearTimeout(timeout);
                    this.messageHandlers.delete(responseType);
                    this.messageHandlers.delete(errorType);
                    reject(new Error(error.error || '请求失败'));
                });

                // 发送消息
                this.ws.send(JSON.stringify(message));
                console.log('📤 发送WebSocket消息:', type, data);
                
            } catch (error) {
                reject(error);
            }
        });
    },

    // 处理接收到的消息
    handleMessage(message) {
        const { type } = message;
        console.log('📥 收到WebSocket消息:', type, message);

        // 处理响应和错误消息
        if (this.messageHandlers.has(type)) {
            const handler = this.messageHandlers.get(type);
            handler(message);
            return;
        }

        // 处理广播消息
        if (type.endsWith('_BROADCAST')) {
            this.handleBroadcast(message);
            return;
        }

        // 处理Link相关通知消息
        if (type.startsWith('LINK_')) {
            this.handleLinkNotification(message);
            return;
        }

        // 处理心跳
        if (type === 'PONG') {
            console.log('💗 收到心跳响应');
            return;
        }

        console.log('⚠️ 未处理的消息类型:', type);
    },

    // 处理广播消息（其他设备的操作）
    handleBroadcast(message) {
        const { type, data } = message;
        console.log('📡 处理广播消息:', type);

        // 根据消息类型更新界面
        switch (type) {
            case 'TODO_CREATE_BROADCAST':
            case 'TODO_UPDATE_BROADCAST':
            case 'TODO_DELETE_BROADCAST':
            case 'TODO_COMPLETE_BROADCAST':
            case 'TODO_UNCOMPLETE_BROADCAST':
                // 通知TODO管理器更新界面
                if (window.TodoManager) {
                    window.TodoManager.handleWebSocketBroadcast(type, data);
                }
                break;
                
            case 'NOTES_CREATE_BROADCAST':
            case 'NOTES_UPDATE_BROADCAST':
            case 'NOTES_DELETE_BROADCAST':
                // 通知Notes管理器更新界面
                if (window.NotesManager) {
                    window.NotesManager.handleWebSocketBroadcast(type, data);
                }
                break;
                
        }
    },

    // 处理Link相关通知消息
    handleLinkNotification(message) {
        const { type, data } = message;
        console.log('🔗 [WebSocket] 处理Link通知:', type, data);

        // 根据消息类型处理Link相关通知
        switch (type) {
            case 'LINK_REQUEST_RECEIVED':
                // 收到关联邀请
                console.log('📨 [WebSocket] 收到关联邀请:', data);
                if (window.App && window.App.showLinkInvitationDialog) {
                    window.App.showLinkInvitationDialog(data);
                } else {
                    console.error('❌ App.showLinkInvitationDialog 方法不存在');
                }
                break;
                
            case 'LINK_INVITATION_ACCEPTED':
            case 'LINK_INVITATION_REJECTED':
            case 'LINK_CANCELLED':
                // 其他Link状态通知
                console.log(`🔗 [WebSocket] Link状态变更:`, type, data);
                if (window.App && window.App.handleLinkStatusChange) {
                    window.App.handleLinkStatusChange(type, data);
                } else {
                    console.error('❌ App.handleLinkStatusChange 方法不存在');
                }
                break;
                
            case 'LINK_ESTABLISHED':
                // Link建立成功通知 - 触发应用数据刷新
                console.log(`🔗 [WebSocket] Link建立成功:`, data);
                if (window.App && window.App.refreshApplicationAfterLink) {
                    console.log('🔄 [WebSocket] 触发应用数据刷新...');
                    window.App.refreshApplicationAfterLink();
                } else {
                    console.error('❌ App.refreshApplicationAfterLink 方法不存在');
                }
                break;

            case 'DATA_SYNC_UPDATE':
                // 数据同步更新通知
                console.log('🔄 [WebSocket] 数据同步更新:', data);
                if (window.App && window.App.handleDataSyncUpdate) {
                    window.App.handleDataSyncUpdate(data);
                } else {
                    console.error('❌ App.handleDataSyncUpdate 方法不存在');
                }
                break;

            default:
                console.log('⚠️ [WebSocket] 未处理的Link通知类型:', type);
        }
    },

    // 心跳检测
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'PING',
                    timestamp: Date.now()
                }));
            }
        }, 30000); // 30秒发送一次心跳
    },

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    },

    // 计划重连
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectInterval * this.reconnectAttempts;
        
        console.log(`🔄 计划在 ${delay}ms 后重连 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            console.log(`🔄 开始第 ${this.reconnectAttempts} 次重连尝试`);
            this.init().catch(error => {
                console.error('❌ 重连失败:', error);
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                } else {
                    console.error('❌ 达到最大重连次数，放弃重连');
                    // 降级到HTTP模式
                    this.fallbackToHTTP();
                }
            });
        }, delay);
    },

    // 降级到HTTP模式
    fallbackToHTTP() {
        console.log('📡 WebSocket不可用，降级到HTTP模式');
        // 通知各管理器切换到HTTP模式
        if (window.TodoManager) {
            window.TodoManager.fallbackToHTTP();
        }
        if (window.NotesManager) {
            window.NotesManager.fallbackToHTTP();
        }
    },

    // 关闭连接
    close() {
        this.stopHeartbeat();
        this.messageHandlers.clear();
        
        if (this.ws) {
            this.ws.close(1000, '正常关闭');
            this.ws = null;
        }
        
        this.isConnected = false;
        console.log('👋 WebSocket连接已关闭');
    },

    // TODO相关API方法
    todos: {
        async getTodayTodos(userId) {
            return await WebSocketClient.sendMessage('TODO_GET_TODAY', { userId });
        },

        async getTodosForDate(userId, date) {
            return await WebSocketClient.sendMessage('TODO_GET_BY_DATE', { userId, date });
        },

        async create(todoData) {
            return await WebSocketClient.sendMessage('TODO_CREATE', todoData);
        },

        async update(todoId, updateData) {
            return await WebSocketClient.sendMessage('TODO_UPDATE', { todoId, updateData });
        },

        async delete(todoId, deletionType, deletionDate) {
            return await WebSocketClient.sendMessage('TODO_DELETE', { 
                todoId, deletionType, deletionDate 
            });
        },

        async complete(todoId, userId, date) {
            return await WebSocketClient.sendMessage('TODO_COMPLETE', { 
                todoId, userId, date 
            });
        },

        async uncomplete(todoId, date) {
            return await WebSocketClient.sendMessage('TODO_UNCOMPLETE', { 
                todoId, date 
            });
        }
    },

    // Notes相关API方法
    notes: {
        async getByUserId(userId) {
            return await WebSocketClient.sendMessage('NOTES_GET_BY_USER', { userId });
        },

        async create(noteData) {
            return await WebSocketClient.sendMessage('NOTES_CREATE', noteData);
        },

        async update(noteId, updateData) {
            return await WebSocketClient.sendMessage('NOTES_UPDATE', { noteId, updateData });
        },

        async delete(noteId) {
            return await WebSocketClient.sendMessage('NOTES_DELETE', { noteId });
        },

        async generateAISuggestions(noteId, userLocation, weatherData) {
            return await WebSocketClient.sendMessage('NOTES_AI_SUGGESTIONS', { 
                noteId, userLocation, weatherData 
            });
        }
    },

    // Link功能相关API方法
    links: {
        async checkLinkStatus(appUser) {
            return await WebSocketClient.sendMessage('LINK_CHECK_STATUS', { appUser });
        },

        async sendInvitation(toUser, supervisedUserId, message) {
            return await WebSocketClient.sendMessage('LINK_SEND_INVITATION', { 
                toUser, supervisedUserId, message 
            });
        },

        async acceptInvitation(requestId) {
            return await WebSocketClient.sendMessage('LINK_ACCEPT_INVITATION', { requestId });
        },

        async rejectInvitation(requestId) {
            return await WebSocketClient.sendMessage('LINK_REJECT_INVITATION', { requestId });
        },

        async cancelLink(linkId) {
            return await WebSocketClient.sendMessage('LINK_CANCEL', { linkId });
        }
    },

    // 发送注册消息
    sendRegistrationMessage() {
        const deviceId = window.DeviceManager ? window.DeviceManager.getCurrentDeviceId() : null;
        const userId = window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null;
        const appUserId = localStorage.getItem('wenting_current_app_user') || null;

        if (!deviceId || !appUserId) {
            console.log('⚠️ 无法发送注册消息：缺少设备ID或用户ID');
            return;
        }

        const registrationMessage = {
            type: 'USER_REGISTRATION',
            deviceId,
            userId,
            appUserId,
            timestamp: Date.now()
        };

        try {
            this.ws.send(JSON.stringify(registrationMessage));
            console.log('📝 用户注册消息已发送:', { deviceId, userId, appUserId });
        } catch (error) {
            console.error('❌ 发送注册消息失败:', error);
        }
    },

    // 获取连接状态
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            wsState: this.ws ? this.ws.readyState : null
        };
    }
};

// 页面卸载时关闭连接
window.addEventListener('beforeunload', () => {
    WebSocketClient.close();
});

// 导出到全局
window.WebSocketClient = WebSocketClient;