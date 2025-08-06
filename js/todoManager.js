// TODO管理模块 - 完全重写版本
const TodoManager = {
    currentUser: 1,
    todos: {},
    selectedDate: new Date(),
    isOnline: false,

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
        
        // 渲染界面
        this.renderTodoPanel(this.currentUser);
        this.bindEvents();
        
        console.log('✅ TODO管理器初始化完成');
    },

    // 等待用户管理器初始化完成
    async waitForUserManager() {
        if (UserManager.users.length === 0) {
            await new Promise(resolve => {
                const checkUsers = () => {
                    if (UserManager.users.length > 0) {
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
            
            // 为每个用户加载TODO数据
            for (const user of UserManager.users) {
                const response = await ApiClient.todos.getTodayTodos(user.id);
                if (response.success) {
                    this.todos[user.id] = response.data.map(todo => this.convertApiTodoToLocal(todo));
                } else {
                    console.warn(`加载用户${user.id}的TODO失败:`, response.message);
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
        if (UserManager.users.length > 0) {
            // 按ID排序，选择ID最小的用户（最早添加的用户）
            const sortedUsers = [...UserManager.users].sort((a, b) => a.id - b.id);
            let defaultUser = sortedUsers[0].id;
            
            console.log('🎯 设置默认用户为最早添加的用户:', defaultUser, '(用户名:', sortedUsers[0].username, ')');
            console.log('📋 所有用户按ID排序:', sortedUsers.map(u => `ID:${u.id}(${u.username})`).join(', '));
            this.currentUser = defaultUser;
            
            // 同步到全局状态，这会触发UI更新
            if (window.GlobalUserState) {
                GlobalUserState.setCurrentUser(defaultUser);
            }
            
            // 确保UI正确更新
            setTimeout(() => {
                if (window.UserManager) {
                    UserManager.renderUserTabs();
                }
            }, 100);
        } else {
            console.log('📝 没有用户，等待用户添加');
            this.currentUser = null;
            
            // 显示空状态
            this.showEmptyUserState();
        }
    },

    // 处理全局状态变化
    handleGlobalStateChange(type, data) {
        console.log('📢 TODO管理器收到全局状态变化:', type, data);
        
        if (type === 'userChanged') {
            const newUserId = data.userId;
            if (this.currentUser !== newUserId) {
                this.currentUser = newUserId;
                // 只有当前模块是todo时才渲染
                if (GlobalUserState.getCurrentModule() === 'todo') {
                    console.log('✅ 当前是TODO模块，渲染TODO内容');
                    this.renderTodoPanel(newUserId);
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
        console.log('🎨 渲染TODO面板，用户ID:', userId);
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) {
            console.error('找不到contentArea元素');
            return;
        }

        // 获取当前选中的日期
        const currentDate = DateManager.selectedDate || new Date();
        
        // 获取用户TODO并按时间排序
        const userTodos = this.todos[userId] || [];
        const user = UserManager.getUser(userId);
        
        // 获取当前日期的格式化显示
        const currentDateFormatted = this.formatDate(currentDate);
        
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

        contentArea.innerHTML = panelHtml;
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
                    </div>
                </div>
            </div>
        `;
    },

    // 切换TODO状态
    async toggleTodo(checkbox) {
        const todoId = parseInt(checkbox.dataset.id);
        const userId = parseInt(checkbox.dataset.member);
        
        if (!todoId || !userId) return;

        // 找到对应的todo项
        const todo = this.todos[userId]?.find(t => t.id === todoId);
        if (!todo) return;

        const wasCompleted = todo.completed;
        const currentDate = DateManager.selectedDate || new Date();
        const dateStr = currentDate.toISOString().split('T')[0];
        
        try {
            // 同步到服务器
            if (wasCompleted) {
                await ApiClient.todos.uncomplete(todoId, dateStr);
            } else {
                await ApiClient.todos.complete(todoId, userId, dateStr);
            }

            // 切换本地状态
            todo.completed = !todo.completed;
            
            // 更新UI
            const todoItem = checkbox.closest('.todo-item');
            const todoContent = checkbox.nextElementSibling;
            const todoText = todoContent?.querySelector('.todo-text');
            
            if (todo.completed) {
                checkbox.classList.add('checked');
                if (todoText) todoText.classList.add('completed');
                if (todoItem) todoItem.classList.add('completed');
            } else {
                checkbox.classList.remove('checked');
                if (todoText) todoText.classList.remove('completed');
                if (todoItem) todoItem.classList.remove('completed');
            }
            
        } catch (error) {
            console.error('切换TODO状态失败:', error);
            // 恢复原状态
            todo.completed = wasCompleted;
            this.showMessage('操作失败: ' + error.message, 'error');
        }
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
                        <div class="form-row">
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
                            <div class="form-row">
                                <input type="number" id="cycle_duration" name="cycle_duration" min="1" max="365" value="1" style="width: 80px;">
                                <select id="cycle_unit" name="cycle_unit" style="width: 80px; margin-left: 8px;">
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

    // 处理添加TODO表单提交
    async handleAddTodo(event, userId) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const repeatType = formData.get('repeat_type') || 'none';
        const customInterval = parseInt(formData.get('custom_interval')) || 1;
        const cycleType = formData.get('cycle_type') || 'long_term';
        const cycleDuration = parseInt(formData.get('cycle_duration')) || null;
        const cycleUnit = formData.get('cycle_unit') || 'days';
        
        console.log('📋 表单数据调试:');
        console.log('  cycleType:', cycleType);
        console.log('  cycleDuration:', cycleDuration);
        console.log('  cycleUnit:', cycleUnit);
        
        // 使用当前选中的日期作为开始日期，如果用户修改了日期则使用用户选择的日期
        const selectedStartDate = formData.get('start_date') || (DateManager.selectedDate || new Date()).toISOString().split('T')[0];
        
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

        try {
            // 在服务器创建TODO
            const response = await ApiClient.todos.create(todoData);
            if (response.success) {
                const newTodo = this.convertApiTodoToLocal(response.data);
                console.log('✅ 在服务器创建TODO成功');
                
                // 关闭表单
                this.closeAddTodoForm();
                
                // 重新加载当前日期的TODO数据，这样会正确显示/隐藏TODO
                await this.loadTodosForDate(DateManager.selectedDate || new Date());
                
                // 显示成功消息
                this.showMessage('TODO添加成功！', 'success');
            } else {
                throw new Error(response.message || '创建TODO失败');
            }
            
        } catch (error) {
            console.error('添加TODO失败:', error);
            this.showMessage('添加TODO失败: ' + error.message, 'error');
        }
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
        
        const formHtml = `
            <div class="modal-overlay" id="editTodoModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>编辑 ${user.display_name || user.username} 的TODO</h3>
                        <button class="modal-close" onclick="TodoManager.closeEditTodoForm()">×</button>
                    </div>
                    <form class="todo-form" onsubmit="TodoManager.handleEditTodo(event, '${todoId}', ${userId})">
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
                        <div class="form-row">
                            <div class="form-group">
                                <label for="edit_todo_time">提醒时间</label>
                                <select id="edit_todo_time" name="reminder_time">
                                    <option value="all_day" ${todo.time === '当天' ? 'selected' : ''}>当天</option>
                                    <option value="06:00" ${todo.time === '06:00' ? 'selected' : ''}>06:00</option>
                                    <option value="07:00" ${todo.time === '07:00' ? 'selected' : ''}>07:00</option>
                                    <option value="08:00" ${todo.time === '08:00' ? 'selected' : ''}>08:00</option>
                                    <option value="09:00" ${todo.time === '09:00' ? 'selected' : ''}>09:00</option>
                                    <option value="10:00" ${todo.time === '10:00' ? 'selected' : ''}>10:00</option>
                                    <option value="11:00" ${todo.time === '11:00' ? 'selected' : ''}>11:00</option>
                                    <option value="12:00" ${todo.time === '12:00' ? 'selected' : ''}>12:00</option>
                                    <option value="13:00" ${todo.time === '13:00' ? 'selected' : ''}>13:00</option>
                                    <option value="14:00" ${todo.time === '14:00' ? 'selected' : ''}>14:00</option>
                                    <option value="15:00" ${todo.time === '15:00' ? 'selected' : ''}>15:00</option>
                                    <option value="16:00" ${todo.time === '16:00' ? 'selected' : ''}>16:00</option>
                                    <option value="17:00" ${todo.time === '17:00' ? 'selected' : ''}>17:00</option>
                                    <option value="18:00" ${todo.time === '18:00' ? 'selected' : ''}>18:00</option>
                                    <option value="19:00" ${todo.time === '19:00' ? 'selected' : ''}>19:00</option>
                                    <option value="20:00" ${todo.time === '20:00' ? 'selected' : ''}>20:00</option>
                                    <option value="21:00" ${todo.time === '21:00' ? 'selected' : ''}>21:00</option>
                                    <option value="22:00" ${todo.time === '22:00' ? 'selected' : ''}>22:00</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="edit_todo_priority">优先级</label>
                                <select id="edit_todo_priority" name="priority">
                                    <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>低</option>
                                    <option value="medium" ${!todo.priority || todo.priority === 'medium' ? 'selected' : ''}>中</option>
                                    <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>高</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="edit_todo_repeat">重复频率</label>
                            <select id="edit_todo_repeat" name="repeat_type" onchange="TodoManager.handleEditRepeatChange(this, '${todo.customInterval || 1}')">
                                <option value="none" ${!todo.periodType || todo.periodType === 'none' ? 'selected' : ''}>不重复</option>
                                <option value="daily" ${todo.periodType === 'daily' ? 'selected' : ''}>每天</option>
                                <option value="every_other_day" ${todo.periodType === 'every_other_day' ? 'selected' : ''}>隔天</option>
                                <option value="weekly" ${todo.periodType === 'weekly' ? 'selected' : ''}>每周</option>
                                <option value="monthly" ${todo.periodType === 'monthly' ? 'selected' : ''}>每月</option>
                                <option value="yearly" ${todo.periodType === 'yearly' ? 'selected' : ''}>每年</option>
                                <option value="custom" ${todo.periodType === 'custom' ? 'selected' : ''}>自定义</option>
                            </select>
                        </div>
                        <div class="form-group" id="edit_custom_interval_group" style="display: ${todo.periodType === 'custom' ? 'block' : 'none'};">
                            <label for="edit_custom_interval">自定义间隔</label>
                            <div class="form-row">
                                <input type="number" id="edit_custom_interval" name="custom_interval" min="1" max="365" value="${todo.customInterval || 1}" style="width: 80px;">
                                <span style="margin-left: 8px;">天一次</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="edit_todo_cycle">重复周期</label>
                            <select id="edit_todo_cycle" name="cycle_type" onchange="TodoManager.handleEditCycleChange(this, '${todo.cycleDuration || 1}', '${todo.cycleUnit || 'days'}')">
                                <option value="long_term" ${!todo.cycleType || todo.cycleType === 'long_term' ? 'selected' : ''}>长期</option>
                                <option value="custom" ${todo.cycleType === 'custom' ? 'selected' : ''}>自定义周期</option>
                            </select>
                        </div>
                        <div class="form-group" id="edit_custom_cycle_group" style="display: ${todo.cycleType === 'custom' ? 'block' : 'none'};">
                            <label for="edit_cycle_duration">周期时长</label>
                            <div class="form-row">
                                <input type="number" id="edit_cycle_duration" name="cycle_duration" min="1" max="365" value="${todo.cycleDuration || 1}" style="width: 80px;">
                                <select id="edit_cycle_unit" name="cycle_unit" style="width: 80px; margin-left: 8px;">
                                    <option value="days" ${todo.cycleUnit === 'days' ? 'selected' : ''}>天</option>
                                    <option value="weeks" ${todo.cycleUnit === 'weeks' ? 'selected' : ''}>周</option>
                                    <option value="months" ${todo.cycleUnit === 'months' ? 'selected' : ''}>月</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="delete-btn" onclick="TodoManager.deleteTodo('${todoId}', ${userId})">删除</button>
                            <button type="button" onclick="TodoManager.closeEditTodoForm()">取消</button>
                            <button type="submit">保存</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', formHtml);
    },

    // 关闭编辑TODO表单
    closeEditTodoForm() {
        const modal = document.getElementById('editTodoModal');
        if (modal) {
            modal.remove();
        }
    },

    // 处理编辑TODO表单提交
    async handleEditTodo(event, todoId, userId) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const repeatType = formData.get('repeat_type') || 'none';
        const customInterval = parseInt(formData.get('custom_interval')) || 1;
        const cycleType = formData.get('cycle_type') || 'long_term';
        const cycleDuration = parseInt(formData.get('cycle_duration')) || null;
        const cycleUnit = formData.get('cycle_unit') || 'days';
        
        const updateData = {
            title: formData.get('title'),
            description: formData.get('description') || '',
            reminder_time: formData.get('reminder_time') || 'all_day',
            priority: formData.get('priority') || 'medium',
            repeat_type: repeatType,
            repeat_interval: repeatType === 'custom' ? customInterval : 1,
            cycle_type: cycleType,
            cycle_duration: cycleType === 'custom' ? cycleDuration : null,
            cycle_unit: cycleType === 'custom' ? cycleUnit : 'days',
            start_date: formData.get('start_date')
        };

        try {
            // 在服务器更新TODO
            const response = await ApiClient.todos.update(todoId, updateData);
            if (response.success) {
                console.log('✅ 在服务器更新TODO成功');
                
                // 关闭表单
                this.closeEditTodoForm();
                
                // 重新加载当前日期的TODO数据，这样会正确显示/隐藏TODO
                await this.loadTodosForDate(DateManager.selectedDate || new Date());
                
                // 显示成功消息
                this.showMessage('TODO更新成功！', 'success');
            } else {
                throw new Error(response.message || '更新TODO失败');
            }
            
        } catch (error) {
            console.error('更新TODO失败:', error);
            this.showMessage('更新TODO失败: ' + error.message, 'error');
        }
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
                
                // 重新加载当前日期的TODO数据
                await this.loadTodosForDate(DateManager.selectedDate || new Date());
                
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

    // 加载指定日期的TODO
    async loadTodosForDate(date) {
        try {
            const dateStr = date.toISOString().split('T')[0];
            
            // 为每个用户加载指定日期的TODO
            for (const user of UserManager.users) {
                const response = await ApiClient.todos.getTodosForDate(user.id, dateStr);
                if (response.success) {
                    this.todos[user.id] = response.data.map(todo => this.convertApiTodoToLocal(todo));
                }
            }
            
            // 重新渲染当前用户的TODO面板
            this.renderTodoPanel(this.currentUser);
            
        } catch (error) {
            console.error('加载日期TODO失败:', error);
            this.showMessage('加载TODO失败: ' + error.message, 'error');
        }
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
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
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
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    },

    // 绑定事件
    bindEvents() {
        // 用户标签点击事件现在由GlobalUserState统一处理
        // 不需要在这里重复绑定事件
    }
};

// 导出到全局
window.TodoManager = TodoManager;