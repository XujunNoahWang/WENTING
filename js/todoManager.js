// TODO管理模块 - 完全重写版本
const TodoManager = {
    currentUser: 1,
    todos: {},
    selectedDate: new Date(),
    isOnline: false,
    // 添加缓存机制
    todoCache: new Map(),
    lastLoadedDate: null,
    // 重试配置
    RETRY_DELAY_BASE: 1000, // 基础重试延迟1秒
    RETRY_DELAY_MULTIPLIER: 2000, // 整体重试延迟2秒

    // 初始化
    async init() {
        console.log('🔄 初始化TODO管理器...');
        
        // 检查后端连接 - 必须联网才能使用
        this.isOnline = await ApiClient.testConnection();
        
        if (!this.isOnline) {
            this.showOfflineError();
            return;
        }
        
        // 等待用户管理器初始化完成
        await this.waitForUserManager();
        
        // 加载TODO数据
        await this.loadTodosFromAPI();
        
        // 设置默认用户
        this.setDefaultUser();
        
        // 监听全局用户状态变化，但不设置模块
        if (window.GlobalUserState) {
            GlobalUserState.addListener(this.handleGlobalStateChange.bind(this));
        }
        
        // 不在这里渲染界面，等待应用界面显示后再渲染
        // 渲染将在app.js的setTimeout中进行
        
        this.bindEvents();
        
        console.log('✅ TODO管理器初始化完成');
    },

    // 等待用户管理器初始化完成
    async waitForUserManager() {
        // 设置最大等待时间为5秒，避免新用户无限等待
        const MAX_WAIT_TIME = 5000; // 5秒
        const startTime = Date.now();
        
        if (UserManager.users.length === 0) {
            console.log('⏳ 等待用户数据加载，新用户最多等待5秒...');
            await new Promise(resolve => {
                const checkUsers = () => {
                    const elapsedTime = Date.now() - startTime;
                    
                    if (UserManager.users.length > 0) {
                        console.log('✅ 用户数据已加载');
                        resolve();
                    } else if (elapsedTime >= MAX_WAIT_TIME) {
                        console.log('⏰ 等待超时，可能是新用户没有被管理用户，继续初始化...');
                        resolve();
                    } else {
                        setTimeout(checkUsers, 100);
                    }
                };
                checkUsers();
            });
        }
    },

    // 从API加载TODO数据
    async loadTodosFromAPI() {
        try {
            console.log('📥 从服务器加载TODO数据...');
            
            // 尝试使用WebSocket，失败则降级到HTTP
            let useWebSocket = true;
            try {
                // 确保WebSocket已连接
                if (!WebSocketClient.isConnected) {
                    await WebSocketClient.init();
                }
            } catch (error) {
                console.warn('⚠️ WebSocket连接失败，使用HTTP模式:', error.message);
                useWebSocket = false;
            }

            // 为每个用户加载TODO数据
            for (const user of UserManager.users) {
                try {
                    let response;
                    if (useWebSocket) {
                        response = await WebSocketClient.todos.getTodayTodos(user.id);
                        this.todos[user.id] = response.data.todos.map(todo => this.convertApiTodoToLocal(todo));
                    } else {
                        response = await ApiClient.todos.getTodayTodos(user.id);
                        if (response.success) {
                            this.todos[user.id] = response.data.map(todo => this.convertApiTodoToLocal(todo));
                        } else {
                            throw new Error(response.message);
                        }
                    }
                } catch (error) {
                    console.warn(`加载用户${user.id}的TODO失败:`, error.message);
                    this.todos[user.id] = [];
                }
            }
            
            console.log('✅ 从服务器加载TODO数据成功');
        } catch (error) {
            console.error('从服务器加载TODO数据失败:', error);
            throw error;
        }
    },

    // 设置默认用户
    setDefaultUser() {
        console.log('🔄 开始设置默认用户...');
        console.log('🔍 用户数据调试:');
        console.log('  - UserManager.users.length:', UserManager.users.length);
        console.log('  - UserManager.users:', UserManager.users);
        
        if (UserManager.users.length > 0) {
            // 检查是否有保存的用户选择
            let savedUserId = null;
            if (window.GlobalUserState) {
                savedUserId = GlobalUserState.getCurrentUser();
                console.log('💾 从全局状态获取保存的用户ID:', savedUserId);
            }
            
            // 按ID排序，选择ID最小的用户（最早添加的用户）
            const sortedUsers = [...UserManager.users].sort((a, b) => a.id - b.id);
            
            // 验证保存的用户ID是否仍然存在
            let defaultUser;
            if (savedUserId && sortedUsers.find(u => u.id == savedUserId)) {
                defaultUser = parseInt(savedUserId);
                console.log('🎯 使用保存的用户ID:', defaultUser);
            } else {
                defaultUser = sortedUsers[0].id;
                console.log('🎯 使用默认第一个用户:', defaultUser, '(用户名:', sortedUsers[0].username, ')');
            }
            
            console.log('📋 所有用户按ID排序:', sortedUsers.map(u => `ID:${u.id}(${u.username})`).join(', '));
            this.currentUser = defaultUser;
            
            // 直接同步全局状态，不触发事件（事件将在app.js中触发）
            if (window.GlobalUserState) {
                GlobalUserState.currentUserId = defaultUser;
                localStorage.setItem('wenting_current_user_id', defaultUser.toString());
                console.log('🔄 直接同步全局用户状态（不触发事件）');
                console.log('🔍 设置后的状态:');
                console.log('  - TodoManager.currentUser:', this.currentUser);
                console.log('  - GlobalUserState.currentUserId:', GlobalUserState.currentUserId);
            }
        } else {
            console.log('📝 没有用户，新注册用户情况，设置为空状态但继续初始化');
            this.currentUser = null;
            
            // 即使没有用户，也要设置全局状态，确保应用可以继续运行
            if (window.GlobalUserState) {
                GlobalUserState.currentUserId = null;
                console.log('🔄 设置全局状态为空用户状态');
            }
        }
    },

    // 处理全局状态变化
    handleGlobalStateChange(type, data) {
        console.log('📢 TODO管理器收到全局状态变化:', type, data);
        
        if (type === 'userChanged') {
            const newUserId = data.userId;
            console.log('🔄 处理用户切换事件:');
            console.log('  - 当前用户:', this.currentUser);
            console.log('  - 新用户:', newUserId);
            
            // 先更新currentUser，确保后续操作使用正确的用户ID
            const oldUser = this.currentUser;
            this.currentUser = newUserId;
            
            if (oldUser !== newUserId) {
                console.log(`🔄 用户从 ${oldUser} 切换到 ${newUserId}`);
                // 只有当前模块是todo时才渲染
                if (GlobalUserState.getCurrentModule() === 'todo') {
                    console.log('✅ 当前是TODO模块，渲染TODO内容');
                    
                    // 检查缓存决定是否显示进度条
                    const dateStr = (DateManager.selectedDate || new Date()).toISOString().split('T')[0];
                    const cacheKey = `${newUserId}_${dateStr}`;
                    let hasCache = this.todoCache.has(cacheKey);
                    
                    // 如果没有缓存，显示加载进度条
                    if (!hasCache && window.DateManager) {
                        window.DateManager.showLoadingProgress();
                    }
                    
                    this.loadTodosForDate(DateManager.selectedDate || new Date(), newUserId).then(() => {
                        if (window.DateManager) window.DateManager.hideLoadingProgress();
                    }).catch(() => {
                        if (window.DateManager) window.DateManager.hideLoadingProgress();
                    });
                } else {
                    console.log('⏸️ 当前不是TODO模块，跳过渲染');
                }
            } else {
                console.log('🔄 用户ID相同，但仍需重新渲染TODO面板（可能是初始化调用）');
                // 即使用户ID相同，也要重新渲染（比如初始化时）
                if (GlobalUserState.getCurrentModule() === 'todo') {
                    console.log('✅ 当前是TODO模块，渲染TODO内容');
                    
                    // 检查缓存决定是否显示进度条  
                    const dateStr = (DateManager.selectedDate || new Date()).toISOString().split('T')[0];
                    const cacheKey = `${newUserId}_${dateStr}`;
                    let hasCache = this.todoCache.has(cacheKey);
                    
                    // 如果没有缓存，显示加载进度条
                    if (!hasCache && window.DateManager) {
                        window.DateManager.showLoadingProgress();
                    }
                    
                    this.loadTodosForDate(DateManager.selectedDate || new Date(), newUserId).then(() => {
                        if (window.DateManager) window.DateManager.hideLoadingProgress();
                    }).catch(() => {
                        if (window.DateManager) window.DateManager.hideLoadingProgress();
                    });
                } else {
                    console.log('⏸️ 当前不是TODO模块，跳过渲染');
                }
            }
        }
    },

    // 显示离线错误
    showOfflineError() {
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="offline-error">
                    <div class="error-icon">🌐</div>
                    <h2>需要网络连接</h2>
                    <p>此应用需要连接到服务器才能正常使用。</p>
                    <p>请检查您的网络连接和服务器状态。</p>
                    <button onclick="location.reload()" class="retry-btn">重试</button>
                </div>
            `;
        }
    },

    // 显示空用户状态
    showEmptyUserState() {
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="empty-user-state">
                    <div class="empty-icon">👥</div>
                    <h2>欢迎使用雯婷</h2>
                    <p>还没有用户，请先添加一个用户开始使用。</p>
                    <button onclick="UserManager.addUser()" class="add-first-user-btn">添加第一个用户</button>
                </div>
            `;
        }
    },

    // 将API TODO格式转换为本地格式
    convertApiTodoToLocal(apiTodo) {
        console.log('📥 从服务器接收的TODO数据:', apiTodo);
        console.log('📋 重复周期数据调试:');
        console.log('  cycle_type:', apiTodo.cycle_type);
        console.log('  cycle_duration:', apiTodo.cycle_duration);
        console.log('  cycle_unit:', apiTodo.cycle_unit);
        
        const cycleText = this.getCycleText(apiTodo.cycle_type, apiTodo.cycle_duration, apiTodo.cycle_unit);
        console.log('  计算出的cycle文本:', cycleText);
        
        return {
            id: apiTodo.id,
            text: apiTodo.title,
            note: apiTodo.description || '',
            time: apiTodo.reminder_time === 'all_day' ? '当天' : apiTodo.reminder_time,
            period: this.getRepeatTypeText(apiTodo.repeat_type, apiTodo.repeat_interval),
            periodType: apiTodo.repeat_type,
            customInterval: apiTodo.repeat_interval > 1 ? apiTodo.repeat_interval : null,
            cycle: cycleText,
            cycleType: apiTodo.cycle_type || 'long_term',
            cycleDuration: apiTodo.cycle_duration || null,
            cycleUnit: apiTodo.cycle_unit || 'days',
            completed: apiTodo.is_completed_today || false,
            priority: apiTodo.priority || 'medium',
            createdDate: apiTodo.start_date || new Date().toISOString().split('T')[0]
        };
    },

    // 将本地TODO格式转换为API格式
    convertLocalTodoToApi(localTodo, userId) {
        return {
            user_id: userId,
            title: localTodo.text,
            description: localTodo.note || '',
            reminder_time: localTodo.time === '当天' ? 'all_day' : localTodo.time,
            priority: localTodo.priority || 'medium',
            repeat_type: localTodo.periodType || 'none',
            repeat_interval: localTodo.customInterval || 1,
            cycle_type: localTodo.cycleType || 'long_term',
            cycle_duration: localTodo.cycleDuration || null,
            cycle_unit: localTodo.cycleUnit || 'days',
            start_date: new Date().toISOString().split('T')[0]
        };
    },

    // 获取重复类型的显示文本
    getRepeatTypeText(repeatType, repeatInterval = 1) {
        switch (repeatType) {
            case 'none':
                return '一次性';
            case 'daily':
                return '每天';
            case 'every_other_day':
                return '隔天';
            case 'weekly':
                return '每周';
            case 'monthly':
                return '每月';
            case 'yearly':
                return '每年';
            case 'custom':
                return `每${repeatInterval}天`;
            default:
                return '一次性';
        }
    },

    // 获取重复周期的显示文本
    getCycleText(cycleType, cycleDuration, cycleUnit) {
        if (cycleType === 'long_term') {
            return '长期';
        } else if (cycleType === 'custom' && cycleDuration) {
            const unitText = {
                'days': '天',
                'weeks': '周',
                'months': '月'
            };
            return `${cycleDuration}${unitText[cycleUnit] || '天'}`;
        }
        return '长期';
    },


    // 渲染TODO面板
    renderTodoPanel(userId) {
        console.log('🎨 开始渲染TODO面板，用户ID:', userId);
        console.log('🔍 渲染调试信息:');
        
        const contentArea = document.getElementById('contentArea');
        console.log('  - contentArea存在:', !!contentArea);
        if (!contentArea) {
            console.error('❌ 找不到contentArea元素');
            return;
        }

        // 获取当前选中的日期
        const currentDate = DateManager.selectedDate || new Date();
        console.log('  - 当前日期:', currentDate);
        
        // 获取用户TODO并按时间排序
        const userTodos = this.todos[userId] || [];
        const user = UserManager.getUser(userId);
        console.log('  - 用户信息:', user);
        console.log('  - 用户TODO数量:', userTodos.length);
        console.log('  - 用户TODO详情:', userTodos);
        
        // 获取当前日期的格式化显示
        const currentDateFormatted = this.formatDate(currentDate);
        console.log('  - 格式化日期:', currentDateFormatted);
        
        const panelHtml = `
            <div class="content-panel" id="${userId}-todo-panel">
                <div class="date-controls">
                    <div class="date-center">
                        <div class="today-btn">今天</div>
                        <div class="date-nav-btn">‹</div>
                        <div class="current-date">${currentDateFormatted}</div>
                        <div class="date-nav-btn">›</div>
                    </div>
                    <div class="date-picker-btn">📅</div>
                    <div class="date-picker" id="datePicker">
                        <div class="calendar-header">
                            <button class="calendar-nav">‹</button>
                            <span id="calendarMonth">2025年8月</span>
                            <button class="calendar-nav">›</button>
                        </div>
                        <div class="calendar-grid">
                            <div class="calendar-weekday">日</div>
                            <div class="calendar-weekday">一</div>
                            <div class="calendar-weekday">二</div>
                            <div class="calendar-weekday">三</div>
                            <div class="calendar-weekday">四</div>
                            <div class="calendar-weekday">五</div>
                            <div class="calendar-weekday">六</div>
                        </div>
                        <div class="calendar-grid" id="calendarDays"></div>
                    </div>
                </div>
                <div class="todo-list-container">
                    ${userTodos.map(todo => this.renderTodoItem(todo, userId)).join('')}
                    <button class="new-todo-btn" onclick="TodoManager.showAddTodoForm(${userId})">+ 添加新TODO</button>
                </div>
            </div>
        `;

        console.log('📝 设置contentArea的innerHTML...');
        console.log('📏 panelHtml长度:', panelHtml.length);
        contentArea.innerHTML = panelHtml;
        console.log('✅ TODO面板HTML已设置到contentArea');
    },

    // 渲染单个TODO项
    renderTodoItem(todo, userId) {
        const checkedClass = todo.completed ? 'checked' : '';
        const completedClass = todo.completed ? 'completed' : '';
        const timeSpecificClass = todo.time !== '当天' ? 'specific' : '';
        
        // 根据优先级设置边框颜色
        let priorityClass = '';
        switch (todo.priority) {
            case 'high':
                priorityClass = 'priority-high';
                break;
            case 'medium':
                priorityClass = 'priority-medium';
                break;
            case 'low':
            default:
                priorityClass = 'priority-low';
                break;
        }
        
        // 检查是否有关联用户（同步状态）
        const syncStatus = this.getSyncStatus(userId);
        const syncIndicator = syncStatus.isLinked ? `
            <div class="sync-indicator ${syncStatus.status}" title="${syncStatus.tooltip}">
                <span class="sync-icon">${syncStatus.icon}</span>
            </div>
        ` : '';
        
        return `
            <div class="todo-item todo-card ${priorityClass} ${completedClass}">
                <div class="todo-checkbox ${checkedClass}" onclick="TodoManager.toggleTodo(this)" 
                     data-member="${userId}" data-id="${todo.id}"></div>
                <div class="todo-content" onclick="TodoManager.showEditTodoForm(${todo.id}, ${userId})">
                    <div class="todo-text ${completedClass}">
                        ${todo.text}
                        ${todo.note ? `<div class="todo-note">${todo.note}</div>` : ''}
                    </div>
                    <div class="todo-right">
                        <div class="todo-time ${timeSpecificClass}">${todo.time}</div>
                        <div class="todo-period">${todo.period}</div>
                        <div class="todo-cycle">${todo.cycle}</div>
                        ${syncIndicator}
                    </div>
                </div>
            </div>
        `;
    },

    // 获取同步状态
    getSyncStatus(userId) {
        // 检查用户是否有关联关系
        const user = UserManager.users.find(u => u.id === userId);
        if (!user) {
            return { isLinked: false };
        }
        
        // 检查是否已关联
        if (user.is_linked && user.supervised_app_user) {
            return {
                isLinked: true,
                status: 'synced',
                icon: '🔗',
                tooltip: `已与 ${user.supervised_app_user} 同步`
            };
        }
        
        // 检查是否有待处理的关联请求
        if (this.hasPendingLinkRequest && this.hasPendingLinkRequest(userId)) {
            return {
                isLinked: true,
                status: 'pending',
                icon: '⏳',
                tooltip: '关联请求处理中'
            };
        }
        
        return { isLinked: false };
    },

    // 检查是否有待处理的关联请求
    hasPendingLinkRequest() {
        // 这个方法可以通过全局状态或API调用来实现
        // 暂时返回false，后续可以集成
        return false;
    },

    // 显示同步状态提示
    showSyncStatusToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `sync-toast ${type}`;
        toast.innerHTML = `
            <span class="sync-toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="sync-toast-message">${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        // 显示动画
        setTimeout(() => toast.classList.add('show'), 100);
        
        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    },

    // 切换TODO状态
    async toggleTodo(checkbox) {
        const toggleContext = this._prepareToggleContext(checkbox);
        if (!toggleContext) return;

        try {
            await this._syncToggleToServer(toggleContext);
            this._updateLocalTodoState(toggleContext);
            this._updateTodoUI(toggleContext);
            this._showSyncStatus(toggleContext);
        } catch (error) {
            this._handleToggleError(error, toggleContext);
        }
    },

    // 准备切换上下文
    _prepareToggleContext(checkbox) {
        const todoId = parseInt(checkbox.dataset.id);
        const userId = parseInt(checkbox.dataset.member);
        
        if (!todoId || !userId) return null;

        const todo = this.todos[userId]?.find(t => t.id === todoId);
        if (!todo) return null;

        const currentDate = DateManager.selectedDate || new Date();
        const dateStr = currentDate.toISOString().split('T')[0];

        return {
            todoId,
            userId,
            todo,
            wasCompleted: todo.completed,
            dateStr,
            checkbox
        };
    },

    // 同步切换到服务器
    async _syncToggleToServer(context) {
        const { todoId, userId, wasCompleted, dateStr } = context;
        
        if (WebSocketClient.isConnected) {
            await this._syncViaWebSocket(todoId, userId, dateStr, wasCompleted);
        } else {
            await this._syncViaHTTP(todoId, userId, dateStr, wasCompleted);
        }
    },

    // 通过WebSocket同步
    async _syncViaWebSocket(todoId, userId, dateStr, wasCompleted) {
        if (wasCompleted) {
            await WebSocketClient.todos.uncomplete(todoId, dateStr, userId);
        } else {
            await WebSocketClient.todos.complete(todoId, userId, dateStr);
        }
    },

    // 通过HTTP同步
    async _syncViaHTTP(todoId, userId, dateStr, wasCompleted) {
        if (wasCompleted) {
            await ApiClient.todos.uncomplete(todoId, dateStr, userId);
        } else {
            await ApiClient.todos.complete(todoId, userId, dateStr);
        }
    },

    // 更新本地TODO状态
    _updateLocalTodoState(context) {
        const { todo, userId, dateStr } = context;
        
        todo.completed = !todo.completed;
        
        const cacheKey = `${userId}_${dateStr}`;
        this.todoCache.delete(cacheKey);
        console.log('🧹 TODO状态切换：清除缓存', cacheKey);
    },

    // 更新TODO界面
    _updateTodoUI(context) {
        const { checkbox, todo } = context;
        const todoItem = checkbox.closest('.todo-item');
        const todoContent = checkbox.nextElementSibling;
        const todoText = todoContent?.querySelector('.todo-text');
        
        if (todo.completed) {
            this._markTodoCompleted(checkbox, todoText, todoItem);
        } else {
            this._markTodoIncomplete(checkbox, todoText, todoItem);
        }
    },

    // 标记TODO为已完成
    _markTodoCompleted(checkbox, todoText, todoItem) {
        checkbox.classList.add('checked');
        if (todoText) todoText.classList.add('completed');
        if (todoItem) todoItem.classList.add('completed');
    },

    // 标记TODO为未完成
    _markTodoIncomplete(checkbox, todoText, todoItem) {
        checkbox.classList.remove('checked');
        if (todoText) todoText.classList.remove('completed');
        if (todoItem) todoItem.classList.remove('completed');
    },

    // 显示同步状态
    _showSyncStatus(context) {
        const { userId, todo } = context;
        const syncStatus = this.getSyncStatus(userId);
        
        if (syncStatus.isLinked) {
            const action = todo.completed ? '完成' : '取消完成';
            this.showSyncStatusToast(`${action}状态已同步`, 'success');
        }
    },

    // 处理切换错误
    _handleToggleError(error, context) {
        console.error('切换TODO状态失败:', error);
        context.todo.completed = context.wasCompleted;
        this.showMessage('操作失败: ' + error.message, 'error');
    },

    // 显示添加TODO表单
    showAddTodoForm(userId) {
        const user = UserManager.getUser(userId);
        if (!user) return;
        
        const formHtml = `
            <div class="modal-overlay" id="addTodoModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>为 ${user.display_name || user.username} 添加新TODO</h3>
                        <button class="modal-close" onclick="TodoManager.closeAddTodoForm()">×</button>
                    </div>
                    <form class="todo-form" onsubmit="TodoManager.handleAddTodo(event, ${userId})">
                        <div class="form-group">
                            <label for="todo_title">标题 *</label>
                            <input type="text" id="todo_title" name="title" required maxlength="200" placeholder="例如：吃鱼肝油">
                        </div>
                        <div class="form-group">
                            <label for="todo_start_date">开始日期</label>
                            <input type="date" id="todo_start_date" name="start_date" value="${(DateManager.selectedDate || new Date()).toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label for="todo_description">备注</label>
                            <textarea id="todo_description" name="description" maxlength="1000" placeholder="详细说明（可选）"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="todo_time">提醒时间</label>
                            <select id="todo_time" name="reminder_time">
                                <option value="all_day">当天</option>
                                <option value="06:00">06:00</option>
                                <option value="07:00">07:00</option>
                                <option value="08:00">08:00</option>
                                <option value="09:00">09:00</option>
                                <option value="10:00">10:00</option>
                                <option value="11:00">11:00</option>
                                <option value="12:00">12:00</option>
                                <option value="13:00">13:00</option>
                                <option value="14:00">14:00</option>
                                <option value="15:00">15:00</option>
                                <option value="16:00">16:00</option>
                                <option value="17:00">17:00</option>
                                <option value="18:00">18:00</option>
                                <option value="19:00">19:00</option>
                                <option value="20:00">20:00</option>
                                <option value="21:00">21:00</option>
                                <option value="22:00">22:00</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="todo_priority">优先级</label>
                            <select id="todo_priority" name="priority">
                                <option value="low">低</option>
                                <option value="medium" selected>中</option>
                                <option value="high">高</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="todo_repeat">重复频率</label>
                            <select id="todo_repeat" name="repeat_type" onchange="TodoManager.handleRepeatChange(this)">
                                <option value="none">不重复</option>
                                <option value="daily" selected>每天</option>
                                <option value="every_other_day">隔天</option>
                                <option value="weekly">每周</option>
                                <option value="monthly">每月</option>
                                <option value="yearly">每年</option>
                                <option value="custom">自定义</option>
                            </select>
                        </div>
                        <div class="form-group" id="custom_interval_group" style="display: none;">
                            <label for="custom_interval">自定义间隔</label>
                            <div class="form-row">
                                <input type="number" id="custom_interval" name="custom_interval" min="1" max="365" value="2" style="width: 80px;">
                                <span style="margin-left: 8px;">天一次</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="todo_cycle">重复周期</label>
                            <select id="todo_cycle" name="cycle_type" onchange="TodoManager.handleCycleChange(this)">
                                <option value="long_term" selected>长期</option>
                                <option value="custom">自定义周期</option>
                            </select>
                        </div>
                        <div class="form-group" id="custom_cycle_group" style="display: none;">
                            <label for="cycle_duration">周期时长</label>
                            <div class="form-row" style="display: table !important; width: 100% !important; table-layout: fixed !important; border-collapse: separate !important; border-spacing: 8px 0 !important;">
                                <input type="number" id="cycle_duration" name="cycle_duration" min="1" max="365" value="1" style="display: table-cell !important; width: 60px !important; min-width: 60px !important; max-width: 60px !important; padding: 8px 6px !important; font-size: 14px !important; text-align: center !important; box-sizing: border-box !important; vertical-align: middle !important; border: 1px solid #e1e8ed !important; border-radius: 6px !important; background: white !important;">
                                <select id="cycle_unit" name="cycle_unit" style="display: table-cell !important; width: 60px !important; min-width: 60px !important; max-width: 60px !important; padding: 8px 6px !important; font-size: 14px !important; box-sizing: border-box !important; vertical-align: middle !important; border: 1px solid #e1e8ed !important; border-radius: 6px !important; background: white !important; cursor: pointer !important;">
                                    <option value="days">天</option>
                                    <option value="weeks">周</option>
                                    <option value="months">月</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" onclick="TodoManager.closeAddTodoForm()">取消</button>
                            <button type="submit">添加TODO</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', formHtml);
    },

    // 关闭添加TODO表单
    closeAddTodoForm() {
        const modal = document.getElementById('addTodoModal');
        if (modal) {
            modal.remove();
        }
    },

    // 处理添加TODO表单提交（主入口）
    async handleAddTodo(event, userId) {
        event.preventDefault();
        
        try {
            // 解析表单数据
            const todoData = this._parseAddTodoForm(event.target, userId);
            
            // 创建TODO
            await this._createTodoOnServer(todoData);
            
            // 处理创建成功后的操作
            await this._handleAddTodoSuccess(userId);
            
        } catch (error) {
            this._handleAddTodoError(error);
        }
    },

    // 解析添加TODO表单数据
    _parseAddTodoForm(form, userId) {
        const formData = new FormData(form);
        const repeatType = formData.get('repeat_type') || 'none';
        const customInterval = parseInt(formData.get('custom_interval')) || 1;
        const cycleType = formData.get('cycle_type') || 'long_term';
        const cycleDuration = parseInt(formData.get('cycle_duration')) || null;
        const cycleUnit = formData.get('cycle_unit') || 'days';
        
        console.log('📋 表单数据调试:');
        console.log('  cycleType:', cycleType);
        console.log('  cycleDuration:', cycleDuration);
        console.log('  cycleUnit:', cycleUnit);
        
        // 使用当前选中的日期作为开始日期
        const selectedStartDate = formData.get('start_date') || 
            (DateManager.selectedDate || new Date()).toISOString().split('T')[0];
        
        const todoData = {
            user_id: userId,
            title: formData.get('title'),
            description: formData.get('description') || '',
            reminder_time: formData.get('reminder_time') || 'all_day',
            priority: formData.get('priority') || 'medium',
            repeat_type: repeatType,
            repeat_interval: repeatType === 'custom' ? customInterval : 1,
            cycle_type: cycleType,
            cycle_duration: cycleType === 'custom' ? cycleDuration : null,
            cycle_unit: cycleType === 'custom' ? cycleUnit : 'days',
            start_date: selectedStartDate
        };
        
        console.log('📤 发送到服务器的TODO数据:', todoData);
        return todoData;
    },

    // 在服务器上创建TODO
    async _createTodoOnServer(todoData) {
        if (WebSocketClient.isConnected) {
            return await this._createTodoViaWebSocket(todoData);
        } else {
            return await this._createTodoViaHTTP(todoData);
        }
    },

    // 通过WebSocket创建TODO
    async _createTodoViaWebSocket(todoData) {
        const response = await WebSocketClient.todos.create(todoData);
        if (response.data && response.data.todo) {
            this.convertApiTodoToLocal(response.data.todo);
            console.log('✅ 通过WebSocket创建TODO成功');
            return response;
        } else {
            throw new Error('WebSocket响应格式错误');
        }
    },

    // 通过HTTP创建TODO
    async _createTodoViaHTTP(todoData) {
        const response = await ApiClient.todos.create(todoData);
        if (response.success) {
            this.convertApiTodoToLocal(response.data);
            console.log('✅ 通过HTTP创建TODO成功');
            return response;
        } else {
            throw new Error(response.message || '创建TODO失败');
        }
    },

    // 处理TODO创建成功后的操作
    async _handleAddTodoSuccess(userId) {
        // 关闭表单
        this.closeAddTodoForm();
        
        // 清除缓存并重新加载数据
        this.clearAllRelatedCache(userId);
        const currentDate = DateManager.selectedDate || new Date();
        await this.loadTodosForDate(currentDate, userId);
        
        // 显示成功消息
        this.showMessage('TODO添加成功！', 'success');
    },

    // 处理TODO创建错误
    _handleAddTodoError(error) {
        console.error('添加TODO失败:', error);
        this.showMessage('添加TODO失败: ' + error.message, 'error');
    },

    // 处理重复频率变化
    handleRepeatChange(select) {
        const customGroup = document.getElementById('custom_interval_group');
        if (customGroup) {
            customGroup.style.display = select.value === 'custom' ? 'block' : 'none';
        }
    },

    // 处理重复周期变化
    handleCycleChange(select) {
        const customCycleGroup = document.getElementById('custom_cycle_group');
        if (customCycleGroup) {
            customCycleGroup.style.display = select.value === 'custom' ? 'block' : 'none';
        }
    },

    // 显示编辑TODO表单
    showEditTodoForm(todoId, userId) {
        const todo = this.todos[userId]?.find(t => t.id === todoId);
        if (!todo) return;
        
        const user = UserManager.getUser(userId);
        if (!user) return;
        
        const formHtml = this._generateEditFormHTML(todo, user, todoId, userId);
        document.body.insertAdjacentHTML('beforeend', formHtml);
    },

    // 生成编辑表单HTML
    _generateEditFormHTML(todo, user, todoId, userId) {
        return `
            <div class="modal-overlay" id="editTodoModal">
                <div class="modal-content">
                    ${this._generateEditFormHeader(user)}
                    <form class="todo-form" onsubmit="TodoManager.handleEditTodo(event, '${todoId}', ${userId})">
                        ${this._generateBasicFields(todo)}
                        ${this._generateTimeAndPriorityFields(todo)}
                        ${this._generateRepeatFields(todo)}
                        ${this._generateCycleFields(todo)}
                        ${this._generateFormActions(todoId, userId)}
                    </form>
                </div>
            </div>
        `;
    },

    // 生成表单头部
    _generateEditFormHeader(user) {
        return `
            <div class="modal-header">
                <h3>编辑 ${user.display_name || user.username} 的TODO</h3>
                <button class="modal-close" onclick="TodoManager.closeEditTodoForm()">×</button>
            </div>
        `;
    },

    // 生成基础字段
    _generateBasicFields(todo) {
        return `
            <div class="form-group">
                <label for="edit_todo_title">标题 *</label>
                <input type="text" id="edit_todo_title" name="title" required maxlength="200" value="${todo.text}" placeholder="例如：吃鱼肝油">
            </div>
            <div class="form-group">
                <label for="edit_todo_start_date">开始日期</label>
                <input type="date" id="edit_todo_start_date" name="start_date" value="${todo.createdDate}">
            </div>
            <div class="form-group">
                <label for="edit_todo_description">备注</label>
                <textarea id="edit_todo_description" name="description" maxlength="1000" placeholder="详细说明（可选）">${todo.note || ''}</textarea>
            </div>
        `;
    },

    // 生成时间和优先级字段
    _generateTimeAndPriorityFields(todo) {
        return `
            <div class="form-group">
                <label for="edit_todo_time">提醒时间</label>
                <select id="edit_todo_time" name="reminder_time">
                    ${this._generateTimeOptions(todo.time)}
                </select>
            </div>
            <div class="form-group">
                <label for="edit_todo_priority">优先级</label>
                <select id="edit_todo_priority" name="priority">
                    ${this._generatePriorityOptions(todo.priority)}
                </select>
            </div>
        `;
    },

    // 生成时间选项
    _generateTimeOptions(selectedTime) {
        const timeOptions = [
            { value: 'all_day', label: '当天', compareValue: '当天' },
            ...Array.from({ length: 17 }, (_, i) => {
                const hour = String(i + 6).padStart(2, '0');
                return { value: `${hour}:00`, label: `${hour}:00`, compareValue: `${hour}:00` };
            })
        ];

        return timeOptions.map(option => 
            `<option value="${option.value}" ${selectedTime === option.compareValue ? 'selected' : ''}>${option.label}</option>`
        ).join('');
    },

    // 生成优先级选项
    _generatePriorityOptions(selectedPriority) {
        const priorities = [
            { value: 'low', label: '低' },
            { value: 'medium', label: '中' },
            { value: 'high', label: '高' }
        ];

        return priorities.map(priority => {
            const isSelected = priority.value === selectedPriority || 
                             (priority.value === 'medium' && (!selectedPriority || selectedPriority === 'medium'));
            return `<option value="${priority.value}" ${isSelected ? 'selected' : ''}>${priority.label}</option>`;
        }).join('');
    },

    // 生成重复字段
    _generateRepeatFields(todo) {
        return `
            <div class="form-group">
                <label for="edit_todo_repeat">重复频率</label>
                <select id="edit_todo_repeat" name="repeat_type" onchange="TodoManager.handleEditRepeatChange(this, '${todo.customInterval || 1}')">
                    ${this._generateRepeatOptions(todo.periodType)}
                </select>
            </div>
            <div class="form-group" id="edit_custom_interval_group" style="display: ${todo.periodType === 'custom' ? 'block' : 'none'};">
                <label for="edit_custom_interval">自定义间隔</label>
                <div class="form-row">
                    <input type="number" id="edit_custom_interval" name="custom_interval" min="1" max="365" value="${todo.customInterval || 1}" style="width: 80px;">
                    <span style="margin-left: 8px;">天一次</span>
                </div>
            </div>
        `;
    },

    // 生成重复选项
    _generateRepeatOptions(selectedType) {
        const repeatTypes = [
            { value: 'none', label: '不重复' },
            { value: 'daily', label: '每天' },
            { value: 'every_other_day', label: '隔天' },
            { value: 'weekly', label: '每周' },
            { value: 'monthly', label: '每月' },
            { value: 'yearly', label: '每年' },
            { value: 'custom', label: '自定义' }
        ];

        return repeatTypes.map(type => {
            const isSelected = type.value === selectedType || 
                             (type.value === 'none' && (!selectedType || selectedType === 'none'));
            return `<option value="${type.value}" ${isSelected ? 'selected' : ''}>${type.label}</option>`;
        }).join('');
    },

    // 生成周期字段
    _generateCycleFields(todo) {
        return `
            <div class="form-group">
                <label for="edit_todo_cycle">重复周期</label>
                <select id="edit_todo_cycle" name="cycle_type" onchange="TodoManager.handleEditCycleChange(this, '${todo.cycleDuration || 1}', '${todo.cycleUnit || 'days'}')">
                    ${this._generateCycleOptions(todo.cycleType)}
                </select>
            </div>
            <div class="form-group" id="edit_custom_cycle_group" style="display: ${todo.cycleType === 'custom' ? 'block' : 'none'};">
                <label for="edit_cycle_duration">周期时长</label>
                <div class="form-row" style="display: table !important; width: 100% !important; table-layout: fixed !important; border-collapse: separate !important; border-spacing: 8px 0 !important;">
                    <input type="number" id="edit_cycle_duration" name="cycle_duration" min="1" max="365" value="${todo.cycleDuration || 1}" style="display: table-cell !important; width: 60px !important; min-width: 60px !important; max-width: 60px !important; padding: 8px 6px !important; font-size: 14px !important; text-align: center !important; box-sizing: border-box !important; vertical-align: middle !important; border: 1px solid #e1e8ed !important; border-radius: 6px !important; background: white !important;">
                    <select id="edit_cycle_unit" name="cycle_unit" style="display: table-cell !important; width: 60px !important; min-width: 60px !important; max-width: 60px !important; padding: 8px 6px !important; font-size: 14px !important; box-sizing: border-box !important; vertical-align: middle !important; border: 1px solid #e1e8ed !important; border-radius: 6px !important; background: white !important; cursor: pointer !important;">
                        ${this._generateCycleUnitOptions(todo.cycleUnit)}
                    </select>
                </div>
            </div>
        `;
    },

    // 生成周期选项
    _generateCycleOptions(selectedType) {
        const cycleTypes = [
            { value: 'long_term', label: '长期' },
            { value: 'custom', label: '自定义周期' }
        ];

        return cycleTypes.map(type => {
            const isSelected = type.value === selectedType || 
                             (type.value === 'long_term' && (!selectedType || selectedType === 'long_term'));
            return `<option value="${type.value}" ${isSelected ? 'selected' : ''}>${type.label}</option>`;
        }).join('');
    },

    // 生成周期单位选项
    _generateCycleUnitOptions(selectedUnit) {
        const units = [
            { value: 'days', label: '天' },
            { value: 'weeks', label: '周' },
            { value: 'months', label: '月' }
        ];

        return units.map(unit => 
            `<option value="${unit.value}" ${selectedUnit === unit.value ? 'selected' : ''}>${unit.label}</option>`
        ).join('');
    },

    // 生成表单操作按钮
    _generateFormActions(todoId, userId) {
        return `
            <div class="form-actions">
                <button type="button" class="delete-btn" onclick="TodoManager.deleteTodo('${todoId}', ${userId})">删除</button>
                <button type="button" onclick="TodoManager.closeEditTodoForm()">取消</button>
                <button type="submit">保存</button>
            </div>
        `;
    },

    // 关闭编辑TODO表单
    closeEditTodoForm() {
        const modal = document.getElementById('editTodoModal');
        if (modal) {
            modal.remove();
        }
    },

    // 处理编辑TODO表单提交
    // eslint-disable-next-line no-unused-vars
    async handleEditTodo(event, todoId, _userId) {
        event.preventDefault();
        
        const updateData = this._extractEditFormData(event.target);
        
        try {
            await this._performTodoUpdate(todoId, updateData);
            await this._handleUpdateSuccess();
        } catch (error) {
            this._handleUpdateError(error);
        }
    },

    // 提取编辑表单数据
    _extractEditFormData(form) {
        const formData = new FormData(form);
        const repeatType = formData.get('repeat_type') || 'none';
        const cycleType = formData.get('cycle_type') || 'long_term';
        
        return {
            title: formData.get('title'),
            description: formData.get('description') || '',
            reminder_time: formData.get('reminder_time') || 'all_day',
            priority: formData.get('priority') || 'medium',
            repeat_type: repeatType,
            repeat_interval: this._getRepeatInterval(formData, repeatType),
            cycle_type: cycleType,
            cycle_duration: this._getCycleDuration(formData, cycleType),
            cycle_unit: this._getCycleUnit(formData, cycleType),
            start_date: formData.get('start_date')
        };
    },

    // 获取重复间隔
    _getRepeatInterval(formData, repeatType) {
        if (repeatType === 'custom') {
            return parseInt(formData.get('custom_interval')) || 1;
        }
        return 1;
    },

    // 获取周期持续时间
    _getCycleDuration(formData, cycleType) {
        if (cycleType === 'custom') {
            return parseInt(formData.get('cycle_duration')) || null;
        }
        return null;
    },

    // 获取周期单位
    _getCycleUnit(formData, cycleType) {
        if (cycleType === 'custom') {
            return formData.get('cycle_unit') || 'days';
        }
        return 'days';
    },

    // 执行TODO更新
    async _performTodoUpdate(todoId, updateData) {
        const response = await ApiClient.todos.update(todoId, updateData);
        if (!response.success) {
            throw new Error(response.message || '更新TODO失败');
        }
        console.log('✅ 在服务器更新TODO成功');
    },

    // 处理更新成功
    async _handleUpdateSuccess() {
        this.closeEditTodoForm();
        this._refreshTodoData();
        this.showMessage('TODO更新成功！', 'success');
    },

    // 刷新TODO数据
    async _refreshTodoData() {
        this.clearAllRelatedCache(this.currentUser);
        const currentDate = DateManager.selectedDate || new Date();
        await this.loadTodosForDate(currentDate, this.currentUser);
    },

    // 处理更新错误
    _handleUpdateError(error) {
        console.error('更新TODO失败:', error);
        this.showMessage('更新TODO失败: ' + error.message, 'error');
    },

    // 处理编辑重复频率变化
    handleEditRepeatChange(select, defaultInterval) {
        const customGroup = document.getElementById('edit_custom_interval_group');
        if (customGroup) {
            customGroup.style.display = select.value === 'custom' ? 'block' : 'none';
            if (select.value === 'custom') {
                const intervalInput = document.getElementById('edit_custom_interval');
                if (intervalInput && !intervalInput.value) {
                    intervalInput.value = defaultInterval;
                }
            }
        }
    },

    // 处理编辑重复周期变化
    handleEditCycleChange(select, defaultDuration, defaultUnit) {
        const customCycleGroup = document.getElementById('edit_custom_cycle_group');
        if (customCycleGroup) {
            customCycleGroup.style.display = select.value === 'custom' ? 'block' : 'none';
            if (select.value === 'custom') {
                const durationInput = document.getElementById('edit_cycle_duration');
                const unitSelect = document.getElementById('edit_cycle_unit');
                if (durationInput && !durationInput.value) {
                    durationInput.value = defaultDuration;
                }
                if (unitSelect && !unitSelect.value) {
                    unitSelect.value = defaultUnit;
                }
            }
        }
    },

    // 删除TODO - 智能删除对话框
    async deleteTodo(todoId, userId) {
        const todo = this.todos[userId]?.find(t => t.id == todoId);
        if (!todo) return;

        // 如果是重复任务，显示删除选项对话框
        if (todo.periodType && todo.periodType !== 'none') {
            this.showDeleteOptionsDialog(todoId, userId, todo);
        } else {
            // 一次性任务，直接确认删除
            if (confirm('确定要删除这个TODO吗？')) {
                await this.performDelete(todoId, userId, 'all');
            }
        }
    },

    // 显示删除选项对话框
    showDeleteOptionsDialog(todoId, userId, todo) {
        const currentDate = DateManager.selectedDate || new Date();
        const currentDateStr = this.formatDate(currentDate);
        
        const dialogHtml = `
            <div class="modal-overlay" id="deleteOptionsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>删除重复任务</h3>
                        <button class="modal-close" onclick="TodoManager.closeDeleteOptionsDialog()">×</button>
                    </div>
                    <div class="delete-options-content">
                        <p>这是一个重复任务："${todo.text}"</p>
                        <p>你想要删除：</p>
                        <div class="delete-options">
                            <label class="delete-option">
                                <input type="radio" name="deleteOption" value="single" checked>
                                <span>只删除 ${currentDateStr} 的这个任务</span>
                            </label>
                            <label class="delete-option">
                                <input type="radio" name="deleteOption" value="from_date">
                                <span>删除 ${currentDateStr} 及以后的所有任务</span>
                            </label>
                            <label class="delete-option">
                                <input type="radio" name="deleteOption" value="all">
                                <span>删除所有日期的这个任务</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" onclick="TodoManager.closeDeleteOptionsDialog()">取消</button>
                        <button type="button" class="delete-btn" onclick="TodoManager.confirmDelete(${todoId}, ${userId})">删除</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', dialogHtml);
    },

    // 关闭删除选项对话框
    closeDeleteOptionsDialog() {
        const modal = document.getElementById('deleteOptionsModal');
        if (modal) {
            modal.remove();
        }
    },

    // 确认删除
    async confirmDelete(todoId, userId) {
        const selectedOption = document.querySelector('input[name="deleteOption"]:checked');
        if (!selectedOption) return;

        const deletionType = selectedOption.value;
        const currentDate = DateManager.selectedDate || new Date();
        const deletionDate = currentDate.toISOString().split('T')[0];

        this.closeDeleteOptionsDialog();
        await this.performDelete(todoId, userId, deletionType, deletionDate);
    },

    // 执行删除操作
    async performDelete(todoId, userId, deletionType, deletionDate = null) {
        try {
            // 在服务器删除TODO
            const response = await ApiClient.todos.delete(todoId, deletionType, deletionDate);
            if (response.success) {
                console.log('✅ 在服务器删除TODO成功');
                
                // 清除该用户的所有缓存，因为删除可能影响多个日期（特别是长期重复任务）
                this.clearAllRelatedCache(this.currentUser);
                
                // 重新加载当前日期的TODO数据
                const currentDate = DateManager.selectedDate || new Date();
                await this.loadTodosForDate(currentDate, this.currentUser);
                
                // 关闭编辑表单（如果打开的话）
                this.closeEditTodoForm();
                
                // 显示成功消息
                this.showMessage(response.message || 'TODO删除成功！', 'success');
            } else {
                throw new Error(response.message || '删除TODO失败');
            }
            
        } catch (error) {
            console.error('删除TODO失败:', error);
            this.showMessage('删除TODO失败: ' + error.message, 'error');
        }
    },

    // 注意：日期导航现在由DateManager统一处理

    // 加载指定日期的TODO（优化版，支持缓存）
    async loadTodosForDate(date, userId = null, silent = false, retryCount = 0) {
        const dateStr = date.toISOString().split('T')[0];
        const targetUserId = userId || this.currentUser;
        
        this._logLoadingStart(dateStr, targetUserId, retryCount, silent);
        
        try {
            // 检查缓存
            if (await this._tryLoadFromCache(targetUserId, dateStr, silent)) {
                return;
            }
            
            // 从服务器加载数据
            await this._loadFromServer(targetUserId, userId, dateStr, silent, retryCount);
            
            // 清理缓存和渲染
            this._cleanupCacheAndRender(targetUserId, dateStr, silent);
            
        } catch (error) {
            await this._handleLoadingError(error, date, userId, silent, retryCount, targetUserId, dateStr);
        }
    },

    // 记录加载开始日志
    _logLoadingStart(dateStr, targetUserId, retryCount, silent) {
        if (!silent) {
            console.log('🔄 开始加载指定日期的TODO数据...');
            console.log('📅 目标日期:', dateStr, '用户ID:', targetUserId, '重试次数:', retryCount);
        }
    },

    // 尝试从缓存加载
    async _tryLoadFromCache(targetUserId, dateStr, silent) {
        const cacheKey = `${targetUserId}_${dateStr}`;
        if (!this.todoCache.has(cacheKey)) {
            if (!silent) console.log('🔍 缓存未命中，从服务器加载数据，用户:', targetUserId);
            return false;
        }

        if (!silent) console.log('📦 使用缓存数据，用户:', targetUserId);
        const cachedData = this.todoCache.get(cacheKey);
        this.todos[targetUserId] = [...cachedData];
        
        this._renderIfNeeded(targetUserId, silent);
        this.lastLoadedDate = dateStr;
        return true;
    },

    // 从服务器加载数据
    async _loadFromServer(targetUserId, userId, dateStr, silent, retryCount) {
        const usersToLoad = this._getUsersToLoad(userId, targetUserId);
        
        for (const user of usersToLoad) {
            await this._loadUserTodos(user, dateStr, silent, retryCount);
        }
    },

    // 获取需要加载的用户列表
    _getUsersToLoad(userId, targetUserId) {
        return userId ? 
            [UserManager.getUser(userId)].filter(Boolean) : 
            [UserManager.getUser(targetUserId)].filter(Boolean);
    },

    // 加载单个用户的TODO数据
    async _loadUserTodos(user, dateStr, silent, retryCount) {
        try {
            const todos = await this._fetchUserTodos(user, dateStr, silent);
            this.todos[user.id] = todos;
            
            // 存入缓存
            const userCacheKey = `${user.id}_${dateStr}`;
            this.todoCache.set(userCacheKey, [...todos]);
            
            if (!silent) {
                console.log(`✅ 已加载用户${user.id}在${dateStr}的TODO数据，数量:`, todos.length);
            }
        } catch (error) {
            await this._handleUserLoadError(user, dateStr, error, retryCount, silent);
        }
    },

    // 获取用户TODO数据
    async _fetchUserTodos(user, dateStr, silent) {
        if (WebSocketClient.isConnected) {
            if (!silent) console.log(`🔌 使用WebSocket加载用户${user.id}的TODO数据...`);
            const response = await WebSocketClient.todos.getTodosForDate(user.id, dateStr);
            return response.data.todos.map(todo => this.convertApiTodoToLocal(todo));
        } else {
            if (!silent) console.log(`🌐 使用HTTP加载用户${user.id}的TODO数据...`);
            const response = await ApiClient.todos.getTodosForDate(user.id, dateStr);
            return response.success ? response.data.map(todo => this.convertApiTodoToLocal(todo)) : [];
        }
    },

    // 处理用户加载错误
    // eslint-disable-next-line no-unused-vars
    async _handleUserLoadError(user, dateStr, error, retryCount, _silent) {
        console.warn(`加载用户${user.id}在${dateStr}的TODO失败:`, error.message);
        
        if (this._shouldRetryUserLoad(error, retryCount)) {
            console.log(`🔄 超时重试 ${retryCount + 1}/${this.MAX_RETRIES} 用户${user.id}...`);
            await this._delayRetry(retryCount);
            throw error; // 重新抛出错误以触发整体重试
        }
        
        this.todos[user.id] = [];
    },

    // 判断是否应该重试用户加载
    _shouldRetryUserLoad(error, retryCount) {
        return error.message.includes('请求超时') && retryCount < (this.MAX_RETRIES || 3);
    },

    // 延迟重试
    async _delayRetry(retryCount) {
        const delay = (retryCount + 1) * (this.RETRY_DELAY_BASE || 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
    },

    // 清理缓存并渲染
    _cleanupCacheAndRender(targetUserId, dateStr, silent) {
        this._cleanupCache();
        this._renderIfNeeded(targetUserId, silent);
        this.lastLoadedDate = dateStr;
    },

    // 清理缓存
    _cleanupCache() {
        if (this.todoCache.size > 50) {
            const sortedKeys = Array.from(this.todoCache.keys()).sort();
            const keysToDelete = sortedKeys.slice(0, sortedKeys.length - 50);
            keysToDelete.forEach(key => this.todoCache.delete(key));
        }
    },

    // 如果需要则渲染
    _renderIfNeeded(targetUserId, silent) {
        if (!targetUserId) {
            console.warn('⚠️ 无法确定要渲染哪个用户的TODO面板');
            return;
        }

        const shouldRender = window.GlobalUserState ? 
            GlobalUserState.getCurrentModule() === 'todo' : true;
            
        if (shouldRender) {
            this.renderTodoPanel(targetUserId);
            if (!silent) console.log('✅ TODO面板渲染完成');
        } else if (!silent) {
            console.log('⏸️ 当前不在TODO模块，仅后台同步数据');
        }
    },

    // 处理加载错误
    async _handleLoadingError(error, date, userId, silent, retryCount, targetUserId, dateStr) {
        console.error(`加载用户${targetUserId}在${dateStr}的TODO失败:`, error);
        
        const MAX_RETRIES = this.MAX_RETRIES || 3;
        
        if (this._shouldRetryLoad(error, retryCount, MAX_RETRIES)) {
            await this._retryLoad(date, userId, silent, retryCount, MAX_RETRIES);
            return;
        }
        
        // 最终失败处理
        this._handleFinalLoadError(error, retryCount, MAX_RETRIES, silent);
    },

    // 判断是否应该重试加载
    _shouldRetryLoad(error, retryCount, maxRetries) {
        return error.message.includes('请求超时') && retryCount < maxRetries;
    },

    // 重试加载
    async _retryLoad(date, userId, silent, retryCount, maxRetries) {
        console.log(`🔄 整体超时重试 ${retryCount + 1}/${maxRetries}...`);
        if (!silent) {
            this.showMessage(`请求超时，正在重试 (${retryCount + 1}/${maxRetries})...`, 'warning');
        }
        
        const delay = (retryCount + 1) * (this.RETRY_DELAY_MULTIPLIER || 2000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.loadTodosForDate(date, userId, silent, retryCount + 1);
    },

    // 处理最终加载错误
    _handleFinalLoadError(error, retryCount, maxRetries, silent) {
        const errorMsg = retryCount >= maxRetries ? 
            `加载TODO失败: ${error.message} (已重试${maxRetries}次)` : 
            `加载TODO失败: ${error.message}`;
        
        if (!silent) this.showMessage(errorMsg, 'error');
    },

    // 格式化日期显示
    formatDate(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        const month = months[date.getMonth()];
        const day = date.getDate();
        const weekday = weekdays[date.getDay()];
        
        return `${month} ${day} ${weekday}`;
    },

    // 显示消息
    showMessage(message, type = 'info', duration = 3000) {
        // 如果是重试消息，使用特殊样式
        const isRetry = type === 'warning' && message.includes('重试');
        
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        switch (type) {
            case 'success':
                messageEl.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                messageEl.style.backgroundColor = '#f44336';
                break;
            case 'warning':
                messageEl.style.backgroundColor = '#ff9800';
                break;
            default:
                messageEl.style.backgroundColor = '#2196F3';
        }
        
        // 如果是重试消息，添加加载动画
        if (isRetry) {
            messageEl.innerHTML = `
                <span class="retry-spinner">⏳</span>
                ${message}
            `;
            duration = 10000; // 重试消息显示更久
        }
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, duration);
    },

    // 处理WebSocket广播消息（来自其他设备的操作）
    handleWebSocketBroadcast(type, data) {
        console.log('🔄 处理TODO广播消息:', type, data);
        
        switch (type) {
            case 'TODO_CREATE_BROADCAST':
            case 'TODO_UPDATE_BROADCAST':
            case 'TODO_DELETE_BROADCAST':
                // 清除所有用户的缓存，因为广播可能来自其他设备，影响所有用户
                console.log('🧹 广播消息：清除所有缓存');
                this.clearAllRelatedCache();
                // 重新加载当前日期的TODO数据
                this.loadTodosForDate(DateManager.selectedDate || new Date(), this.currentUser);
                break;
                
            case 'TODO_COMPLETE_BROADCAST':
            case 'TODO_UNCOMPLETE_BROADCAST':
                // 完成状态变化也要清除缓存，确保数据同步
                console.log('🧹 完成状态广播：清除相关用户缓存');
                if (data.userId) {
                    this.clearAllRelatedCache(data.userId);
                } else {
                    this.clearAllRelatedCache();
                }
                // 重新加载当前日期的数据
                this.loadTodosForDate(DateManager.selectedDate || new Date(), this.currentUser);
                break;
                
            case 'TODO_SYNC_UPDATE': {
                // 🔥 关键修复：处理关联用户的实时同步更新
                console.log('🔗 [TODO] 收到Link同步更新:', data);
                
                // 立即清除所有缓存
                console.log('🧹 [TODO] 清除所有缓存以确保数据同步');
                this.clearAllRelatedCache();
                
                // 获取当前日期和用户
                const currentDate = window.DateManager ? window.DateManager.selectedDate : new Date();
                const currentUser = this.currentUser;
                const currentModule = window.GlobalUserState ? window.GlobalUserState.getCurrentModule() : null;
                
                console.log('📅 [TODO] 同步更新信息:', {
                    currentDate: currentDate.toISOString().split('T')[0],
                    currentUser,
                    currentModule,
                    operation: data.operation,
                    fromUser: data.sync?.fromUser
                });
                
                if (currentUser) {
                    // 强制重新加载数据
                    this.loadTodosForDate(currentDate, currentUser, false).then(() => {
                        console.log('✅ [TODO] 同步数据重新加载完成');
                        
                        // 如果当前在TODO模块，确保界面更新
                        if (currentModule === 'todo') {
                            console.log('🎨 [TODO] 重新渲染界面以显示同步数据');
                            this.renderTodoPanel(currentUser);
                        }
                        
                        // 显示同步通知
                        if (data.sync && data.sync.fromUser) {
                            const operationText = {
                                'COMPLETE': '完成',
                                'UNCOMPLETE': '取消完成',
                                'CREATE': '创建',
                                'UPDATE': '更新',
                                'DELETE': '删除'
                            }[data.operation] || data.operation;
                            
                            this.showSyncStatusToast(`${data.sync.fromUser} ${operationText}了待办事项`, 'success');
                        }
                    }).catch(error => {
                        console.error('❌ [TODO] 同步数据重新加载失败:', error);
                    });
                }
                break;
            }
        }
    },

    // 降级到HTTP模式
    fallbackToHTTP() {
        console.log('📡 TODO模块降级到HTTP模式');
        // 目前的实现已经自动处理降级，无需额外操作
    },

    // 清除所有相关缓存 - 彻底清理方法
    clearAllRelatedCache(userId = null) {
        console.log('🧹 开始清除所有相关缓存...', userId ? `用户${userId}` : '所有用户');
        
        if (userId) {
            // 清除指定用户的所有缓存
            const keysToDelete = [];
            for (const key of this.todoCache.keys()) {
                if (key.startsWith(`${userId}_`)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => {
                this.todoCache.delete(key);
                console.log('🗑️ 删除缓存:', key);
            });
            console.log(`✅ 已清除用户${userId}的${keysToDelete.length}个缓存项`);
        } else {
            // 清除所有缓存
            const cacheCount = this.todoCache.size;
            this.todoCache.clear();
            console.log(`✅ 已清除所有${cacheCount}个缓存项`);
        }
    },

    // 清除指定用户指定日期范围的缓存
    clearCacheForDateRange(userId, startDate = null, endDate = null) {
        console.log('🧹 清除日期范围缓存...', {userId, startDate, endDate});
        
        const keysToDelete = [];
        for (const key of this.todoCache.keys()) {
            if (!key.startsWith(`${userId}_`)) continue;
            
            const dateStr = key.split('_')[1];
            if (!startDate && !endDate) {
                // 如果没有指定日期范围，清除该用户所有缓存
                keysToDelete.push(key);
            } else if (startDate && endDate) {
                // 检查日期是否在范围内
                if (dateStr >= startDate && dateStr <= endDate) {
                    keysToDelete.push(key);
                }
            } else if (startDate) {
                // 只有开始日期，清除该日期及以后的缓存
                if (dateStr >= startDate) {
                    keysToDelete.push(key);
                }
            }
        }
        
        keysToDelete.forEach(key => {
            this.todoCache.delete(key);
            console.log('🗑️ 删除范围缓存:', key);
        });
        
        console.log(`✅ 已清除用户${userId}的${keysToDelete.length}个日期范围缓存项`);
    },

    // 绑定事件
    bindEvents() {
        // 用户标签点击事件现在由GlobalUserState统一处理
        // 不需要在这里重复绑定事件
    }
};

// 导出到全局
window.TodoManager = TodoManager;