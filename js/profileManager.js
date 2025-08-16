// Profile管理器
const ProfileManager = {
    currentAppUser: null,
    profileData: null,
    isOnline: false,

    async init() {
        console.log('👤 初始化Profile管理器...');
        
        // 确保 ApiClient 已加载
        if (typeof ApiClient === 'undefined') {
            console.error('❌ ApiClient 未定义，请检查脚本加载顺序');
            return;
        }
        
        // 检查后端连接
        this.isOnline = await ApiClient.testConnection();
        
        if (!this.isOnline) {
            console.error('❌ 无法连接到服务器');
            return;
        }
        
        // 获取当前登录用户
        this.currentAppUser = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : localStorage.getItem('wenting_current_app_user');
        
        if (!this.currentAppUser) {
            console.error('❌ 用户未登录');
            return;
        }
        
        console.log('✅ Profile管理器初始化完成，当前用户:', this.currentAppUser);
    },

    // 加载用户资料数据
    async loadProfileData() {
        try {
            console.log('📡 正在加载用户资料...');
            const response = await ApiClient.auth.getProfile(this.currentAppUser);
            
            if (response.success) {
                this.profileData = response.data;
                console.log('✅ 用户资料加载成功:', this.profileData);
                return this.profileData;
            } else {
                throw new Error(response.message || '加载用户资料失败');
            }
        } catch (error) {
            console.error('❌ 加载用户资料失败:', error);
            throw error;
        }
    },

    // 渲染Profile页面
    async renderProfilePanel() {
        console.log('🎨 开始渲染Profile页面');
        
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) {
            console.error('❌ 找不到内容区域');
            return;
        }

        // 隐藏左侧边栏
        this.hideLeftSidebar();

        try {
            // 显示加载状态
            contentArea.innerHTML = `
                <div class="profile-content-panel">
                    <div class="profile-loading">
                        <div class="loading-spinner"></div>
                        <p>正在加载用户资料...</p>
                    </div>
                </div>
            `;

            // 加载用户数据
            await this.loadProfileData();

            // 渲染Profile内容
            const profileHtml = this.generateProfileHTML();
            contentArea.innerHTML = profileHtml;

            // 绑定事件
            this.bindProfileEvents();

            console.log('✅ Profile页面渲染完成');
        } catch (error) {
            console.error('❌ 渲染Profile页面失败:', error);
            
            // 显示错误状态
            contentArea.innerHTML = `
                <div class="profile-content-panel">
                    <div class="profile-error">
                        <div class="error-icon">❌</div>
                        <h3>加载失败</h3>
                        <p>${error.message}</p>
                        <button class="btn btn-primary" onclick="ProfileManager.renderProfilePanel()">重试</button>
                    </div>
                </div>
            `;
        }
    },

    // 隐藏左侧边栏
    hideLeftSidebar() {
        const leftSidebar = document.querySelector('.left-sidebar');
        const contentArea = document.querySelector('.content-area');
        
        if (leftSidebar) {
            leftSidebar.style.display = 'none';
        }
        
        if (contentArea) {
            contentArea.style.width = '100%';
            contentArea.style.marginLeft = '0';
        }
        
        console.log('🎨 已隐藏左侧边栏');
    },

    // 显示左侧边栏（当离开Profile页面时调用）
    showLeftSidebar() {
        const leftSidebar = document.querySelector('.left-sidebar');
        const contentArea = document.querySelector('.content-area');
        
        if (leftSidebar) {
            leftSidebar.style.display = '';
        }
        
        if (contentArea) {
            contentArea.style.width = '';
            contentArea.style.marginLeft = '';
        }
        
        console.log('🎨 已显示左侧边栏');
    },

    // 生成Profile页面HTML
    generateProfileHTML() {
        if (!this.profileData) {
            return '<div class="profile-error">用户数据未加载</div>';
        }

        const { username, created_at, stats } = this.profileData;
        const createdDate = new Date(created_at);
        const formattedDate = createdDate.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = createdDate.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // 计算注册天数
        const daysSinceRegistration = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));

        return `
            <div class="profile-content-panel">
                <div class="profile-content">
                    <div class="profile-section">
                        <div class="stats-list-section">
                            <h4 class="stats-list-title">📊 基本信息</h4>
                            <div class="stats-list">
                                <div class="stats-item">
                                    <span class="stats-label">用户名</span>
                                    <span class="stats-value">${username}</span>
                                </div>
                                <div class="stats-item">
                                    <span class="stats-label">注册日期</span>
                                    <span class="stats-value">${formattedDate} ${formattedTime}</span>
                                </div>
                                <div class="stats-item">
                                    <span class="stats-label">使用天数</span>
                                    <span class="stats-value">${daysSinceRegistration} 天</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="profile-section">
                        <h3 class="section-title">使用统计</h3>
                        
                        <!-- 管理成员列表 -->
                        <div class="stats-list-section">
                            <h4 class="stats-list-title">👥 被管理成员 (${this.profileData.managed_users.length}个)</h4>
                            <div class="stats-list">
                                ${this.generateManagedUsersList()}
                            </div>
                        </div>

                        <!-- 任务统计 -->
                        <div class="stats-list-section">
                            <h4 class="stats-list-title">📝 任务管理</h4>
                            <div class="stats-list">
                                <div class="stats-item highlight">
                                    <span class="stats-label">进行中任务</span>
                                    <span class="stats-value">${stats.active_todos || 0}</span>
                                </div>
                                <div class="stats-item">
                                    <span class="stats-label">重复任务</span>
                                    <span class="stats-value">${stats.repeat_todos || 0}</span>
                                </div>
                                <div class="stats-item">
                                    <span class="stats-label">一次性任务</span>
                                    <span class="stats-value">${stats.onetime_todos || 0}</span>
                                </div>
                                <div class="stats-item secondary">
                                    <span class="stats-label">已删除任务</span>
                                    <span class="stats-value">${stats.deleted_todos || 0}</span>
                                </div>
                                <div class="stats-item secondary">
                                    <span class="stats-label">历史任务总数</span>
                                    <span class="stats-value">${stats.total_todos || 0}</span>
                                </div>
                            </div>
                        </div>

                        <!-- 笔记统计 -->
                        <div class="stats-list-section">
                            <h4 class="stats-list-title">📄 健康笔记 (总计${stats.total_notes || 0}个)</h4>
                            <div class="stats-list">
                                ${this.generateNotesStatsList()}
                            </div>
                        </div>
                    </div>

                    <div class="profile-section">
                        <div class="stats-list-section">
                            <h4 class="stats-list-title">⚙️ 账户操作</h4>
                            <div class="action-buttons">
                                <button class="btn btn-success" id="refreshProfileBtn">
                                    <span class="btn-icon">🔄</span>
                                    刷新数据
                                </button>
                                <button class="btn btn-danger" id="logoutBtn">
                                    <span class="btn-icon">🚪</span>
                                    退出登录
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 生成管理成员列表
    generateManagedUsersList() {
        if (!this.profileData.managed_users || this.profileData.managed_users.length === 0) {
            return '<div class="stats-item empty">暂无管理成员</div>';
        }

        return this.profileData.managed_users.map(user => {
            const linkStatus = user.is_linked ? '🔗已关联' : '⭕未关联';
            const linkUser = user.supervised_app_user ? ` (${user.supervised_app_user})` : '';
            
            return `
                <div class="stats-item user-item">
                    <div class="user-info">
                        <span class="user-name">${user.display_name} (${user.username})</span>
                        <span class="user-status">${linkStatus}${linkUser}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 生成笔记统计列表
    generateNotesStatsList() {
        if (!this.profileData.user_notes || this.profileData.user_notes.length === 0) {
            return '<div class="stats-item empty">暂无笔记数据</div>';
        }

        return this.profileData.user_notes.map(user => {
            return `
                <div class="stats-item">
                    <span class="stats-label">${user.display_name}</span>
                    <span class="stats-value">${user.notes_count}个</span>
                </div>
            `;
        }).join('');
    },

    // 绑定Profile页面事件
    bindProfileEvents() {
        // 刷新按钮
        const refreshBtn = document.getElementById('refreshProfileBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.renderProfilePanel();
            });
        }

        // 登出按钮
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.showLogoutConfirmation();
            });
        }
    },

    // 显示登出确认对话框
    showLogoutConfirmation() {
        const confirmHtml = `
            <div class="modal-overlay" id="logoutModal">
                <div class="modal-content logout-modal">
                    <div class="modal-header">
                        <h3>确认退出</h3>
                    </div>
                    <div class="modal-body">
                        <div class="logout-icon">🚪</div>
                        <p>您确定要退出登录吗？</p>
                        <p class="logout-note">退出后需要重新登录才能使用应用。</p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="cancelLogoutBtn">取消</button>
                        <button class="btn btn-danger" id="confirmLogoutBtn">确认退出</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', confirmHtml);
        
        // 绑定事件
        const modal = document.getElementById('logoutModal');
        const cancelBtn = document.getElementById('cancelLogoutBtn');
        const confirmBtn = document.getElementById('confirmLogoutBtn');
        
        // 取消按钮
        cancelBtn.addEventListener('click', () => {
            this.closeLogoutModal();
        });
        
        // 确认按钮
        confirmBtn.addEventListener('click', () => {
            this.performLogout();
        });
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeLogoutModal();
            }
        });
    },

    // 关闭登出确认对话框
    closeLogoutModal() {
        const modal = document.getElementById('logoutModal');
        if (modal) {
            modal.remove();
        }
    },

    // 执行登出操作
    performLogout() {
        console.log('🚪 执行登出操作...');
        
        try {
            // 清除所有登录相关的localStorage数据
            localStorage.removeItem('wenting_current_app_user');
            localStorage.removeItem('wenting_login_time');
            localStorage.removeItem('wenting_current_user_id');
            localStorage.removeItem('wenting_current_module');
            
            console.log('✅ 登录数据已清除');
            
            // 关闭确认对话框
            this.closeLogoutModal();
            
            // 显示登出成功消息
            this.showLogoutMessage();
            
            // 延迟跳转到登录页面
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            
        } catch (error) {
            console.error('❌ 登出操作失败:', error);
            /* global DialogUtils */
            DialogUtils.showError('登出失败，请刷新页面重试', '登出错误');
        }
    },

    // 显示登出成功消息
    showLogoutMessage() {
        const messageEl = document.createElement('div');
        messageEl.className = 'logout-success-message';
        messageEl.innerHTML = `
            <div class="logout-success-content">
                <div class="success-icon">✅</div>
                <h3>退出成功</h3>
                <p>正在跳转到登录页面...</p>
            </div>
        `;
        
        document.body.appendChild(messageEl);
        
        // 3秒后自动移除消息
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    },

    // 获取当前用户名
    getCurrentAppUser() {
        return this.currentAppUser;
    },

    // 获取用户资料数据
    getProfileData() {
        return this.profileData;
    }
};

// 导出到全局
window.ProfileManager = ProfileManager;