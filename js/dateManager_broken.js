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
        
        // 更新所有日期控制栏的显示
        Utils.$$('.current-date').forEach(el => {
            el.textContent = formatted.full;
        });
        
        // 更新todo项目的显示
        this.filterTodosByDate();
    },

    // 根据日期过滤todo项目
    filterTodosByDate() {
        // 通知TodoManager重新渲染当前用户的TODO面板
        if (typeof TodoManager !== 'undefined' && TodoManager.currentUser) {
            TodoManager.renderTodoPanel(TodoManager.currentUser);
        }
    },

    // 日期切换
    changeDate(direction) {
        this.selectedDate.setDate(this.selectedDate.getDate() + direction);
        this.updateSelectedDate();
    },

    // 切换日历显示
    toggleDatePicker() {
        const picker = Utils.$('#datePicker');
        const isVisible = picker && picker.classList.contains('show');
        
        if (isVisible) {
            picker.classList.remove('show');
        } else {
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

        // 延迟绑定事件，确保DOM元素已渲染
        setTimeout(() => {
            this.bindDateNavigation();
        }, 100);
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

function toggleDatePicker() {
    DateManager.toggleDatePicker();
}

function changeMonth(direction) {
    DateManager.changeMonth(direction);
}