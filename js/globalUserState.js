// 全局用户状态管理器
const GlobalUserState = {
    currentUserId: null,
    currentModule: 'todo', // 'todo' 或 'notes'
    listeners: [],

    // 初始化
    init() {
        console.log('🌐 初始化全局用户状态管理器');
        
        // 从localStorage恢复状态
        const savedUserId = localStorage.getItem('wenting_current_user_id');
        const savedModule = localStorage.getItem('wenting_current_module');
        
        if (savedUserId) {
            this.currentUserId = parseInt(savedUserId);
        }
        
        if (savedModule) {
            this.currentModule = savedModule;
        }
        
        console.log('📍 恢复状态:', {
            currentUserId: this.currentUserId,
            currentModule: this.currentModule
        });
    },

    // 设置当前用户
    setCurrentUser(userId) {
        console.log('👤 切换当前用户:', userId);
        
        if (this.currentUserId !== userId) {
            this.currentUserId = userId;
            
            // 保存到localStorage
            localStorage.setItem('wenting_current_user_id', userId.toString());
            
            // 通知所有监听器
            this.notifyListeners('userChanged', { userId: userId });
            
            // 更新用户选择器UI
            this.updateUserSelectorUI();
        }
    },

    // 设置当前模块
    setCurrentModule(module) {
        console.log('📋 切换当前模块:', module);
        
        if (this.currentModule !== module) {
            this.currentModule = module;
            
            // 保存到localStorage
            localStorage.setItem('wenting_current_module', module);
            
            // 通知所有监听器
            this.notifyListeners('moduleChanged', { module: module });
        }
    },

    // 获取当前用户ID
    getCurrentUser() {
        return this.currentUserId;
    },

    // 获取当前模块
    getCurrentModule() {
        return this.currentModule;
    },

    // 添加监听器
    addListener(callback) {
        this.listeners.push(callback);
    },

    // 移除监听器
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    },

    // 通知所有监听器
    notifyListeners(type, data) {
        console.log('📢 通知监听器:', type, data);
        this.listeners.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('❌ 监听器回调错误:', error);
            }
        });
    },

    // 更新用户选择器UI
    updateUserSelectorUI() {
        // 如果UserManager存在，重新渲染用户标签以确保样式正确
        if (window.UserManager && UserManager.renderUserTabs) {
            UserManager.renderUserTabs();
        } else {
            // 备用方案：直接更新active类
            const userTabs = document.querySelectorAll('.sidebar-tab');
            userTabs.forEach(tab => {
                const tabUserId = parseInt(tab.dataset.tab);
                if (tabUserId === this.currentUserId) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
        }
    },

    // 绑定用户选择器事件
    bindUserSelectorEvents() {
        const userTabs = document.querySelectorAll('.sidebar-tab');
        userTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const userId = parseInt(tab.dataset.tab);
                if (userId && !isNaN(userId)) {
                    this.setCurrentUser(userId);
                }
            });
        });
    }
};

// 导出到全局
window.GlobalUserState = GlobalUserState;