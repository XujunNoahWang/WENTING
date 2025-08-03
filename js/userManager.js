// 用户管理模块
const UserManager = {
    users: [],
    isOnline: false,

    async init() {
        // 检查后端连接
        this.isOnline = await ApiClient.testConnection();
        
        if (this.isOnline) {
            await this.loadUsersFromAPI();
        } else {
            this.loadUsersFromLocal();
        }
        
        this.bindEvents();
        this.renderUserTabs();
    },

    // 从API加载用户数据
    async loadUsersFromAPI() {
        try {
            const response = await ApiClient.users.getAll();
            if (response.success) {
                this.users = response.data;
                this.saveUsersToLocal(); // 同时保存到本地作为备份
                console.log('✅ 从服务器加载用户数据成功');
            }
        } catch (error) {
            console.error('从服务器加载用户数据失败:', error);
            this.loadUsersFromLocal(); // 降级到本地数据
        }
    },

    // 从本地存储加载用户数据
    loadUsersFromLocal() {
        const savedUsers = localStorage.getItem('wenting_users');
        if (savedUsers) {
            this.users = JSON.parse(savedUsers);
        } else {
            // 使用默认用户数据
            this.users = [
                {
                    id: 1,
                    username: 'dad',
                    display_name: 'Dad',
                    email: 'dad@example.com',
                    phone: '13800138001',
                    gender: 'male',
                    birthday: '1980-05-15',
                    avatar_color: '#1d9bf0',
                    created_at: '2025-01-01T00:00:00.000Z'
                },
                {
                    id: 2,
                    username: 'mom',
                    display_name: 'Mom',
                    email: 'mom@example.com',
                    phone: '13800138002',
                    gender: 'female',
                    birthday: '1985-08-20',
                    avatar_color: '#e91e63',
                    created_at: '2025-01-01T00:01:00.000Z'
                },
                {
                    id: 3,
                    username: 'kid',
                    display_name: 'Kid',
                    email: 'kid@example.com',
                    phone: null,
                    gender: 'other',
                    birthday: '2010-12-10',
                    avatar_color: '#ff9800',
                    created_at: '2025-01-01T00:02:00.000Z'
                }
            ];
        }
        console.log('📱 使用本地用户数据');
    },

    // 保存用户数据到本地
    saveUsersToLocal() {
        localStorage.setItem('wenting_users', JSON.stringify(this.users));
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

        try {
            let newUser;
            
            if (this.isOnline) {
                // 尝试在服务器创建用户
                const response = await ApiClient.users.create(userData);
                if (response.success) {
                    newUser = response.data;
                    console.log('✅ 在服务器创建用户成功');
                } else {
                    throw new Error(response.message || '创建用户失败');
                }
            } else {
                // 离线模式，创建本地用户
                newUser = {
                    id: Date.now(), // 临时ID
                    ...userData,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            }

            // 添加到本地用户列表
            this.users.push(newUser);
            this.saveUsersToLocal();
            
            // 重新渲染用户标签
            this.renderUserTabs();
            
            // 关闭表单
            this.closeAddUserForm();
            
            // 显示成功消息
            this.showMessage('用户添加成功！', 'success');
            
        } catch (error) {
            console.error('添加用户失败:', error);
            this.showMessage('添加用户失败: ' + error.message, 'error');
        }
    },

    // 删除用户
    async removeUser(userId) {
        if (!confirm('确定要删除这个用户吗？这将删除该用户的所有TODO数据。')) {
            return;
        }

        try {
            // 如果在线，先从服务器删除
            if (this.isOnline) {
                const response = await ApiClient.users.delete(userId);
                if (!response.success) {
                    throw new Error(response.message || '删除用户失败');
                }
                console.log('✅ 从服务器删除用户成功');
            }

            // 从本地删除
            const index = this.users.findIndex(user => user.id === userId);
            if (index > -1) {
                this.users.splice(index, 1);
                this.saveUsersToLocal();
                
                // 清理对应的TODO数据
                if (TodoManager.todos && TodoManager.todos[userId]) {
                    delete TodoManager.todos[userId];
                    TodoManager.saveTodosToLocal();
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

        // 按创建时间或ID排序，确保新用户在最后
        const sortedUsers = [...this.users].sort((a, b) => {
            if (a.created_at && b.created_at) {
                return new Date(a.created_at) - new Date(b.created_at);
            }
            return a.id - b.id;
        });

        const tabsHtml = sortedUsers.map(user => `
            <div class="sidebar-tab ${parseInt(user.id) === parseInt(TodoManager.currentUser) ? 'active' : ''}" 
                 data-tab="${user.id}"
                 style="border-color: ${user.avatar_color || '#1d9bf0'}; ${parseInt(user.id) === parseInt(TodoManager.currentUser) ? `background-color: ${user.avatar_color || '#1d9bf0'}; color: white;` : 'background-color: white; color: #333;'}">
                ${user.display_name || user.username}
            </div>
        `).join('');

        const addButtonHtml = `
            <div class="add-user-btn" onclick="UserManager.addUser()" title="添加新用户">
                +
            </div>
        `;

        sidebar.innerHTML = tabsHtml + addButtonHtml;
        
        // 重新绑定事件
        if (TodoManager && TodoManager.bindEvents) {
            TodoManager.bindEvents();
        }
    },

    // 获取用户信息
    getUser(userId) {
        return this.users.find(user => user.id === userId);
    },

    // 更新用户信息
    async updateUser(userId, updates) {
        try {
            let updatedUser;
            
            if (this.isOnline) {
                // 尝试在服务器更新用户
                const response = await ApiClient.users.update(userId, updates);
                if (response.success) {
                    updatedUser = response.data;
                    console.log('✅ 在服务器更新用户成功');
                } else {
                    throw new Error(response.message || '更新用户失败');
                }
            }

            // 更新本地用户数据
            const user = this.getUser(userId);
            if (user) {
                Object.assign(user, updates);
                if (updatedUser) {
                    Object.assign(user, updatedUser);
                }
                this.saveUsersToLocal();
                this.renderUserTabs();
                return true;
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