// WebSocket客户端 - 实时通信管理
const WebSocketClient = {
    ws: null,
    isConnected: false,
    reconnectAttempts: 0,
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_INTERVAL: 2000,
    HEARTBEAT_INTERVAL: null,
    REQUEST_TIMEOUT: 120000, // 120秒超时
    REGISTRATION_TIMEOUT: 5000, // 5秒注册超时
    messageHandlers: new Map(),
    lastDataStatus: {
        lastTodoUpdate: null,
        lastNoteUpdate: null,
        hasLinkedData: false
    },
    
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
                    if (event.code !== 1000 && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
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
        const appUserId = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : null;

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
                    console.warn(`⚠️ WebSocket请求超时: ${type}`, data);
                    reject(new Error('请求超时'));
                }, this.REQUEST_TIMEOUT);

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

        // 🔥 新增：特别处理注册确认
        if (type === 'USER_REGISTRATION_RESPONSE') {
            if (this.registrationTimeout) {
                clearTimeout(this.registrationTimeout);
                this.registrationTimeout = null;
            }
            console.log('✅ WebSocket注册确认收到:', message);
            return;
        }

        // 处理响应和错误消息
        if (this.messageHandlers.has(type)) {
            const handler = this.messageHandlers.get(type);
            handler(message);
            return;
        }

        // 处理心跳响应并检查数据变化
        if (type === 'PONG' || type === 'PING_RESPONSE') {
            console.log('💗 收到心跳响应');
            this.handleHeartbeatResponse(message);
            return;
        }

        // 🔥 关键修复：统一处理所有同步消息，添加更多调试信息
        if (type === 'TODO_SYNC_UPDATE' || type === 'NOTES_SYNC_UPDATE' || type === 'DATA_SYNC_UPDATE') {
            console.log(`🔄 [SYNC] 收到同步消息: ${type}`, message);
            console.log(`🔄 [SYNC] 当前页面状态:`, {
                currentModule: window.GlobalUserState ? window.GlobalUserState.getCurrentModule() : null,
                currentUser: window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null,
                appUserId: window.GlobalUserState ? window.GlobalUserState.getAppUserId() : null
            });
            this.handleSyncMessage(message);
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

        // 处理其他响应消息
        if (type.endsWith('_RESPONSE')) {
            console.log(`📨 收到响应消息: ${type}`, message.success ? '✅' : '❌');
            return;
        }

        console.log('⚠️ 未处理的消息类型:', type);
    },

    // 🔥 新增：统一的同步消息处理方法
    handleSyncMessage(message) {
        const { type, operation, data, sync } = message;
        const currentModule = window.GlobalUserState ? window.GlobalUserState.getCurrentModule() : 'unknown';
        
        console.log(`🔄 [SYNC] 处理同步消息:`, {
            type,
            operation,
            currentModule,
            fromUser: sync?.fromUser,
            userId: sync?.userId
        });

        // 🔥 关键修复：只有在相关页面时才进行UI更新，否则只进行后台数据同步
        const isRelevantPage = (type === 'TODO_SYNC_UPDATE' && currentModule === 'todo') ||
                              (type === 'NOTES_SYNC_UPDATE' && currentModule === 'notes');

        if (!isRelevantPage) {
            console.log(`⏸️ [SYNC] 当前页面(${currentModule})与同步类型(${type})不匹配，只进行后台数据同步`);
        }

        // 确定数据类型
        let dataType = 'all';
        if (type === 'TODO_SYNC_UPDATE') {
            dataType = 'todos';
        } else if (type === 'NOTES_SYNC_UPDATE') {
            dataType = 'notes';
        }

        // 立即清除缓存并重新加载数据（仅后台刷新，不改变当前模块或进行页面跳转）
        this.reloadApplicationData(dataType, true);

        // 显示同步通知
        if (sync && sync.fromUser) {
            const operationText = {
                'COMPLETE': '完成',
                'UNCOMPLETE': '取消完成',
                'CREATE': '创建',
                'UPDATE': '更新',
                'DELETE': '删除'
            }[operation] || operation;
            
            const itemType = type.includes('TODO') ? '待办事项' : '笔记';
            const syncType = isRelevantPage ? '已同步' : '后台同步';
            
            this.showSyncNotification(
                `${sync.fromUser} ${operationText}了${itemType} (${syncType})`, 
                isRelevantPage ? 'success' : 'info'
            );
        }

        // 通知相应的Manager处理同步更新（只在对应模块时才触发渲染）
        if (type === 'TODO_SYNC_UPDATE' && window.TodoManager) {
            if (currentModule === 'todo') {
                window.TodoManager.handleWebSocketBroadcast('TODO_SYNC_UPDATE', message);
            } else {
                console.log('⏸️ 当前不在TODO模块，跳过UI渲染，仅后台同步');
            }
        } else if (type === 'NOTES_SYNC_UPDATE' && window.NotesManager) {
            if (currentModule === 'notes') {
                window.NotesManager.handleWebSocketBroadcast('NOTES_SYNC_UPDATE', message);
            } else {
                console.log('⏸️ 当前不在NOTES模块，跳过UI渲染，仅后台同步');
            }
        }
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
            case 'LINK_ACCEPTED':
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

    // 处理数据同步更新消息
    handleDataSyncUpdate(message) {
        const { data } = message;
        console.log('🔄 [WebSocket] 处理数据同步更新:', data);
        
        if (window.App && window.App.handleDataSyncUpdate) {
            window.App.handleDataSyncUpdate(data);
        } else {
            console.error('❌ App.handleDataSyncUpdate 方法不存在');
        }
    },

    // 心跳检测
    startHeartbeat() {
        this.HEARTBEAT_INTERVAL = setInterval(() => {
            if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                // 获取当前用户信息
                const deviceId = window.DeviceManager ? window.DeviceManager.deviceId : null;
                const currentUser = window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null;
                const appUserId = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : null;
                
                this.ws.send(JSON.stringify({
                    type: 'PING',
                    timestamp: Date.now(),
                    deviceId: deviceId,
                    userId: currentUser ? currentUser.id : null,
                    appUserId: appUserId
                }));
            }
        }, 30000); // 30秒发送一次心跳
    },

    stopHeartbeat() {
        if (this.HEARTBEAT_INTERVAL) {
            clearInterval(this.HEARTBEAT_INTERVAL);
            this.HEARTBEAT_INTERVAL = null;
        }
    },

    // 计划重连
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.RECONNECT_INTERVAL * this.reconnectAttempts;
        
        console.log(`🔄 计划在 ${delay}ms 后重连 (尝试 ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
        
        setTimeout(() => {
            console.log(`🔄 开始第 ${this.reconnectAttempts} 次重连尝试`);
            this.init().catch(error => {
                console.error('❌ 重连失败:', error);
                if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
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

        async uncomplete(todoId, date, userId) {
            return await WebSocketClient.sendMessage('TODO_UNCOMPLETE', { 
                todoId, date, userId 
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
        const appUserId = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : null;

        console.log('🔍 WebSocket注册信息调试:', { deviceId, userId, appUserId });
        console.log('🔍 localStorage状态:', {
            'wenting_current_app_user': localStorage.getItem('wenting_current_app_user'),
            'wenting_current_user': localStorage.getItem('wenting_current_user')
        });

        if (!deviceId) {
            console.error('❌ 缺少deviceId，无法注册WebSocket');
            console.log('💡 请检查 window.DeviceManager.getCurrentDeviceId()');
            // 🔥 新增：尝试生成临时deviceId
            const tempDeviceId = 'temp_' + Math.random().toString(36).substr(2, 9);
            console.log('🔄 生成临时deviceId:', tempDeviceId);
            return;
        }
        
        if (!appUserId) {
            console.error('❌ 缺少appUserId，无法注册WebSocket');
            console.log('💡 当前localStorage状态:', {
                'wenting_current_app_user': localStorage.getItem('wenting_current_app_user'),
                'wenting_current_user': localStorage.getItem('wenting_current_user')
            });
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
            console.log('📝 用户注册消息已发送:', registrationMessage);
            
            // 🔥 新增：设置注册确认超时
            if (this.registrationTimeout) {
                clearTimeout(this.registrationTimeout);
            }
            this.registrationTimeout = setTimeout(() => {
                console.warn('⚠️ WebSocket注册确认超时，尝试重新注册');
                this.sendRegistrationMessage();
            }, this.REGISTRATION_TIMEOUT);
            
        } catch (error) {
            console.error('❌ 发送注册消息失败:', error);
            // 重试机制
            setTimeout(() => {
                if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    console.log('🔄 重试发送WebSocket注册消息...');
                    this.sendRegistrationMessage();
                }
            }, 1000);
        }
    },

    // 处理心跳响应并检查数据变化
    handleHeartbeatResponse(message) {
        try {
            // 如果消息包含数据状态信息
            if (message.dataStatus) {
                const newDataStatus = message.dataStatus;
                let reloadTypes = [];
                
                // 检查TODO数据是否有变化
                if (newDataStatus.lastTodoUpdate !== this.lastDataStatus.lastTodoUpdate) {
                    console.log('📅 检测到TODO数据变化，准备重新加载');
                    reloadTypes.push('todos');
                }
                
                // 检查Notes数据是否有变化
                if (newDataStatus.lastNoteUpdate !== this.lastDataStatus.lastNoteUpdate) {
                    console.log('📝 检测到Notes数据变化，准备重新加载');
                    reloadTypes.push('notes');
                }
                
                // 检查关联状态是否有变化
                if (newDataStatus.hasLinkedData !== this.lastDataStatus.hasLinkedData) {
                    console.log('🔗 检测到Link状态变化，准备重新加载所有数据');
                    reloadTypes = ['all']; // Link状态变化可能影响所有数据
                }
                
                // 更新缓存的数据状态
                this.lastDataStatus = {
                    lastTodoUpdate: newDataStatus.lastTodoUpdate,
                    lastNoteUpdate: newDataStatus.lastNoteUpdate,
                    hasLinkedData: newDataStatus.hasLinkedData
                };
                
                // 如果检测到数据变化，根据变化类型精准重新加载
                if (reloadTypes.length > 0) {
                    console.log('🔄 数据变化检测：触发数据重新加载', reloadTypes);
                    for (const dataType of reloadTypes) {
                        this.reloadApplicationData(dataType);
                    }
                }
            }
        } catch (error) {
            console.error('❌ 处理心跳响应失败:', error);
        }
    },
    
    // 重新加载应用数据
    reloadApplicationData(dataType = 'all', forceReload = false) {
        try {
            console.log('🔄 [RELOAD] 重新加载应用数据:', { dataType, forceReload });
            
            // 如果指定了数据类型或者全部重新加载，才处理TODO
            if (dataType === 'all' || dataType === 'todos') {
                if (window.TodoManager) {
                    console.log('🧹 [RELOAD] 清除TODO缓存');
                    window.TodoManager.clearAllRelatedCache();
                    
                    const currentDate = window.DateManager ? window.DateManager.selectedDate : new Date();
                    const currentUser = window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null;
                    const currentModule = window.GlobalUserState ? window.GlobalUserState.getCurrentModule() : 'unknown';
                    
                    console.log('📅 [RELOAD] 重新加载TODO数据:', { 
                        currentDate: currentDate.toISOString().split('T')[0], 
                        currentUser,
                        currentModule,
                        forceReload
                    });
                    
                    if (currentUser) {
                        // 强制重新加载，不使用缓存
                        window.TodoManager.loadTodosForDate(currentDate, currentUser, false).then(() => {
                            console.log('✅ [RELOAD] TODO数据重新加载完成');
                            
                            // 如果当前在TODO模块，重新渲染界面
                            if (currentModule === 'todo') {
                                console.log('🎨 [RELOAD] 重新渲染TODO界面');
                                window.TodoManager.renderTodoPanel(currentUser);
                            }
                        }).catch(error => {
                            console.error('❌ [RELOAD] TODO数据重新加载失败:', error);
                        });
                    } else {
                        console.log('⚠️ [RELOAD] 没有当前用户，跳过TODO数据加载');
                    }
                } else {
                    console.log('⚠️ [RELOAD] TodoManager不可用');
                }
            }
            
            // 如果指定了数据类型或者全部重新加载，才处理Notes
            if (dataType === 'all' || dataType === 'notes') {
                if (window.NotesManager && typeof window.NotesManager.loadNotesFromAPI === 'function') {
                    console.log('🔄 [RELOAD] 重新加载Notes数据');
                    
                    const currentModule = window.GlobalUserState ? window.GlobalUserState.getCurrentModule() : 'unknown';
                    const currentUser = window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null;
                    
                    console.log('📝 [RELOAD] Notes重新加载信息:', { 
                        currentModule,
                        currentUser,
                        forceReload 
                    });
                    
                    // 🔥 关键修复：只有在Notes模块时才自动渲染，其他情况只后台同步数据
                    const shouldAutoRender = currentModule === 'notes';
                    window.NotesManager.loadNotesFromAPI(shouldAutoRender, currentUser);
                    
                    if (!shouldAutoRender) {
                        console.log('⏸️ [RELOAD] 当前不在Notes页面，只进行后台数据同步');
                    }
                } else if (window.NotesManager) {
                    console.log('⚠️ [RELOAD] NotesManager存在但loadNotesFromAPI方法不可用');
                }
            }
            
            console.log('✅ [RELOAD] 应用数据重新加载完成');
        } catch (error) {
            console.error('❌ [RELOAD] 重新加载应用数据失败:', error);
        }
    },
    
    // 显示同步通知
    showSyncNotification(message, type = 'info') {
        try {
            // 尝试使用TodoManager的通知方法
            if (window.TodoManager && typeof window.TodoManager.showSyncStatusToast === 'function') {
                window.TodoManager.showSyncStatusToast(message, type);
                return;
            }
            
            // 如果没有专门的通知方法，使用简单的控制台输出
            console.log(`🔔 同步通知: ${message}`);
            
            // 可以在这里添加其他通知方式，比如显示临时消息等
        } catch (error) {
            console.error('❌ 显示同步通知失败:', error);
        }
    },

    // 获取连接状态
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            wsState: this.ws ? this.ws.readyState : null,
            lastDataStatus: this.lastDataStatus
        };
    }
};

// 页面卸载时关闭连接
window.addEventListener('beforeunload', () => {
    WebSocketClient.close();
});

// 导出到全局
window.WebSocketClient = WebSocketClient;