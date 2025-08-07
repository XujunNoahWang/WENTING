// 日期管理模块
const DateManager = {
    selectedDate: new Date(),
    calendarDate: new Date(),

    init() {
        this.updateCurrentDate();
        this.updateSelectedDate();
        this.bindEvents();
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

    // 更新选择的日期显示
    updateSelectedDate() {
        const formatted = Utils.formatDate(this.selectedDate);
        console.log('更新日期显示:', formatted.full, '当前选中日期:', this.selectedDate);
        
        // 更新所有日期控制栏的显示
        const dateElements = Utils.$$('.current-date');
        console.log('找到日期显示元素:', dateElements?.length || 0);
        
        if (dateElements && dateElements.length > 0) {
            dateElements.forEach(el => {
                if (el && typeof el.textContent !== 'undefined') {
                    console.log('更新元素:', el, '原文本:', el.textContent, '新文本:', formatted.full);
                    el.textContent = formatted.full;
                }
            });
        }
        
        // 更新todo项目的显示
        this.filterTodosByDate();
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

    // 日期切换
    changeDate(direction) {
        console.log('changeDate被调用，方向:', direction);
        this.selectedDate.setDate(this.selectedDate.getDate() + direction);
        console.log('新的选中日期:', this.selectedDate);
        this.updateSelectedDate();
        
        // 通知TodoManager重新加载数据
        if (window.TodoManager && typeof window.TodoManager.loadTodosForDate === 'function') {
            window.TodoManager.selectedDate = this.selectedDate;
            window.TodoManager.loadTodosForDate(this.selectedDate);
        }
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