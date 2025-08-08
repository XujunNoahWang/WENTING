// 日期管理模块
const DateManager = {
    selectedDate: new Date(),
    calendarDate: new Date(),
    // 添加优化标记
    isChangingDate: false,
    currentDateElements: null,

    init() {
        this.updateCurrentDate();
        this.updateSelectedDate();
        this.bindEvents();
        // 预缓存DOM元素
        this.currentDateElements = Utils.$$('.current-date');
    },

    // 更新当前日期显示
    updateCurrentDate() {
        const now = new Date();
        const formatted = Utils.formatDate(now);
        
        // 更新weather栏的日期显示
        const currentDateEl = Utils.$('#currentDate');
        const weekdayEl = Utils.$('.weather-date-weekday');
        
        if (currentDateEl) {
            currentDateEl.textContent = formatted.full;
        }
        if (weekdayEl) {
            weekdayEl.textContent = formatted.weekday;
        }
    },

    // 更新选择的日期显示（优化版）
    updateSelectedDate() {
        const formatted = Utils.formatDate(this.selectedDate);
        
        // 使用缓存的DOM元素，避免重复查询
        if (!this.currentDateElements) {
            this.currentDateElements = Utils.$$('.current-date');
        }
        
        if (this.currentDateElements && this.currentDateElements.length > 0) {
            this.currentDateElements.forEach(el => {
                if (el && typeof el.textContent !== 'undefined') {
                    el.textContent = formatted.full;
                }
            });
        }
        
        // 如果不是通过changeDate触发的，才更新TODO显示
        // 避免双重渲染
        if (!this.isChangingDate) {
            this.filterTodosByDate();
        }
    },

    // 根据日期过滤todo项目
    filterTodosByDate() {
        // 通知TodoManager重新渲染当前用户的TODO面板
        // 但是要确保用户数据已经加载完成，避免过早渲染
        if (typeof TodoManager !== 'undefined' && 
            TodoManager.currentUser && 
            typeof UserManager !== 'undefined' && 
            UserManager.users && 
            UserManager.users.length > 0) {
            
            console.log('📅 DateManager触发TODO面板重新渲染，用户:', TodoManager.currentUser);
            TodoManager.renderTodoPanel(TodoManager.currentUser);
        } else {
            console.log('📅 DateManager跳过TODO面板渲染，条件不满足:');
            console.log('  - TodoManager存在:', typeof TodoManager !== 'undefined');
            console.log('  - currentUser存在:', !!TodoManager?.currentUser);
            console.log('  - UserManager存在:', typeof UserManager !== 'undefined');
            console.log('  - 用户数据已加载:', UserManager?.users?.length > 0);
        }
    },

    // 日期切换（优化版）
    changeDate(direction) {
        // 设置标记，避免双重渲染
        this.isChangingDate = true;
        
        this.selectedDate.setDate(this.selectedDate.getDate() + direction);
        
        // 立即更新日期显示（不触发TODO渲染）
        this.updateSelectedDate();
        
        // 检查TodoManager的缓存
        const dateStr = this.selectedDate.toISOString().split('T')[0];
        const currentUser = window.GlobalUserState?.getCurrentUser() || window.TodoManager?.currentUser;
        const cacheKey = `${currentUser}_${dateStr}`;
        
        if (window.TodoManager && currentUser && window.TodoManager.todoCache.has(cacheKey)) {
            // 使用TodoManager的缓存数据快速渲染
            const cachedData = window.TodoManager.todoCache.get(cacheKey);
            window.TodoManager.todos[currentUser] = [...cachedData]; // 创建副本
            window.TodoManager.renderTodoPanel(currentUser);
            console.log('📅 DateManager使用缓存快速渲染，用户:', currentUser);
        }
        
        // 异步加载最新数据（不阻塞UI）
        if (window.TodoManager && typeof window.TodoManager.loadTodosForDate === 'function') {
            window.TodoManager.selectedDate = this.selectedDate;
            // 传递正确的用户ID，确保加载正确用户的数据
            const targetUser = window.GlobalUserState?.getCurrentUser() || window.TodoManager?.currentUser;
            window.TodoManager.loadTodosForDate(this.selectedDate, targetUser, true);
        }
        
        // 重置标记
        this.isChangingDate = false;
    },

    // 返回今天
    goToToday() {
        console.log('goToToday被调用');
        this.selectedDate = new Date();
        console.log('重置为今天:', this.selectedDate);
        this.updateSelectedDate();
        
        // 通知TodoManager重新加载数据
        if (window.TodoManager && typeof window.TodoManager.loadTodosForDate === 'function') {
            window.TodoManager.selectedDate = this.selectedDate;
            window.TodoManager.loadTodosForDate(this.selectedDate);
        }
    },

    // 切换日历显示
    toggleDatePicker() {
        console.log('toggleDatePicker 被调用');
        const picker = Utils.$('#datePicker');
        console.log('找到日历元素:', picker);
        const isVisible = picker && picker.classList.contains('show');
        console.log('日历当前可见状态:', isVisible);
        
        if (isVisible) {
            console.log('隐藏日历');
            picker.classList.remove('show');
        } else {
            console.log('显示日历');
            this.calendarDate = new Date(this.selectedDate);
            this.updateCalendar();
            if (picker) {
                picker.classList.add('show');
            }
        }
    },

    // 更改日历月份
    changeMonth(direction) {
        this.calendarDate.setMonth(this.calendarDate.getMonth() + direction);
        this.updateCalendar();
    },

    // 更新日历显示
    updateCalendar() {
        const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();
        
        // 更新月份标题
        const monthEl = Utils.$('#calendarMonth');
        if (monthEl) {
            monthEl.textContent = `${year}年${months[month]}`;
        }
        
        // 生成日历日期
        const firstDay = new Date(year, month, 1);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        const calendarDays = Utils.$('#calendarDays');
        if (calendarDays) {
            calendarDays.innerHTML = '';
            
            for (let i = 0; i < 42; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                
                const dayButton = document.createElement('button');
                dayButton.className = 'calendar-day';
                dayButton.textContent = date.getDate();
                
                // 检查是否是当前月份
                if (date.getMonth() !== month) {
                    dayButton.classList.add('other-month');
                }
                
                // 检查是否是选中的日期
                if (date.toDateString() === this.selectedDate.toDateString()) {
                    dayButton.classList.add('selected');
                }
                
                dayButton.onclick = () => this.selectDate(date);
                calendarDays.appendChild(dayButton);
            }
        }
    },

    // 选择日期
    selectDate(date) {
        this.selectedDate = new Date(date);
        this.updateSelectedDate();
        this.toggleDatePicker();
        
        // 通知TodoManager重新加载数据
        if (window.TodoManager && typeof window.TodoManager.loadTodosForDate === 'function') {
            window.TodoManager.selectedDate = this.selectedDate;
            window.TodoManager.loadTodosForDate(this.selectedDate);
        }
    },

    // 绑定事件
    bindEvents() {
        // 点击外部关闭日历
        document.addEventListener('click', (event) => {
            const picker = Utils.$('#datePicker');
            const pickerBtn = event.target.closest('.date-picker-btn');
            
            if (picker && !picker.contains(event.target) && !pickerBtn) {
                picker.classList.remove('show');
            }
        });

        // 使用事件委托，避免重复绑定
        this.bindEventsWithDelegation();
    },

    // 使用事件委托绑定事件
    bindEventsWithDelegation() {
        // 使用事件委托绑定今天按钮
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('today-btn')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('今天按钮被点击');
                this.goToToday();
            }
        });

        // 使用事件委托绑定日期导航按钮
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('date-nav-btn')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('日期导航按钮被点击:', e.target.textContent);
                const direction = e.target.textContent === '‹' ? -1 : 1;
                this.changeDate(direction);
            }
        });

        // 使用事件委托绑定日历切换按钮
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('date-picker-btn')) {
                console.log('日历按钮被点击！');
                e.preventDefault();
                e.stopPropagation();
                this.toggleDatePicker();
            }
        });

        // 使用事件委托绑定月份导航按钮
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('calendar-nav')) {
                e.preventDefault();
                e.stopPropagation();
                const direction = e.target.textContent === '‹' ? -1 : 1;
                this.changeMonth(direction);
            }
        });
    },

    // 绑定日期导航事件
    bindDateNavigation() {
        // 绑定日期导航按钮
        const dateNavBtns = Utils.$$('.date-nav-btn');
        console.log('找到日期导航按钮:', dateNavBtns.length);
        dateNavBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('日期导航按钮被点击:', e.target.textContent);
                const direction = e.target.textContent === '‹' ? -1 : 1;
                this.changeDate(direction);
            });
        });

        // 绑定日历切换按钮
        const pickerBtns = Utils.$$('.date-picker-btn');
        console.log('找到日历切换按钮:', pickerBtns.length);
        pickerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.toggleDatePicker();
            });
        });

        // 绑定月份导航
        const calendarNavBtns = Utils.$$('.calendar-nav');
        console.log('找到月份导航按钮:', calendarNavBtns.length);
        calendarNavBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const direction = e.target.textContent === '‹' ? -1 : 1;
                this.changeMonth(direction);
            });
        });
    }
};

// 全局函数（保持向后兼容）
function changeDate(direction) {
    DateManager.changeDate(direction);
}

function goToToday() {
    DateManager.goToToday();
}

function toggleDatePicker() {
    DateManager.toggleDatePicker();
}

function changeMonth(direction) {
    DateManager.changeMonth(direction);
}