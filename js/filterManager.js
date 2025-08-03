// 过滤管理模块
const FilterManager = {
    filterState: {
        moveCompleted: false,
        hideCompleted: false
    },

    init() {
        this.loadFilterState();
        this.updateSwitchUI();
    },

    // 加载过滤状态
    loadFilterState() {
        const savedState = localStorage.getItem('wenting_filter_state');
        if (savedState) {
            this.filterState = JSON.parse(savedState);
        }
    },

    // 保存过滤状态
    saveFilterState() {
        localStorage.setItem('wenting_filter_state', JSON.stringify(this.filterState));
    },

    // 切换过滤器
    toggleFilter(filterType) {
        this.filterState[filterType] = !this.filterState[filterType];
        this.saveFilterState();
        this.updateSwitchUI();
        this.applyFilters();
    },

    // 更新开关UI状态
    updateSwitchUI() {
        Utils.$$('.switch').forEach(switchEl => {
            const id = switchEl.id;
            if (id.includes('MoveCompleted')) {
                if (this.filterState.moveCompleted) {
                    switchEl.classList.add('active');
                } else {
                    switchEl.classList.remove('active');
                }
            } else if (id.includes('HideCompleted')) {
                if (this.filterState.hideCompleted) {
                    switchEl.classList.add('active');
                } else {
                    switchEl.classList.remove('active');
                }
            }
        });
    },

    // 应用过滤规则
    applyFilters() {
        Utils.$$('.content-panel:not(.hidden)').forEach(panel => {
            const todoItems = Array.from(panel.querySelectorAll('.todo-item'));
            
            // 按时间排序
            const sortedItems = todoItems.sort((a, b) => {
                const orderA = parseInt(a.dataset.timeOrder) || 999;
                const orderB = parseInt(b.dataset.timeOrder) || 999;
                return orderA - orderB;
            });
            
            // 应用筛选规则 - 使用显示/隐藏而不是移除DOM元素
            sortedItems.forEach(item => {
                const isCompleted = item.querySelector('.todo-checkbox')?.classList.contains('checked');
                
                if (this.filterState.hideCompleted && isCompleted) {
                    item.style.display = 'none';
                } else {
                    item.style.display = 'flex';
                }
            });
            
            // 重新排序DOM元素
            let itemsToOrder;
            if (this.filterState.moveCompleted) {
                // 已完成的排到最后
                const completed = sortedItems.filter(item => 
                    item.querySelector('.todo-checkbox')?.classList.contains('checked'));
                const uncompleted = sortedItems.filter(item => 
                    !item.querySelector('.todo-checkbox')?.classList.contains('checked'));
                itemsToOrder = [...uncompleted, ...completed];
            } else {
                // 按时间排序
                itemsToOrder = sortedItems;
            }
            
            // 获取容器
            const container = panel.querySelector('.todo-list-container');
            if (container) {
                // 重新排序DOM元素（保持new-todo-btn在最后）
                const newTodoBtn = container.querySelector('.new-todo-btn');
                itemsToOrder.forEach(item => {
                    container.insertBefore(item, newTodoBtn);
                });
            }
        });
    }
};

// 全局函数（保持向后兼容）
function toggleFilter(filterType) {
    FilterManager.toggleFilter(filterType);
}