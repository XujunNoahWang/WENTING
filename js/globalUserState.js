// 全局用户状态管理器
const GlobalUserState = {
    currentUserId: null,
    currentModule: 'todo', // 'todo' 或 'notes'
    listeners: [],

    // 初始化
    init() {
        console.log('🌐 初始化全局用户状态管理器');
        
        // 只恢复模块状态，用户状态由TodoManager的setDefaultUser决定
        const savedModule = localStorage.getItem('wenting_current_module');
        
        if (savedModule) {
            this.currentModule = savedModule;
        }
        
        // 不从localStorage恢复用户ID，让TodoManager决定默认用户
        console.log('📍 初始化状态:', {
            currentUserId: this.currentUserId,
            currentModule: this.currentModule
        });
        console.log('🔄 用户ID将由TodoManager的setDefaultUser方法设置');
    },

    // 设置当前用户
    setCurrentUser(userId) {
        console.log('👤 切换当前用户:', this.currentUserId, '->', userId);
        
        if (this.currentUserId !== userId) {
            this.currentUserId = userId;
            
            // 保存到localStorage
            localStorage.setItem('wenting_current_user_id', userId.toString());
            
            // 通知所有监听器
            this.notifyListeners('userChanged', { userId: userId });
        }
        
        // 无论是否相同，都更新UI（确保样式正确）
        console.log('🎨 强制更新用户选择器UI...');
        this.updateUserSelectorUI();
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
        // 如果当前没有用户ID，尝试从localStorage恢复
        if (this.currentUserId === null) {
            const savedUserId = localStorage.getItem('wenting_current_user_id');
            if (savedUserId && !isNaN(parseInt(savedUserId))) {
                this.currentUserId = parseInt(savedUserId);
                console.log('💾 从localStorage恢复用户ID:', this.currentUserId);
            }
        }
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
        console.log('🎨 更新用户选择器UI，当前用户:', this.currentUserId);
        
        // 直接更新样式，不重新渲染整个HTML（避免丢失状态）
        console.log('📝 直接更新用户标签样式');
        const userTabs = document.querySelectorAll('.sidebar-tab');
        console.log('🔍 找到', userTabs.length, '个用户标签');
        
        userTabs.forEach(tab => {
            const tabUserId = parseInt(tab.dataset.tab);
            console.log('🏷️ 处理标签，用户ID:', tabUserId, '当前用户:', this.currentUserId);
            
            if (tabUserId === this.currentUserId) {
                console.log('✅ 设置为选中状态:', tabUserId);
                tab.classList.add('active');
                
                // 更新CSS变量用于颜色条
                if (window.UserManager) {
                    const user = UserManager.getUser(tabUserId);
                    if (user) {
                        tab.style.setProperty('--user-color', user.avatar_color || '#1d9bf0');
                        console.log('🎨 应用选中样式，颜色条:', user.avatar_color);
                    }
                }
            } else {
                console.log('❌ 设置为未选中状态:', tabUserId);
                tab.classList.remove('active');
                
                // 保持颜色条颜色不变
                if (window.UserManager) {
                    const user = UserManager.getUser(tabUserId);
                    if (user) {
                        tab.style.setProperty('--user-color', user.avatar_color || '#1d9bf0');
                    }
                }
            }
        });
    },

    // 绑定用户选择器事件
    bindUserSelectorEvents() {
        console.log('🔗 开始绑定用户选择器事件...');
        
        // 使用事件委托，避免重复绑定问题
        const sidebar = document.querySelector('.left-sidebar');
        if (sidebar) {
            // 移除已存在的事件监听器
            sidebar.removeEventListener('click', this._sidebarClickHandler);
            
            // 绑定事件委托
            this._sidebarClickHandler = (e) => {
                const tab = e.target.closest('.sidebar-tab');
                if (tab) {
                    e.preventDefault();
                    e.stopPropagation();
                    const userId = parseInt(tab.dataset.tab);
                    if (userId && !isNaN(userId)) {
                        console.log('🖱️ 用户按钮点击，切换到用户:', userId);
                        this.setCurrentUser(userId);
                    }
                }
            };
            
            sidebar.addEventListener('click', this._sidebarClickHandler);
            console.log('🔗 用户选择器事件委托绑定完成');
        }
    }
};

// 导出到全局
window.GlobalUserState = GlobalUserState;