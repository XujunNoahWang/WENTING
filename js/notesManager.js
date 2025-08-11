// Notes管理器 - 健康笔记功能
const NotesManager = {
    notes: {},
    currentUser: 1,
    isOnline: false,

    // 初始化
    async init() {
        console.log('🔄 初始化Notes管理器...');
        
        // 检查后端连接
        this.isOnline = await ApiClient.testConnection();
        
        if (!this.isOnline) {
            console.warn('⚠️ 后端服务不可用，Notes功能将无法正常工作');
            this.showOfflineError();
            return;
        }

        // 等待用户管理器初始化完成
        await this.waitForUserManager();
        
        // 加载Notes数据
        await this.loadNotesFromAPI();
        
        // 设置默认用户
        this.setDefaultUser();
        
        // 监听全局用户状态变化，但不设置模块
        if (window.GlobalUserState) {
            GlobalUserState.addListener(this.handleGlobalStateChange.bind(this));
        }
        
        // WebSocket消息处理由websocketClient.js统一管理，无需单独注册
        
        // 渲染界面
        this.renderNotesPanel(this.currentUser);
        this.bindEvents();
        
        console.log('✅ Notes管理器初始化完成');
    },

    // 等待用户管理器初始化完成
    async waitForUserManager() {
        // 设置最大等待时间为5秒，避免新用户无限等待
        const maxWaitTime = 5000; // 5秒
        const startTime = Date.now();
        
        if (UserManager.users.length === 0) {
            console.log('⏳ Notes: 等待用户数据加载，新用户最多等待5秒...');
            await new Promise(resolve => {
                const checkUsers = () => {
                    const elapsedTime = Date.now() - startTime;
                    
                    if (UserManager.users.length > 0) {
                        console.log('✅ Notes: 用户数据已加载');
                        resolve();
                    } else if (elapsedTime >= maxWaitTime) {
                        console.log('⏰ Notes: 等待超时，可能是新用户没有被管理用户，继续初始化...');
                        resolve();
                    } else {
                        setTimeout(checkUsers, 100);
                    }
                };
                checkUsers();
            });
        }
    },

    // 从API加载Notes数据（按照TodoManager的模式，支持自动渲染）
    async loadNotesFromAPI(autoRender = false, targetUserId = null) {
        try {
            console.log('🔄 开始加载Notes数据...', autoRender ? '(自动渲染)' : '');
            
            for (const user of UserManager.users) {
                console.log(`📥 加载用户 ${user.username} 的Notes...`);
                const response = await ApiClient.notes.getByUserId(user.id);
                
                if (response.success) {
                    this.notes[user.id] = response.data || [];
                    console.log(`✅ 用户 ${user.username} 的Notes加载完成: ${this.notes[user.id].length} 条`);
                } else {
                    console.warn(`⚠️ 加载用户 ${user.username} 的Notes失败:`, response.message);
                    this.notes[user.id] = [];
                }
            }
            
            // 🔥 关键修复：如果需要自动渲染，立即渲染指定用户的面板
            if (autoRender) {
                const renderUserId = targetUserId || this.currentUser;
                if (renderUserId) {
                    console.log('🎨 [Notes] 数据加载完成，立即渲染界面，用户:', renderUserId);
                    
                    // 🔥 关键修复：检查当前用户是否还有数据，如果没有则切换到有数据的用户
                    let actualUserId = renderUserId;
                    
                    if (!this.notes[renderUserId] || this.notes[renderUserId].length === 0) {
                        console.log(`⚠️ [Notes] 用户ID ${renderUserId} 没有数据，查找有数据的用户...`);
                        
                        // 查找有数据的用户，按ID排序
                        const usersWithNotes = UserManager.users
                            .filter(u => this.notes[u.id] && this.notes[u.id].length > 0)
                            .sort((a, b) => a.id - b.id);
                        
                        if (usersWithNotes.length > 0) {
                            actualUserId = usersWithNotes[0].id;
                            console.log(`🔄 [Notes] 切换到有数据的用户: ${actualUserId} (${usersWithNotes[0].username})`);
                            
                            // 更新currentUser和全局状态
                            this.currentUser = actualUserId;
                            if (window.GlobalUserState) {
                                GlobalUserState.currentUserId = actualUserId;
                                localStorage.setItem('wenting_current_user_id', actualUserId.toString());
                                console.log('🔄 [Notes] 已更新全局用户状态');
                            }
                        } else {
                            console.log('⚠️ [Notes] 没有用户有数据，显示空状态');
                        }
                    }
                    
                    this.renderNotesPanel(actualUserId);
                }
            }
            
        } catch (error) {
            console.error('❌ 加载Notes数据失败:', error);
            this.showMessage('加载笔记数据失败: ' + error.message, 'error');
            // 初始化空数据
            UserManager.users.forEach(user => {
                this.notes[user.id] = [];
            });
            
            // 即使出错也要渲染，避免空白页面
            if (autoRender) {
                const renderUserId = targetUserId || this.currentUser;
                if (renderUserId) {
                    console.log('🎨 [Notes] 数据加载失败，仍然渲染界面避免空白，用户:', renderUserId);
                    this.renderNotesPanel(renderUserId);
                }
            }
        }
    },

    // 设置默认用户（优先选择有数据的用户）
    setDefaultUser() {
        console.log('🔄 [Notes] 开始设置默认用户...');
        console.log('🔍 [Notes] 用户数据调试:');
        console.log('  - UserManager.users.length:', UserManager.users.length);
        console.log('  - UserManager.users:', UserManager.users);
        
        if (UserManager.users.length > 0) {
            // 检查是否有保存的用户选择
            let savedUserId = null;
            if (window.GlobalUserState) {
                savedUserId = GlobalUserState.getCurrentUser();
                console.log('💾 [Notes] 从全局状态获取保存的用户ID:', savedUserId);
            }
            
            // 🔥 关键修复：优先选择有数据的用户
            let defaultUser;
            
            // 首先检查保存的用户ID是否有效且有数据
            if (savedUserId) {
                const savedUser = UserManager.users.find(u => u.id == savedUserId);
                if (savedUser && this.notes[savedUserId] && this.notes[savedUserId].length > 0) {
                    defaultUser = parseInt(savedUserId);
                    console.log('🎯 [Notes] 使用保存的用户ID（有数据）:', defaultUser);
                } else if (savedUser) {
                    console.log('⚠️ [Notes] 保存的用户ID存在但没有数据:', savedUserId);
                }
            }
            
            // 如果保存的用户ID无效或没有数据，查找有数据的用户
            if (!defaultUser) {
                console.log('🔍 [Notes] 查找有数据的用户...');
                
                // 查找有Notes数据的用户，按ID排序
                const usersWithNotes = UserManager.users
                    .filter(u => this.notes[u.id] && this.notes[u.id].length > 0)
                    .sort((a, b) => a.id - b.id);
                
                console.log('📊 [Notes] 有数据的用户:', usersWithNotes.map(u => `ID:${u.id}(${u.username}, ${this.notes[u.id].length}条)`).join(', '));
                
                if (usersWithNotes.length > 0) {
                    defaultUser = usersWithNotes[0].id;
                    console.log('🎯 [Notes] 使用有数据的第一个用户:', defaultUser, '(用户名:', usersWithNotes[0].username, ')');
                } else {
                    // 如果没有用户有数据，使用ID最小的用户
                    const sortedUsers = [...UserManager.users].sort((a, b) => a.id - b.id);
                    defaultUser = sortedUsers[0].id;
                    console.log('🎯 [Notes] 没有用户有数据，使用默认第一个用户:', defaultUser, '(用户名:', sortedUsers[0].username, ')');
                }
            }
            
            console.log('📋 [Notes] 所有用户按ID排序:', UserManager.users.sort((a, b) => a.id - b.id).map(u => `ID:${u.id}(${u.username})`).join(', '));
            this.currentUser = defaultUser;
            
            // 直接同步全局状态，不触发事件
            if (window.GlobalUserState) {
                GlobalUserState.currentUserId = defaultUser;
                localStorage.setItem('wenting_current_user_id', defaultUser.toString());
                console.log('🔄 [Notes] 直接同步全局用户状态（不触发事件）');
                console.log('🔍 [Notes] 设置后的状态:');
                console.log('  - NotesManager.currentUser:', this.currentUser);
                console.log('  - GlobalUserState.currentUserId:', GlobalUserState.currentUserId);
            }
        } else {
            console.log('📝 [Notes] 没有用户，设置为空状态');
            this.currentUser = null;
            
            if (window.GlobalUserState) {
                GlobalUserState.currentUserId = null;
                console.log('🔄 [Notes] 设置全局状态为空用户状态');
            }
        }
    },

    // 处理全局状态变化
    handleGlobalStateChange(type, data) {
        console.log('📢 Notes管理器收到全局状态变化:', type, data);
        
        if (type === 'userChanged') {
            const newUserId = data.userId;
            if (this.currentUser !== newUserId) {
                this.currentUser = newUserId;
                // 只有当前模块是notes时才渲染
                if (GlobalUserState.getCurrentModule() === 'notes') {
                    console.log('✅ 当前是Notes模块，渲染Notes内容');
                    this.renderNotesPanel(newUserId);
                } else {
                    console.log('⏸️ 当前不是Notes模块，跳过渲染');
                }
            }
        }
    },



    // 🔥 关键修复：处理WebSocket广播消息（完全按照TodoManager的模式）
    handleWebSocketBroadcast(type, data) {
        console.log('🔄 处理Notes广播消息:', type, data);
        
        switch (type) {
            case 'NOTES_CREATE_BROADCAST':
            case 'NOTES_UPDATE_BROADCAST':
            case 'NOTES_DELETE_BROADCAST':
                // 清除所有用户的缓存，因为广播可能来自其他设备，影响所有用户
                console.log('🧹 广播消息：清除所有Notes缓存');
                this.clearAllNotesCache();
                // 🔥 关键修复：仅当当前模块为notes时自动渲染，否则只后台同步
                const shouldAutoRender = window.GlobalUserState && GlobalUserState.getCurrentModule() === 'notes';
                this.loadNotesFromAPI(shouldAutoRender, this.currentUser);
                break;
                
            case 'NOTES_SYNC_UPDATE':
                // 🔥 关键修复：处理关联用户的实时同步更新
                console.log('🔗 [Notes] 收到Link同步更新:', data);
                console.log('🔗 [Notes] 当前NotesManager状态:', {
                    currentUser: this.currentUser,
                    currentModule: window.GlobalUserState ? window.GlobalUserState.getCurrentModule() : null,
                    notesCount: Object.keys(this.notes).length
                });
                
                // 🔥 新增：立即显示同步提示
                this.showSyncStatusToast('正在同步Notes数据...', 'info');
                
                // 立即清除所有缓存
                console.log('🧹 [Notes] 清除所有缓存以确保数据同步');
                this.clearAllNotesCache();
                
                // 获取当前用户和模块
                const currentUser = this.currentUser;
                const currentModule = window.GlobalUserState ? window.GlobalUserState.getCurrentModule() : null;
                
                console.log('📝 [Notes] 同步更新信息:', {
                    currentUser,
                    currentModule,
                    operation: data.operation,
                    fromUser: data.sync?.fromUser
                });
                
                if (currentUser) {
                    // 🔥 关键修复：强制重新加载数据并自动渲染
                    const shouldAutoRender = currentModule === 'notes';
                    console.log('🔄 [Notes] 开始重新加载数据，自动渲染:', shouldAutoRender);
                    
                    this.loadNotesFromAPI(shouldAutoRender, currentUser).then(() => {
                        console.log('✅ [Notes] 同步数据重新加载完成');
                        
                        // 🔥 新增：确保渲染完成后显示成功提示
                        if (data.sync && data.sync.fromUser) {
                            const operationText = {
                                'CREATE': '创建',
                                'UPDATE': '更新',
                                'DELETE': '删除'
                            }[data.operation] || data.operation;
                            
                            this.showSyncStatusToast(`${data.sync.fromUser} ${operationText}了健康笔记`, 'success');
                        }
                    }).catch(error => {
                        console.error('❌ [Notes] 同步数据重新加载失败:', error);
                        this.showSyncStatusToast('同步失败，请刷新页面', 'error');
                        
                        // 即使加载失败，也要尝试渲染避免空白页面
                        if (currentModule === 'notes') {
                            console.log('🎨 [Notes] 加载失败，尝试渲染现有数据避免空白');
                            this.renderNotesPanel(currentUser);
                        }
                    });
                }
                break;
        }
    },



    // 降级到HTTP模式
    fallbackToHTTP() {
        console.log('📡 Notes模块降级到HTTP模式');
        // 目前的实现已经自动处理降级，无需额外操作
    },

    // 清除所有Notes缓存 - 彻底清理方法（按照TodoManager的模式）
    clearAllNotesCache(userId = null) {
        console.log('🧹 开始清除所有Notes缓存...', userId ? `用户${userId}` : '所有用户');
        
        if (userId) {
            // 清除指定用户的Notes数据
            if (this.notes[userId]) {
                delete this.notes[userId];
                console.log(`✅ 已清除用户${userId}的Notes缓存`);
            }
        } else {
            // 清除所有Notes数据
            const userCount = Object.keys(this.notes).length;
            this.notes = {};
            console.log(`✅ 已清除所有${userCount}个用户的Notes缓存`);
        }
    },

    // 渲染Notes面板
    renderNotesPanel(userId) {
        const contentArea = Utils.$('#contentArea');
        if (!contentArea) return;

        const userNotes = this.notes[userId] || [];
        console.log(`🎨 渲染用户 ${userId} 的Notes面板，共 ${userNotes.length} 条笔记`);

        const panelHtml = `
            <div class="content-panel" id="${userId}-notes-panel">
                <div class="notes-content">
                    <div class="notes-container">
                        ${userNotes.length > 0 
                            ? userNotes.map(note => this.renderNoteCard(note, userId)).join('')
                            : this.renderEmptyState()
                        }
                    </div>
                </div>
                <button class="new-note-btn" onclick="NotesManager.showAddNoteForm(${userId})">+ 添加新笔记</button>
            </div>
        `;

        contentArea.innerHTML = panelHtml;
    },

    // 渲染笔记卡片
    renderNoteCard(note, userId) {
        const shortDescription = note.description.length > 50 
            ? note.description.substring(0, 50) + '...' 
            : note.description;

        // 获取同步状态
        const syncStatus = this.getSyncStatus(note.user_id);
        const syncIndicator = syncStatus.isLinked ? `
            <div class="sync-indicator ${syncStatus.status}" title="${syncStatus.tooltip}">
                <span class="sync-icon">${syncStatus.icon}</span>
            </div>
        ` : '';

        return `
            <div class="note-card clickable" data-note-id="${note.id}" onclick="NotesManager.showNoteDetails(${note.id})">
                <div class="note-header">
                    <div class="note-title-container">
                        <h3 class="note-title">${Utils.escapeHtml(note.title)}</h3>
                        ${syncIndicator}
                    </div>
                    <div class="note-actions" onclick="event.stopPropagation()">
                        <button class="note-action-btn" onclick="NotesManager.shareNote(${note.id})" title="分享">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                            </svg>
                        </button>
                        <button class="note-action-btn" onclick="NotesManager.showEditNoteForm(${note.id})" title="编辑">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                        <button class="note-action-btn delete" onclick="NotesManager.deleteNote(${note.id})" title="删除">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                ${shortDescription ? `<p class="note-description">${Utils.escapeHtml(shortDescription)}</p>` : ''}
                ${note.precautions ? `<div class="note-precautions">
                    <strong>注意事项:</strong> ${Utils.escapeHtml(note.precautions.length > 80 ? note.precautions.substring(0, 80) + '...' : note.precautions)}
                </div>` : ''}
            </div>
        `;
    },

    // 获取同步状态
    getSyncStatus(userId) {
        // 检查用户是否有关联关系
        const user = UserManager.users.find(u => u.id === userId);
        if (!user) {
            return { isLinked: false };
        }
        
        // 检查是否已关联
        if (user.is_linked && user.supervised_app_user) {
            return {
                isLinked: true,
                status: 'synced',
                icon: '🔗',
                tooltip: `已与 ${user.supervised_app_user} 同步`
            };
        }
        
        return { isLinked: false };
    },

    // 显示同步状态提示
    showSyncStatusToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `sync-toast ${type}`;
        toast.innerHTML = `
            <span class="sync-toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="sync-toast-message">${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        // 显示动画
        setTimeout(() => toast.classList.add('show'), 100);
        
        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    },

    // 渲染空状态
    renderEmptyState() {
        return `
            <div class="notes-empty-state">
                <div class="empty-icon">📝</div>
                <h3>还没有健康笔记</h3>
                <p>开始记录您的健康状况和注意事项</p>
            </div>
        `;
    },

    // 显示添加笔记表单
    showAddNoteForm(userId) {
        const formHtml = `
            <div class="modal-overlay" id="addNoteModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>添加健康笔记</h3>
                        <button class="modal-close" onclick="NotesManager.closeNoteForm()">×</button>
                    </div>
                    <form class="note-form" onsubmit="NotesManager.handleAddNote(event, ${userId})">
                        <div class="form-group">
                            <label for="note-title">健康状况标题 *</label>
                            <input type="text" id="note-title" name="title" required maxlength="100" 
                                   placeholder="如：关节炎、血压高、轻度抑郁等">
                        </div>
                        <div class="form-group">
                            <label for="note-description">详细描述</label>
                            <textarea id="note-description" name="description" rows="4" 
                                      placeholder="详细描述您的健康状况..."></textarea>
                        </div>
                        <div class="form-group">
                            <label for="note-precautions">注意事项/医嘱</label>
                            <textarea id="note-precautions" name="precautions" rows="3" 
                                      placeholder="医生建议、注意事项等..."></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" onclick="NotesManager.closeNoteForm()">取消</button>
                            <button type="submit">保存笔记</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', formHtml);
    },

    // 处理添加笔记
    async handleAddNote(event, userId) {
        event.preventDefault();
        
        const form = event.target;
        const submitButton = form.querySelector('button[type="submit"]');
        
        try {
            // 防止重复提交
            submitButton.disabled = true;
            submitButton.textContent = '保存中...';
            
            const formData = new FormData(form);
            const noteData = {
                user_id: parseInt(userId),
                title: formData.get('title').trim(),
                description: formData.get('description').trim(),
                precautions: formData.get('precautions').trim()
            };
            
            console.log('🔄 创建新笔记:', noteData);
            const response = await ApiClient.notes.create(noteData);
            
            if (response.success) {
                console.log('✅ [Notes] 后端创建成功:', response.data);
                
                // 🔥 关键修复：重新从API加载最新数据，确保数据一致性
                await this.loadNotesFromAPI(true, userId);
                
                // 关闭表单
                this.closeNoteForm();
                
                this.showMessage('笔记添加成功！', 'success');
                console.log('✅ [Notes] 创建操作完成，界面已更新');
            } else {
                throw new Error(response.message || '创建笔记失败');
            }
            
        } catch (error) {
            console.error('❌ 添加笔记失败:', error);
            this.showMessage('添加笔记失败: ' + error.message, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '保存笔记';
        }
    },

    // 显示编辑笔记表单
    async showEditNoteForm(noteId) {
        try {
            // 获取笔记详情
            const response = await ApiClient.notes.getById(noteId);
            if (!response.success) {
                throw new Error(response.message);
            }
            
            const note = response.data;
            const formHtml = `
                <div class="modal-overlay" id="editNoteModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>编辑健康笔记</h3>
                            <button class="modal-close" onclick="NotesManager.closeNoteForm()">×</button>
                        </div>
                        <form class="note-form" onsubmit="NotesManager.handleEditNote(event, ${noteId})">
                            <div class="form-group">
                                <label for="edit-note-title">健康状况标题 *</label>
                                <input type="text" id="edit-note-title" name="title" required maxlength="100" 
                                       value="${Utils.escapeHtml(note.title)}" 
                                       placeholder="如：关节炎、血压高、轻度抑郁等">
                            </div>
                            <div class="form-group">
                                <label for="edit-note-description">详细描述</label>
                                <textarea id="edit-note-description" name="description" rows="4" 
                                          placeholder="详细描述您的健康状况...">${Utils.escapeHtml(note.description || '')}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="edit-note-precautions">注意事项/医嘱</label>
                                <textarea id="edit-note-precautions" name="precautions" rows="3" 
                                          placeholder="医生建议、注意事项等...">${Utils.escapeHtml(note.precautions || '')}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="edit-note-ai-suggestions">AI建议 <span class="form-note">(可编辑和修改)</span></label>
                                <textarea id="edit-note-ai-suggestions" name="ai_suggestions" rows="8" 
                                          placeholder="AI生成的建议内容...">${Utils.escapeHtml(note.ai_suggestions || '')}</textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" onclick="NotesManager.closeNoteForm()">取消</button>
                                <button type="submit">保存修改</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', formHtml);
        } catch (error) {
            console.error('显示编辑表单失败:', error);
            this.showMessage('加载笔记数据失败: ' + error.message, 'error');
        }
    },

    // 处理编辑笔记
    async handleEditNote(event, noteId) {
        event.preventDefault();
        
        const form = event.target;
        const submitButton = form.querySelector('button[type="submit"]');
        
        try {
            // 防止重复提交
            submitButton.disabled = true;
            submitButton.textContent = '保存中...';
            
            const formData = new FormData(form);
            const noteData = {
                title: formData.get('title').trim(),
                description: formData.get('description').trim(),
                precautions: formData.get('precautions').trim(),
                ai_suggestions: formData.get('ai_suggestions').trim()
            };
            
            console.log('🔄 更新笔记:', noteId, noteData);
            const response = await ApiClient.notes.update(noteId, noteData);
            
            if (response.success) {
                console.log('✅ [Notes] 后端更新成功:', response.data);
                
                // 🔥 关键修复：重新从API加载最新数据，确保数据一致性
                await this.loadNotesFromAPI(true, this.currentUser);
                
                // 关闭表单
                this.closeNoteForm();
                
                // 如果详情模态框打开，也关闭它
                this.closeNoteDetails();
                
                this.showMessage('笔记更新成功！', 'success');
                console.log('✅ [Notes] 更新操作完成，界面已更新');
            } else {
                throw new Error(response.message || '更新笔记失败');
            }
            
        } catch (error) {
            console.error('❌ 更新笔记失败:', error);
            this.showMessage('更新笔记失败: ' + error.message, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '保存修改';
        }
    },

    // 关闭笔记表单
    closeNoteForm() {
        const modal = document.getElementById('addNoteModal') || document.getElementById('editNoteModal');
        if (modal) {
            modal.remove();
        }
    },

    // 显示笔记详情
    async showNoteDetails(noteId) {
        try {
            const response = await ApiClient.notes.getById(noteId);
            if (!response.success) {
                throw new Error(response.message);
            }
            
            const note = response.data;
            const detailsHtml = `
                <div class="modal-overlay" id="noteDetailsModal">
                    <div class="modal-content large">
                        <div class="modal-header">
                            <h3>${Utils.escapeHtml(note.title)}</h3>
                            <button class="modal-close" onclick="NotesManager.closeNoteDetails()">×</button>
                        </div>
                        <div class="note-details">
                            ${note.description ? `
                                <div class="detail-section">
                                    <h4>详细描述</h4>
                                    <p>${Utils.escapeHtml(note.description)}</p>
                                </div>
                            ` : ''}
                            ${note.precautions ? `
                                <div class="detail-section">
                                    <h4>注意事项/医嘱</h4>
                                    <p>${Utils.escapeHtml(note.precautions)}</p>
                                </div>
                            ` : ''}
                            <div class="detail-section">
                                <h4>AI建议</h4>
                                ${note.ai_suggestions ? `
                                    <div class="ai-suggestions-content">${this.formatAISuggestions(note.ai_suggestions)}</div>
                                ` : `
                                    <p class="no-suggestions">暂无AI建议</p>
                                    <button class="generate-ai-btn" onclick="NotesManager.generateAISuggestions(${noteId})">
                                        获取AI建议
                                    </button>
                                `}
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button onclick="NotesManager.showEditNoteForm(${noteId})">编辑</button>
                            <button onclick="NotesManager.regenerateAISuggestions(${noteId})" class="regenerate-ai-btn">再次生成AI建议</button>
                            <button onclick="NotesManager.closeNoteDetails()">关闭</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', detailsHtml);
        } catch (error) {
            console.error('显示笔记详情失败:', error);
            this.showMessage('加载笔记详情失败: ' + error.message, 'error');
        }
    },

    // 关闭笔记详情
    closeNoteDetails() {
        const modal = document.getElementById('noteDetailsModal');
        if (modal) {
            modal.remove();
        }
    },

    // 设置AI生成加载状态
    setAIGenerationLoadingState(isLoading) {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) return;

        // 获取所有需要禁用的按钮
        const editButton = modal.querySelector('button[onclick*="showEditNoteForm"]');
        const regenerateButton = modal.querySelector('.regenerate-ai-btn');
        const closeButton = modal.querySelector('button[onclick*="closeNoteDetails"]');
        const generateButton = modal.querySelector('.generate-ai-btn');

        const buttons = [editButton, regenerateButton, closeButton, generateButton].filter(btn => btn);

        if (isLoading) {
            // 启用加载状态
            buttons.forEach(button => {
                if (button) {
                    button.disabled = true;
                    button.style.opacity = '0.6';
                    button.style.cursor = 'not-allowed';
                }
            });

            // 添加加载遮罩
            if (!modal.querySelector('.ai-loading-overlay')) {
                const loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'ai-loading-overlay';
                loadingOverlay.innerHTML = `
                    <div class="ai-loading-spinner">
                        <div class="spinner"></div>
                        <p>AI正在生成健康建议...</p>
                        <small>请勿关闭窗口</small>
                    </div>
                `;
                modal.appendChild(loadingOverlay);
            }
        } else {
            // 禁用加载状态
            buttons.forEach(button => {
                if (button) {
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';
                }
            });

            // 移除加载遮罩
            const loadingOverlay = modal.querySelector('.ai-loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.remove();
            }
        }
    },

    // 再次生成AI建议
    async regenerateAISuggestions(noteId) {
        try {
            // 设置加载状态
            this.setAIGenerationLoadingState(true);
            
            const regenerateButton = document.querySelector('.regenerate-ai-btn');
            if (regenerateButton) {
                regenerateButton.textContent = '生成AI建议中...';
            }
            
            console.log('🔄 再次生成AI建议，笔记ID:', noteId);
            
            // 调用后端API生成AI建议，传递真实天气数据给Gemini
            console.log('🚀 再次调用API，传递真实天气数据给Gemini');
            const response = await ApiClient.notes.generateAISuggestions(noteId);
            
            if (response.success) {
                console.log('✅ AI建议再次生成成功:', response.data);
                
                // 更新界面显示AI建议
                const aiSuggestionsSection = document.querySelector('.detail-section:last-child .ai-suggestions-content');
                if (aiSuggestionsSection) {
                    // 直接更新AI建议内容
                    aiSuggestionsSection.innerHTML = this.formatAISuggestions(response.data.ai_suggestions);
                }
                
                // 更新本地数据
                Object.keys(this.notes).forEach(userId => {
                    const noteIndex = this.notes[userId].findIndex(note => note.id === noteId);
                    if (noteIndex !== -1) {
                        this.notes[userId][noteIndex].ai_suggestions = response.data.ai_suggestions;
                    }
                });
                
                this.showMessage('AI建议再次生成成功！', 'success');
            } else {
                throw new Error(response.message || '再次生成AI建议失败');
            }
            
        } catch (error) {
            console.error('❌ 再次生成AI建议失败:', error);
            this.showMessage('再次生成AI建议失败: ' + error.message, 'error');
        } finally {
            // 恢复所有按钮状态
            this.setAIGenerationLoadingState(false);
            
            const regenerateButton = document.querySelector('.regenerate-ai-btn');
            if (regenerateButton) {
                regenerateButton.textContent = '再次生成AI建议';
            }
        }
    },

    // 生成AI建议
    async generateAISuggestions(noteId) {
        try {
            // 设置加载状态
            this.setAIGenerationLoadingState(true);
            
            const button = document.querySelector('.generate-ai-btn');
            if (button) {
                button.textContent = '生成中...';
            }
            
            console.log('🤖 开始生成AI建议，笔记ID:', noteId);
            
            // 调用后端API生成AI建议，传递真实天气数据给Gemini
            console.log('🚀 调用API，传递真实天气数据给Gemini');
            const response = await ApiClient.notes.generateAISuggestions(noteId);
            
            if (response.success) {
                console.log('✅ AI建议生成成功:', response.data);
                
                // 更新界面显示AI建议
                const aiSuggestionsSection = document.querySelector('.detail-section:last-child');
                if (aiSuggestionsSection) {
                    // 查找AI建议容器
                    const noSuggestionsElement = aiSuggestionsSection.querySelector('.no-suggestions');
                    const generateButton = aiSuggestionsSection.querySelector('.generate-ai-btn');
                    
                    if (noSuggestionsElement && generateButton) {
                        // 替换"暂无AI建议"和按钮为实际建议内容
                        const aiContentHtml = `<div class="ai-suggestions-content">${this.formatAISuggestions(response.data.ai_suggestions)}</div>`;
                        noSuggestionsElement.outerHTML = aiContentHtml;
                        generateButton.remove();
                    }
                }
                
                // 更新本地数据
                Object.keys(this.notes).forEach(userId => {
                    const noteIndex = this.notes[userId].findIndex(note => note.id === noteId);
                    if (noteIndex !== -1) {
                        this.notes[userId][noteIndex].ai_suggestions = response.data.ai_suggestions;
                    }
                });
                
                this.showMessage('AI建议生成成功！', 'success');
            } else {
                throw new Error(response.message || '生成AI建议失败');
            }
            
        } catch (error) {
            console.error('❌ 生成AI建议失败:', error);
            this.showMessage('生成AI建议失败: ' + error.message, 'error');
        } finally {
            // 恢复所有按钮状态
            this.setAIGenerationLoadingState(false);
            
            const button = document.querySelector('.generate-ai-btn');
            if (button) {
                button.textContent = '获取AI建议';
            }
        }
    },

    // 删除笔记
    async deleteNote(noteId) {
        if (!confirm('确定要删除这条健康笔记吗？此操作无法撤销。')) {
            return;
        }
        
        try {
            console.log('🗑️ [Notes] 开始删除笔记:', noteId);
            
            const response = await ApiClient.notes.delete(noteId);
            
            if (response.success) {
                console.log('✅ [Notes] 后端删除成功，开始更新本地数据');
                
                // 🔥 关键修复：重新从API加载最新数据，而不是手动操作本地数据
                // 这样可以确保数据的一致性，避免与WebSocket同步冲突
                await this.loadNotesFromAPI(true, this.currentUser);
                
                this.showMessage('笔记删除成功', 'success');
                console.log('✅ [Notes] 删除操作完成，界面已更新');
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('❌ [Notes] 删除笔记失败:', error);
            this.showMessage('删除笔记失败: ' + error.message, 'error');
        }
    },



    // 显示离线错误
    showOfflineError() {
        const contentArea = Utils.$('#contentArea');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="offline-error">
                    <div class="error-icon">🔌</div>
                    <h2>服务器连接失败</h2>
                    <p>无法连接到后端服务器，请检查：</p>
                    <p>1. 后端服务是否正常运行</p>
                    <p>2. 网络连接是否正常</p>
                    <button class="retry-btn" onclick="location.reload()">重试</button>
                </div>
            `;
        }
    },

    // 显示消息
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        document.body.appendChild(messageEl);
        
        // 3秒后自动移除
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    },

    // 格式化AI建议内容
    formatAISuggestions(suggestions) {
        if (!suggestions) return '';
        
        // 将markdown格式转换为HTML
        let formatted = suggestions
            // 处理加粗文本 **text** -> <strong>text</strong>
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // 处理换行
            .replace(/\n/g, '<br>')
            // 处理空行
            .replace(/<br><br>/g, '<br><br>');
        
        // 特别处理今日建议部分
        if (formatted.includes('🌅 今日建议')) {
            // 找到今日建议的开始和结束位置
            const todayStart = formatted.indexOf('<strong>🌅 今日建议</strong>');
            const nextSectionStart = formatted.indexOf('<strong>👩‍⚕️', todayStart);
            
            if (todayStart !== -1) {
                const todayEnd = nextSectionStart !== -1 ? nextSectionStart : formatted.length;
                const todayContent = formatted.substring(todayStart, todayEnd);
                const restContent = formatted.substring(todayEnd);
                const beforeContent = formatted.substring(0, todayStart);
                
                // 为今日建议添加特殊样式
                const highlightedToday = `<div class="today-suggestion-highlight">${todayContent}</div>`;
                formatted = beforeContent + highlightedToday + restContent;
            }
        }
        
        return `<div style="white-space: normal; line-height: 1.6;">${formatted}</div>`;
    },

    // 分享笔记功能
    async shareNote(noteId) {
        try {
            console.log('🔗 开始分享笔记，ID:', noteId);
            
            // 获取笔记详情
            const response = await ApiClient.notes.getById(noteId);
            if (!response.success) {
                throw new Error(response.message);
            }
            
            const note = response.data;
            
            // 创建分享内容
            await this.generateShareImage(note);
            
        } catch (error) {
            console.error('❌ 分享笔记失败:', error);
            this.showMessage('分享笔记失败: ' + error.message, 'error');
        }
    },

    // 生成分享图片
    async generateShareImage(note) {
        try {
            // 创建分享内容容器
            const shareContainer = document.createElement('div');
            shareContainer.className = 'share-content-container';
            shareContainer.style.cssText = `
                position: fixed;
                top: -9999px;
                left: -9999px;
                width: 600px;
                background: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                z-index: -1;
            `;
            
            // 格式化分享内容
            const shareContent = this.formatShareContent(note);
            shareContainer.innerHTML = shareContent;
            
            document.body.appendChild(shareContainer);
            
            // 检查是否有html2canvas库
            if (typeof html2canvas === 'undefined') {
                // 动态加载html2canvas库
                await this.loadHtml2Canvas();
            }
            
            // 生成图片
            console.log('📸 开始生成分享图片...');
            const canvas = await html2canvas(shareContainer, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                width: 600,
                height: shareContainer.offsetHeight
            });
            
            // 清理临时容器
            document.body.removeChild(shareContainer);
            
            // 下载图片
            this.downloadImage(canvas, `健康档案-${note.title}-${new Date().toISOString().split('T')[0]}.png`);
            
            this.showMessage('健康档案图片已生成，正在下载...', 'success');
            
        } catch (error) {
            console.error('❌ 生成分享图片失败:', error);
            this.showMessage('生成分享图片失败: ' + error.message, 'error');
        }
    },

    // 格式化分享内容
    formatShareContent(note) {
        const currentDate = new Date().toLocaleDateString('zh-CN');
        
        return `
            <div style="padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="background: white; border-radius: 16px; padding: 32px; color: #333; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <h1 style="font-size: 24px; font-weight: 700; color: #1d9bf0; margin: 0 0 8px 0;">雯婷健康档案</h1>
                        <p style="color: #657786; margin: 0; font-size: 14px;">生成日期: ${currentDate}</p>
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                        <h2 style="font-size: 20px; font-weight: 600; color: #14171a; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #1d9bf0;">${Utils.escapeHtml(note.title)}</h2>
                    </div>
                    
                    ${note.description ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="font-size: 16px; font-weight: 600; color: #495057; margin: 0 0 8px 0;">详细描述</h3>
                            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #28a745;">
                                <p style="margin: 0; line-height: 1.6; color: #495057;">${Utils.escapeHtml(note.description)}</p>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${note.precautions ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="font-size: 16px; font-weight: 600; color: #495057; margin: 0 0 8px 0;">注意事项/医嘱</h3>
                            <div style="background: #fff3cd; padding: 16px; border-radius: 8px; border-left: 4px solid #ffc107;">
                                <p style="margin: 0; line-height: 1.6; color: #856404;">${Utils.escapeHtml(note.precautions)}</p>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${note.ai_suggestions ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="font-size: 16px; font-weight: 600; color: #495057; margin: 0 0 8px 0;">AI健康建议</h3>
                            <div style="background: #e7f3ff; padding: 16px; border-radius: 8px; border-left: 4px solid #1d9bf0;">
                                <div style="margin: 0; line-height: 1.6; color: #0c5460;">${this.formatAISuggestionsForShare(note.ai_suggestions)}</div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e1e8ed;">
                        <p style="margin: 0; font-size: 12px; color: #657786;">此健康档案由雯婷应用生成 | 仅供参考，如有疑问请咨询专业医师</p>
                    </div>
                </div>
            </div>
        `;
    },

    // 格式化AI建议用于分享
    formatAISuggestionsForShare(suggestions) {
        if (!suggestions) return '';
        
        return suggestions
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1d9bf0;">$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/<br><br>/g, '<br><br>');
    },

    // 动态加载html2canvas库
    async loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = () => {
                console.log('✅ html2canvas库加载成功');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ html2canvas库加载失败');
                reject(new Error('无法加载图片生成库'));
            };
            document.head.appendChild(script);
        });
    },

    // 下载图片
    downloadImage(canvas, filename) {
        try {
            // 创建下载链接
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('✅ 图片下载成功:', filename);
        } catch (error) {
            console.error('❌ 图片下载失败:', error);
            throw error;
        }
    },

    // 绑定事件
    bindEvents() {
        // 用户标签点击事件在TodoManager中已处理，这里不需要重复绑定
    }
};

// 导出到全局
window.NotesManager = NotesManager;