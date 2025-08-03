// TODO管理模块
const TodoManager = {
    currentUser: 1, // 默认用户ID
    todos: {},
    isOnline: false,

    async init() {
        // 检查后端连接
        this.isOnline = await ApiClient.testConnection();
        
        // 等待用户管理器初始化完成
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

        // 设置默认用户
        if (UserManager.users.length > 0) {
            this.currentUser = UserManager.users[0].id;
        }

        if (this.isOnline) {
            await this.loadTodosFromAPI();
        } else {
            this.loadTodosFromLocal();
        }
        
        this.renderTodoPanel(this.currentUser);
        this.bindEvents();
        this.initializeDateRanges();
    },

    // 从API加载TODO数据
    async loadTodosFromAPI() {
        try {
            // 为每个用户加载TODO数据
            for (const user of UserManager.users) {
                const response = await ApiClient.todos.getTodayTodos(user.id);
                if (response.success) {
                    this.todos[user.id] = response.data.map(todo => this.convertApiTodoToLocal(todo));
                }
            }
            this.saveTodosToLocal(); // 同时保存到本地作为备份
            console.log('✅ 从服务器加载TODO数据成功');
        } catch (error) {
            console.error('从服务器加载TODO数据失败:', error);
            this.loadTodosFromLocal(); // 降级到本地数据
        }
    },

    // 从本地存储加载TODO数据
    loadTodosFromLocal() {
        const savedTodos = localStorage.getItem('wenting_todos');
        if (savedTodos) {
            this.todos = JSON.parse(savedTodos);
            // 修复缺少创建日期的旧数据
            this.fixMissingCreatedDates();
        } else {
            // 使用默认TODO数据
            const today = new Date().toISOString().split('T')[0];
            this.todos = {
                1: [ // dad
                    {
                        id: '1',
                        text: '早上吃鱼肝油',
                        note: '帮助降低肌酐，分多次饮用',
                        time: '08:00',
                        period: '每天',
                        periodType: 'daily',
                        completed: false,
                        priority: 'medium',
                        createdDate: today
                    },
                    {
                        id: '2',
                        text: '吃一粒善存',
                        note: '',
                        time: '09:00',
                        period: '每天',
                        periodType: 'daily',
                        completed: false,
                        priority: 'medium',
                        createdDate: today
                    }
                ],
                2: [ // mom
                    {
                        id: '3',
                        text: '进行10分钟冥想',
                        note: '可以使用冥想app引导',
                        time: '07:00',
                        period: '每天',
                        periodType: 'daily',
                        completed: false,
                        priority: 'medium',
                        createdDate: today
                    }
                ],
                3: [ // kid
                    {
                        id: '4',
                        text: '吃维生素D',
                        note: '',
                        time: '09:00',
                        period: '每天',
                        periodType: 'daily',
                        completed: false,
                        priority: 'medium',
                        createdDate: today
                    }
                ]
            };
        }
        console.log('📱 使用本地TODO数据');
    },

    // 保存TODO数据到本地
    saveTodosToLocal() {
        localStorage.setItem('wenting_todos', JSON.stringify(this.todos));
    },

    // 将API TODO格式转换为本地格式
    convertApiTodoToLocal(apiTodo) {
        return {
            id: apiTodo.id.toString(),
            text: apiTodo.title,
            note: apiTodo.description || '',
            time: apiTodo.reminder_time || '当天',
            period: this.getPeriodText(apiTodo.pattern_type, apiTodo.interval_value),
            periodType: apiTodo.pattern_type || 'none',
            completed: apiTodo.is_completed_today || false,
            priority: apiTodo.priority || 'medium',
            customInterval: apiTodo.interval_value > 1 ? apiTodo.interval_value : null,
            createdDate: apiTodo.start_date || new Date().toISOString().split('T')[0]
        };
    },

    // 将本地TODO格式转换为API格式
    convertLocalTodoToApi(localTodo, userId) {
        return {
            user_id: userId,
            title: localTodo.text,
            description: localTodo.note || '',
            reminder_time: localTodo.time !== '当天' ? localTodo.time : null,
            reminder_type: localTodo.time !== '当天' ? 'specific_time' : 'all_day',
            priority: localTodo.priority || 'medium',
            start_date: new Date().toISOString().split('T')[0],
            repeat_pattern: this.getRepeatPatternFromPeriod(localTodo.periodType, localTodo.customInterval)
        };
    },

    // 根据周期类型获取周期文本
    getPeriodText(patternType, intervalValue = 1) {
        switch (patternType) {
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
                return `每${intervalValue}天`;
            case 'none':
            default:
                return '一次性';
        }
    },

    // 根据周期类型获取重复模式
    getRepeatPatternFromPeriod(periodType, customInterval = 1) {
        switch (periodType) {
            case 'daily':
                return { pattern_type: 'daily', interval_value: 1 };
            case 'every_other_day':
                return { pattern_type: 'daily', interval_value: 2 };
            case 'weekly':
                return { pattern_type: 'weekly', interval_value: 1 };
            case 'monthly':
                return { pattern_type: 'monthly', interval_value: 1 };
            case 'yearly':
                return { pattern_type: 'yearly', interval_value: 1 };
            case 'custom':
                return { pattern_type: 'daily', interval_value: customInterval };
            case 'none':
            default:
                return { pattern_type: 'none', interval_value: 1 };
        }
    },

    // 切换用户
    switchUser(userId) {
        // 确保userId是数字类型
        this.currentUser = parseInt(userId);
        this.renderTodoPanel(this.currentUser);
        
        // 重新渲染用户标签以更新选中状态
        UserManager.renderUserTabs();
    },

    // 判断TODO在指定日期是否应该显示
    shouldShowTodoOnDate(todo, targetDate) {
        if (!todo.periodType || todo.periodType === 'none') {
            // 一次性任务，只在创建日期显示
            const createdDate = new Date(todo.createdDate || Date.now());
            return this.isSameDate(targetDate, createdDate);
        }

        // 获取TODO的开始日期（创建日期）
        const startDate = new Date(todo.createdDate || Date.now());
        
        // 如果目标日期早于开始日期，不显示
        if (targetDate < startDate) {
            return false;
        }

        // 计算天数差
        const daysDiff = Math.floor((targetDate - startDate) / (1000 * 60 * 60 * 24));

        switch (todo.periodType) {
            case 'daily':
                return true; // 每天都显示
                
            case 'every_other_day':
                return daysDiff % 2 === 0; // 隔天显示
                
            case 'weekly':
                return daysDiff % 7 === 0; // 每周显示
                
            case 'monthly':
                // 每月同一天显示
                return targetDate.getDate() === startDate.getDate();
                
            case 'yearly':
                // 每年同一天显示
                return targetDate.getDate() === startDate.getDate() && 
                       targetDate.getMonth() === startDate.getMonth();
                       
            case 'custom':
                const interval = todo.customInterval || 2;
                return daysDiff % interval === 0;
                
            default:
                return false;
        }
    },

    // 判断两个日期是否是同一天
    isSameDate(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    },

    // 修复缺少创建日期的旧数据
    fixMissingCreatedDates() {
        const today = new Date().toISOString().split('T')[0];
        let needsSave = false;
        
        Object.keys(this.todos).forEach(userId => {
            this.todos[userId].forEach(todo => {
                if (!todo.createdDate) {
                    todo.createdDate = today;
                    needsSave = true;
                }
                if (!todo.priority) {
                    todo.priority = 'medium';
                    needsSave = true;
                }
            });
        });
        
        if (needsSave) {
            this.saveTodosToLocal();
        }
    },

    // 过滤当前日期应该显示的TODO
    filterTodosForDate(todos, targetDate) {
        return todos.filter(todo => this.shouldShowTodoOnDate(todo, targetDate));
    },

    // 按时间排序TODO列表
    sortTodosByTime(todos) {
        return [...todos].sort((a, b) => {
            // 将时间转换为可比较的数值
            const getTimeValue = (todo) => {
                if (!todo.time || todo.time === '当天') {
                    return 9999; // 当天的项目排在最后
                }
                
                // 将时间字符串转换为分钟数 (如 "08:30" -> 8*60+30 = 510)
                const [hours, minutes] = todo.time.split(':').map(Number);
                return hours * 60 + (minutes || 0);
            };
            
            const timeA = getTimeValue(a);
            const timeB = getTimeValue(b);
            
            // 如果时间相同，按优先级排序（高优先级在前）
            if (timeA === timeB) {
                const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
                const priorityA = priorityOrder[a.priority] || 1;
                const priorityB = priorityOrder[b.priority] || 1;
                
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                
                // 如果时间和优先级都相同，按创建时间排序
                return (a.id || 0) - (b.id || 0);
            }
            
            return timeA - timeB;
        });
    },

    // 渲染TODO面板
    renderTodoPanel(userId) {
        console.log('渲染TODO面板，用户ID:', userId);
        const contentArea = Utils.$('#contentArea');
        if (!contentArea) {
            console.error('找不到contentArea元素');
            return;
        }

        // 获取当前选中的日期
        const currentDate = DateManager.selectedDate || new Date();
        
        // 过滤当前日期应该显示的TODO，然后按时间排序
        const allUserTodos = this.todos[userId] || [];
        const todosForDate = this.filterTodosForDate(allUserTodos, currentDate);
        const userTodos = this.sortTodosByTime(todosForDate);
        const user = UserManager.getUser(userId);
        
        const panelHtml = `
            <div class="content-panel" id="${userId}-todo-panel">
                <div class="filter-controls">
                    <div class="filter-switch" onclick="FilterManager.toggleFilter('moveCompleted')">
                        <div class="switch" id="${userId}MoveCompletedSwitch"></div>
                        <span>已完成排后</span>
                    </div>
                    <div class="filter-switch" onclick="FilterManager.toggleFilter('hideCompleted')">
                        <div class="switch" id="${userId}HideCompletedSwitch"></div>
                        <span>隐藏已完成</span>
                    </div>
                </div>
                <div class="date-controls">
                    <div class="date-center">
                        <div class="date-nav-btn" onclick="DateManager.changeDate(-1)">‹</div>
                        <div class="current-date">Aug 3</div>
                        <div class="date-nav-btn" onclick="DateManager.changeDate(1)">›</div>
                    </div>
                    <div class="date-picker-btn" onclick="DateManager.toggleDatePicker()">📅</div>
                    <div class="date-picker" id="datePicker">
                        <div class="calendar-header">
                            <button class="calendar-nav" onclick="DateManager.changeMonth(-1)">‹</button>
                            <span id="calendarMonth">2025年8月</span>
                            <button class="calendar-nav" onclick="DateManager.changeMonth(1)">›</button>
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
                    <a href="#" class="new-todo-btn" onclick="TodoManager.addNewTodo(${userId})">+ New todo</a>
                </div>
            </div>
        `;

        contentArea.innerHTML = panelHtml;
        
        // 重新绑定日期管理器事件
        DateManager.bindEvents();
    },

    // 渲染单个TODO项
    renderTodoItem(todo, userId) {
        const timeOrderAttr = todo.timeOrder ? `data-time-order="${todo.timeOrder}"` : '';
        const frequencyAttr = todo.frequency ? `data-frequency="${todo.frequency}"` : '';
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
            <div class="todo-item todo-card ${priorityClass}" ${timeOrderAttr} ${frequencyAttr}>
                <div class="todo-checkbox ${checkedClass}" onclick="TodoManager.toggleTodo(this)" 
                     data-member="${userId}" data-id="${todo.id}"></div>
                <div class="todo-content" onclick="TodoManager.editTodo('${todo.id}', ${userId})">
                    <div class="todo-text ${completedClass}">
                        ${todo.text}
                        ${todo.note ? `<div class="todo-note">${todo.note}</div>` : ''}
                    </div>
                    <div class="todo-right">
                        <div class="todo-time ${timeSpecificClass}">${todo.time}</div>
                        <div class="todo-period ${todo.periodType}">${todo.period}</div>
                    </div>
                </div>
            </div>
        `;
    },

    // 切换TODO状态
    async toggleTodo(checkbox) {
        const todoId = checkbox.dataset.id;
        const userId = parseInt(checkbox.dataset.member);
        
        if (!todoId || !userId) return;

        // 找到对应的todo项
        const todo = this.todos[userId]?.find(t => t.id === todoId);
        if (!todo) return;

        const wasCompleted = todo.completed;
        
        try {
            if (this.isOnline) {
                // 同步到服务器
                if (wasCompleted) {
                    await ApiClient.todos.uncomplete(todoId);
                } else {
                    await ApiClient.todos.complete(todoId, userId);
                }
            }

            // 切换本地状态
            todo.completed = !todo.completed;
            
            // 更新UI
            const todoContent = checkbox.nextElementSibling;
            const todoText = todoContent?.querySelector('.todo-text');
            
            if (todo.completed) {
                checkbox.classList.add('checked');
                if (todoText) todoText.classList.add('completed');
            } else {
                checkbox.classList.remove('checked');
                if (todoText) todoText.classList.remove('completed');
            }

            // 保存数据
            this.saveTodosToLocal();
            
            // 重新应用筛选
            setTimeout(() => {
                if (FilterManager && FilterManager.applyFilters) {
                    FilterManager.applyFilters();
                }
            }, 50);
            
        } catch (error) {
            console.error('切换TODO状态失败:', error);
            // 恢复原状态
            todo.completed = wasCompleted;
            UserManager.showMessage('操作失败: ' + error.message, 'error');
        }
    },

    // 添加新TODO
    async addNewTodo(userId) {
        const user = UserManager.getUser(userId);
        if (!user) return;
        
        this.showAddTodoForm(userId, user.display_name || user.username);
    },

    // 显示添加TODO表单
    showAddTodoForm(userId, userName) {
        const formHtml = `
            <div class="modal-overlay" id="addTodoModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>为 ${userName} 添加新TODO</h3>
                        <button class="modal-close" onclick="TodoManager.closeAddTodoForm()">×</button>
                    </div>
                    <form class="todo-form" onsubmit="TodoManager.handleAddTodo(event, ${userId})">
                        <div class="form-group">
                            <label for="todo_title">标题 *</label>
                            <input type="text" id="todo_title" name="title" required maxlength="200" placeholder="例如：吃鱼肝油">
                        </div>
                        <div class="form-group">
                            <label for="todo_description">备注</label>
                            <textarea id="todo_description" name="description" maxlength="1000" placeholder="详细说明（可选）"></textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="todo_time">提醒时间</label>
                                <select id="todo_time" name="reminder_time">
                                    <option value="">当天</option>
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
                            <select id="todo_repeat" name="repeat_pattern" onchange="TodoManager.handleRepeatChange(this)">
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

    // 编辑TODO
    async editTodo(todoId, userId) {
        const todo = this.todos[userId]?.find(t => t.id === todoId);
        if (!todo) return;
        
        const user = UserManager.getUser(userId);
        if (!user) return;
        
        this.showEditTodoForm(todoId, userId, todo, user.display_name || user.username);
    },

    // 显示编辑TODO表单
    showEditTodoForm(todoId, userId, todo, userName) {
        const formHtml = `
            <div class="modal-overlay" id="editTodoModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>编辑 ${userName} 的TODO</h3>
                        <button class="modal-close" onclick="TodoManager.closeEditTodoForm()">×</button>
                    </div>
                    <form class="todo-form" onsubmit="TodoManager.handleEditTodo(event, '${todoId}', ${userId})">
                        <div class="form-group">
                            <label for="edit_todo_title">标题 *</label>
                            <input type="text" id="edit_todo_title" name="title" required maxlength="200" value="${todo.text}" placeholder="例如：吃鱼肝油">
                        </div>
                        <div class="form-group">
                            <label for="edit_todo_description">备注</label>
                            <textarea id="edit_todo_description" name="description" maxlength="1000" placeholder="详细说明（可选）">${todo.note || ''}</textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="edit_todo_time">提醒时间</label>
                                <select id="edit_todo_time" name="reminder_time">
                                    <option value="" ${!todo.time || todo.time === '当天' ? 'selected' : ''}>当天</option>
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
                            <select id="edit_todo_repeat" name="repeat_pattern" onchange="TodoManager.handleEditRepeatChange(this, '${todo.customInterval || 2}')">
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
                                <input type="number" id="edit_custom_interval" name="custom_interval" min="1" max="365" value="${todo.customInterval || 2}" style="width: 80px;">
                                <span style="margin-left: 8px;">天一次</span>
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
        const repeatPattern = formData.get('repeat_pattern') || 'none';
        const customInterval = parseInt(formData.get('custom_interval')) || 2;
        
        const updateData = {
            text: formData.get('title'),
            note: formData.get('description') || '',
            time: formData.get('reminder_time') || '当天',
            priority: formData.get('priority') || 'medium',
            periodType: repeatPattern,
            customInterval: repeatPattern === 'custom' ? customInterval : null,
            period: this.getPeriodText(repeatPattern, customInterval)
        };

        try {
            if (this.isOnline) {
                // 尝试在服务器更新TODO
                const apiData = this.convertLocalTodoToApi({...updateData, id: todoId}, userId);
                const response = await ApiClient.todos.update(todoId, apiData);
                if (!response.success) {
                    throw new Error(response.message || '更新TODO失败');
                }
                console.log('✅ 在服务器更新TODO成功');
            }

            // 更新本地TODO数据
            const todo = this.todos[userId]?.find(t => t.id === todoId);
            if (todo) {
                Object.assign(todo, updateData);
                this.saveTodosToLocal();
                
                // 重新渲染TODO面板
                this.renderTodoPanel(userId);
                
                // 关闭表单
                this.closeEditTodoForm();
                
                // 显示成功消息
                UserManager.showMessage('TODO更新成功！', 'success');
            }
            
        } catch (error) {
            console.error('更新TODO失败:', error);
            UserManager.showMessage('更新TODO失败: ' + error.message, 'error');
        }
    },

    // 删除TODO
    async deleteTodo(todoId, userId) {
        if (!confirm('确定要删除这个TODO吗？')) {
            return;
        }

        try {
            if (this.isOnline) {
                // 尝试在服务器删除TODO
                const response = await ApiClient.todos.delete(todoId);
                if (!response.success) {
                    throw new Error(response.message || '删除TODO失败');
                }
                console.log('✅ 在服务器删除TODO成功');
            }

            // 从本地删除TODO
            const todoIndex = this.todos[userId]?.findIndex(t => t.id === todoId);
            if (todoIndex > -1) {
                this.todos[userId].splice(todoIndex, 1);
                this.saveTodosToLocal();
                
                // 重新渲染TODO面板
                this.renderTodoPanel(userId);
                
                // 关闭表单
                this.closeEditTodoForm();
                
                // 显示成功消息
                UserManager.showMessage('TODO删除成功！', 'success');
            }
            
        } catch (error) {
            console.error('删除TODO失败:', error);
            UserManager.showMessage('删除TODO失败: ' + error.message, 'error');
        }
    },

    // 处理重复频率变化
    handleRepeatChange(selectElement) {
        const customGroup = document.getElementById('custom_interval_group');
        if (selectElement.value === 'custom') {
            customGroup.style.display = 'block';
        } else {
            customGroup.style.display = 'none';
        }
    },

    // 处理编辑时重复频率变化
    handleEditRepeatChange(selectElement, currentInterval) {
        const customGroup = document.getElementById('edit_custom_interval_group');
        if (selectElement.value === 'custom') {
            customGroup.style.display = 'block';
        } else {
            customGroup.style.display = 'none';
        }
    },

    // 处理添加TODO表单提交
    async handleAddTodo(event, userId) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const repeatPattern = formData.get('repeat_pattern') || 'none';
        const customInterval = parseInt(formData.get('custom_interval')) || 2;
        
        const todoData = {
            user_id: userId,
            title: formData.get('title'),
            description: formData.get('description') || '',
            reminder_time: formData.get('reminder_time') || null,
            reminder_type: formData.get('reminder_time') ? 'specific_time' : 'all_day',
            priority: formData.get('priority') || 'medium',
            start_date: new Date().toISOString().split('T')[0],
            repeat_pattern: this.getRepeatPatternFromPeriod(repeatPattern, customInterval)
        };

        try {
            let newTodo;
            
            if (this.isOnline) {
                // 尝试在服务器创建TODO
                const response = await ApiClient.todos.create(todoData);
                if (response.success) {
                    newTodo = this.convertApiTodoToLocal(response.data);
                    console.log('✅ 在服务器创建TODO成功');
                } else {
                    throw new Error(response.message || '创建TODO失败');
                }
            } else {
                // 离线模式，创建本地TODO
                newTodo = {
                    id: Date.now().toString(), // 临时ID
                    text: todoData.title,
                    note: todoData.description,
                    time: todoData.reminder_time || '当天',
                    period: this.getPeriodText(repeatPattern, customInterval),
                    periodType: repeatPattern,
                    customInterval: repeatPattern === 'custom' ? customInterval : null,
                    completed: false,
                    priority: todoData.priority,
                    createdDate: new Date().toISOString().split('T')[0] // 添加创建日期
                };
            }

            // 添加到本地TODO列表
            if (!this.todos[userId]) {
                this.todos[userId] = [];
            }
            this.todos[userId].push(newTodo);
            this.saveTodosToLocal();
            
            // 重新渲染TODO面板
            this.renderTodoPanel(userId);
            
            // 关闭表单
            this.closeAddTodoForm();
            
            // 显示成功消息
            UserManager.showMessage('TODO添加成功！', 'success');
            
        } catch (error) {
            console.error('添加TODO失败:', error);
            UserManager.showMessage('添加TODO失败: ' + error.message, 'error');
        }
    },

    // 初始化日期范围显示
    initializeDateRanges() {
        setTimeout(() => {
            const periodElements = Utils.$$('.todo-period.temporary');
            periodElements.forEach(periodEl => {
                const periodText = periodEl.textContent;
                const dateRange = Utils.calculateDateRange(periodText);
                if (dateRange) {
                    periodEl.innerHTML = `${periodText}<br><span class="todo-date-range">${dateRange}</span>`;
                }
            });
        }, 100);
    },

    // 绑定事件
    bindEvents() {
        // 侧边栏切换
        Utils.$$('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const userId = tab.dataset.tab;
                if (userId) {
                    this.switchUser(userId);
                }
            });
        });
    }
};

// 全局函数（保持向后兼容）
function toggleTodo(checkbox) {
    TodoManager.toggleTodo(checkbox);
}

function addNewTodo(userId) {
    TodoManager.addNewTodo(userId);
}