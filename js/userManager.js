// 用户管理模块
const UserManager = {
    users: [],
    isOnline: false,

    async init() {
        // 确保 ApiClient 已加载
        if (typeof ApiClient === 'undefined') {
            console.error('❌ ApiClient 未定义，请检查脚本加载顺序');
            return;
        }
        
        // 检查后端连接 - 必须联网才能使用
        this.isOnline = await ApiClient.testConnection();
        
        if (!this.isOnline) {
            console.error('❌ 无法连接到服务器，应用无法启动');
            return;
        }
        
        await this.loadUsersFromAPI();
        this.bindEvents();
        this.renderUserTabs();
    },

    // 从API加载用户数据
    async loadUsersFromAPI() {
        try {
            const response = await ApiClient.users.getAll();
            if (response.success) {
                this.users = response.data;
                console.log('✅ 从服务器加载用户数据成功，用户数量:', this.users.length);
                
                // 数据库为空，等待用户手动添加用户
                if (this.users.length === 0) {
                    console.log('📝 数据库中没有用户，等待用户手动添加');
                }
            }
        } catch (error) {
            console.error('从服务器加载用户数据失败:', error);
            throw error; // 不降级到本地数据，直接抛出错误
        }
    },

    // 创建默认用户
    async createDefaultUsers() {
        try {
            const defaultUsers = [
                {
                    username: 'Dad',
                    display_name: 'Dad',
                    avatar_color: '#1d9bf0'
                },
                {
                    username: 'Mom',
                    display_name: 'Mom',
                    avatar_color: '#e91e63'
                },
                {
                    username: 'Kid',
                    display_name: 'Kid',
                    avatar_color: '#ff9800'
                }
            ];

            console.log('🔄 开始创建默认用户...');
            
            for (const userData of defaultUsers) {
                try {
                    const response = await ApiClient.users.create(userData);
                    if (response.success) {
                        this.users.push(response.data);
                        console.log(`✅ 创建用户成功: ${userData.username}`);
                    }
                } catch (error) {
                    console.error(`❌ 创建用户失败: ${userData.username}`, error);
                }
            }
            
            console.log('✅ 默认用户创建完成，总用户数:', this.users.length);
        } catch (error) {
            console.error('❌ 创建默认用户失败:', error);
            throw error;
        }
    },



    // 同步用户数据到服务器
    async syncUserToServer(user) {
        if (!this.isOnline) return false;
        
        try {
            let response;
            if (user.id && user.id > 0) {
                // 更新现有用户
                response = await ApiClient.users.update(user.id, user);
            } else {
                // 创建新用户
                response = await ApiClient.users.create(user);
            }
            
            if (response.success) {
                console.log('✅ 用户数据同步到服务器成功');
                return response.data;
            }
        } catch (error) {
            console.error('同步用户数据到服务器失败:', error);
        }
        return false;
    },

    // 添加新用户
    async addUser() {
        // 添加点击反馈动画
        const btn = event.target;
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 150);
        
        // 显示添加用户表单
        this.showAddUserForm();
    },

    // 显示添加用户表单
    showAddUserForm() {
        const formHtml = `
            <div class="modal-overlay" id="addUserModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>添加新用户</h3>
                        <button class="modal-close" onclick="UserManager.closeAddUserForm()">×</button>
                    </div>
                    <form class="user-form" onsubmit="UserManager.handleAddUser(event)">
                        <div class="form-group">
                            <label for="username">用户名 *</label>
                            <input type="text" id="username" name="username" required maxlength="50">
                        </div>
                        <div class="form-group">
                            <label for="display_name">显示名称 *</label>
                            <input type="text" id="display_name" name="display_name" required maxlength="100">
                        </div>
                        <div class="form-group">
                            <label for="email">邮箱</label>
                            <input type="email" id="email" name="email" maxlength="100">
                        </div>
                        <div class="form-group">
                            <label for="phone">手机号</label>
                            <input type="tel" id="phone" name="phone" pattern="1[3-9]\\d{9}" maxlength="11">
                        </div>
                        <div class="form-group">
                            <label for="gender">性别</label>
                            <select id="gender" name="gender">
                                <option value="">请选择</option>
                                <option value="male">男</option>
                                <option value="female">女</option>
                                <option value="other">其他</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="birthday">生日</label>
                            <input type="date" id="birthday" name="birthday">
                        </div>
                        <div class="form-group">
                            <label for="avatar_color">头像颜色</label>
                            <input type="color" id="avatar_color" name="avatar_color" value="#1d9bf0">
                        </div>
                        <div class="form-actions">
                            <button type="button" onclick="UserManager.closeAddUserForm()">取消</button>
                            <button type="submit">添加用户</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', formHtml);
    },

    // 关闭添加用户表单
    closeAddUserForm() {
        const modal = document.getElementById('addUserModal');
        if (modal) {
            modal.remove();
        }
    },

    // 处理添加用户表单提交
    async handleAddUser(event) {
        event.preventDefault();
        
        // 防止重复提交
        const submitButton = event.target.querySelector('button[type="submit"]');
        if (submitButton.disabled) {
            console.log('⚠️ 表单正在提交中，忽略重复提交');
            return;
        }
        
        // 禁用提交按钮
        submitButton.disabled = true;
        submitButton.textContent = '提交中...';
        
        const formData = new FormData(event.target);
        const userData = {
            username: formData.get('username'),
            display_name: formData.get('display_name'),
            email: formData.get('email') || null,
            phone: formData.get('phone') || null,
            gender: formData.get('gender') || null,
            birthday: formData.get('birthday') || null,
            avatar_color: formData.get('avatar_color') || '#1d9bf0'
        };

        console.log('📤 准备创建用户:', userData);
        console.log('📋 用户数据详情:');
        Object.keys(userData).forEach(key => {
            console.log(`  ${key}: "${userData[key]}" (类型: ${typeof userData[key]}, 长度: ${userData[key]?.length || 'N/A'})`);
        });

        try {
            // 在服务器创建用户
            console.log('🔄 正在调用API创建用户...');
            const response = await ApiClient.users.create(userData);
            console.log('📥 API响应:', response);
            
            if (response && response.success) {
                const newUser = response.data;
                console.log('✅ 在服务器创建用户成功:', newUser);
                
                // 添加到本地用户列表
                this.users.push(newUser);
                console.log('📝 已添加到本地用户列表，当前用户数:', this.users.length);
                
                // 切换到新创建的用户
                if (window.TodoManager) {
                    window.TodoManager.currentUser = newUser.id;
                    console.log('🎯 已切换到新用户:', newUser.id, newUser.username);
                }
                
                // 重新渲染用户标签（会显示新用户为活跃状态）
                this.renderUserTabs();
                console.log('🎨 已重新渲染用户标签');
                
                // 关闭表单
                this.closeAddUserForm();
                
                // 显示成功消息
                this.showMessage('用户添加成功！', 'success');
                
                // 加载并显示新用户的TODO列表
                if (window.TodoManager && typeof window.TodoManager.loadTodosFromAPI === 'function') {
                    try {
                        await window.TodoManager.loadTodosFromAPI();
                        window.TodoManager.renderTodoPanel(newUser.id);
                        console.log('✅ 已加载新用户的TODO列表');
                    } catch (todoError) {
                        console.warn('重新加载TODO数据失败:', todoError);
                    }
                }
                
            } else {
                console.error('❌ API返回失败响应:', response);
                throw new Error(response?.message || '创建用户失败');
            }
            
        } catch (error) {
            console.error('❌ 添加用户失败:', error);
            console.error('错误详情:', {
                message: error.message,
                stack: error.stack,
                response: error.response
            });
            
            // 检查是否是网络错误
            if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
                this.showMessage('网络连接失败，请检查服务器状态', 'error');
            } else {
                this.showMessage('添加用户失败: ' + error.message, 'error');
            }
        } finally {
            // 恢复提交按钮状态
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = '添加用户';
            }
        }
    },

    // 删除用户
    async removeUser(userId) {
        if (!confirm('确定要删除这个用户吗？这将删除该用户的所有TODO数据。')) {
            return;
        }

        try {
            // 从服务器删除
            const response = await ApiClient.users.delete(userId);
            if (!response.success) {
                throw new Error(response.message || '删除用户失败');
            }
            console.log('✅ 从服务器删除用户成功');

            // 从本地删除
            const index = this.users.findIndex(user => user.id === userId);
            if (index > -1) {
                this.users.splice(index, 1);
                
                // 清理对应的TODO数据
                if (TodoManager.todos && TodoManager.todos[userId]) {
                    delete TodoManager.todos[userId];
                }
                
                // 如果删除的是当前用户，切换到第一个用户
                if (TodoManager.currentUser === userId && this.users.length > 0) {
                    TodoManager.switchUser(this.users[0].id);
                }
                
                this.renderUserTabs();
                this.showMessage('用户删除成功！', 'success');
            }
        } catch (error) {
            console.error('删除用户失败:', error);
            this.showMessage('删除用户失败: ' + error.message, 'error');
        }
    },

    // 渲染用户标签
    renderUserTabs() {
        const sidebar = Utils.$('.left-sidebar');
        if (!sidebar) return;

        // 按ID排序，确保用户按创建顺序显示（ID越小越靠前）
        const sortedUsers = [...this.users].sort((a, b) => a.id - b.id);
        console.log('📋 用户排序:', sortedUsers.map(u => `ID:${u.id}(${u.username})`).join(', '));

        // 获取当前选中的用户ID
        const currentUserId = window.GlobalUserState ? GlobalUserState.getCurrentUser() : (TodoManager.currentUser || null);
        
        const tabsHtml = sortedUsers.map(user => {
            const isActive = parseInt(user.id) === parseInt(currentUserId);
            const userColor = user.avatar_color || '#1d9bf0';
            
            return `
                <div class="sidebar-tab ${isActive ? 'active' : ''}" 
                     data-tab="${user.id}"
                     style="--user-color: ${userColor};">
                    ${user.display_name || user.username}
                </div>
            `;
        }).join('');

        const addButtonHtml = `
            <div class="add-user-btn" onclick="UserManager.addUser()" title="添加新用户">
                +
            </div>
        `;

        sidebar.innerHTML = tabsHtml + addButtonHtml;
        
        // 重新绑定全局用户选择器事件
        if (window.GlobalUserState) {
            GlobalUserState.bindUserSelectorEvents();
        }
    },

    // 获取用户信息
    getUser(userId) {
        return this.users.find(user => user.id === userId);
    },

    // 更新用户信息
    async updateUser(userId, updates) {
        try {
            // 在服务器更新用户
            const response = await ApiClient.users.update(userId, updates);
            if (response.success) {
                const updatedUser = response.data;
                console.log('✅ 在服务器更新用户成功');
                
                // 更新本地用户数据
                const user = this.getUser(userId);
                if (user) {
                    Object.assign(user, updatedUser);
                    this.renderUserTabs();
                    return true;
                }
            } else {
                throw new Error(response.message || '更新用户失败');
            }
        } catch (error) {
            console.error('更新用户失败:', error);
            this.showMessage('更新用户失败: ' + error.message, 'error');
        }
        return false;
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
        // 用户标签点击事件在TodoManager中处理
    }
};

// 全局函数（保持向后兼容）
function addNewUser() {
    UserManager.addUser();
}