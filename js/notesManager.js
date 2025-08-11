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


    // 显示编辑笔记内容表单（只编辑描述和注意事项）
    async showEditNoteContentForm(noteId) {
        try {
            // 获取笔记详情
            const response = await ApiClient.notes.getById(noteId);
            if (!response.success) {
                throw new Error(response.message);
            }
            
            const note = response.data;
            const formHtml = `
                <div class="modal-overlay" id="editNoteContentModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>编辑笔记内容</h3>
                            <button class="modal-close" onclick="NotesManager.closeNoteContentForm()">×</button>
                        </div>
                        <form class="note-form" onsubmit="NotesManager.handleEditNoteContent(event, ${noteId})">
                            <div class="form-group">
                                <label for="edit-content-description">详细描述</label>
                                <textarea id="edit-content-description" name="description" rows="4" 
                                          placeholder="详细描述您的健康状况...">${Utils.escapeHtml(note.description || '')}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="edit-content-precautions">注意事项/医嘱</label>
                                <textarea id="edit-content-precautions" name="precautions" rows="3" 
                                          placeholder="医生建议、注意事项等...">${Utils.escapeHtml(note.precautions || '')}</textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" onclick="NotesManager.closeNoteContentForm()">取消</button>
                                <button type="submit">保存修改</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', formHtml);
        } catch (error) {
            console.error('显示编辑内容表单失败:', error);
            this.showMessage('加载笔记数据失败: ' + error.message, 'error');
        }
    },

    // 处理编辑笔记内容
    async handleEditNoteContent(event, noteId) {
        event.preventDefault();
        
        const form = event.target;
        const submitButton = form.querySelector('button[type="submit"]');
        
        try {
            // 防止重复提交
            submitButton.disabled = true;
            submitButton.textContent = '保存中...';
            
            const formData = new FormData(form);
            const noteData = {
                description: formData.get('description').trim(),
                precautions: formData.get('precautions').trim()
                // 注意：这里不包括 ai_suggestions，保持不变
            };
            
            console.log('🔄 更新笔记内容:', noteId, noteData);
            const response = await ApiClient.notes.update(noteId, noteData);
            
            if (response.success) {
                console.log('✅ [Notes] 内容更新成功:', response.data);
                
                // 重新从API加载最新数据，确保数据一致性
                await this.loadNotesFromAPI(true, this.currentUser);
                
                // 关闭编辑表单
                this.closeNoteContentForm();
                
                // 更新详情页面内容
                this.updateNoteDetailsContent(noteId, response.data);
                
                this.showMessage('笔记内容更新成功！', 'success');
                console.log('✅ [Notes] 内容更新操作完成，界面已更新');
            } else {
                throw new Error(response.message || '更新笔记内容失败');
            }
            
        } catch (error) {
            console.error('❌ 更新笔记内容失败:', error);
            this.showMessage('更新笔记内容失败: ' + error.message, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '保存修改';
        }
    },

    // 关闭笔记内容编辑表单
    closeNoteContentForm() {
        const modal = document.getElementById('editNoteContentModal');
        if (modal) {
            modal.remove();
        }
    },

    // 更新详情页面内容（不刷新整个详情页，只更新内容部分）
    updateNoteDetailsContent(noteId, updatedNote) {
        // 更新详细描述
        const descriptionElement = document.querySelector('.detail-section:nth-child(1) p');
        if (descriptionElement) {
            descriptionElement.textContent = updatedNote.description || 'N/A';
        }
        
        // 更新注意事项
        const precautionsElement = document.querySelector('.detail-section:nth-child(2) p');
        if (precautionsElement) {
            precautionsElement.textContent = updatedNote.precautions || 'N/A';
        }
        
        console.log('✅ 详情页面内容已更新');
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
                            <div class="detail-section">
                                <h4>详细描述</h4>
                                <p>${note.description ? Utils.escapeHtml(note.description) : 'N/A'}</p>
                            </div>
                            <div class="detail-section">
                                <h4>注意事项/医嘱</h4>
                                <p>${note.precautions ? Utils.escapeHtml(note.precautions) : 'N/A'}</p>
                            </div>
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
                            <button onclick="NotesManager.showEditNoteContentForm(${noteId})" class="edit-content-btn">编辑</button>
                            ${note.ai_suggestions ? `<button onclick="NotesManager.regenerateAISuggestions(${noteId})" class="regenerate-ai-btn">再次生成AI建议</button>` : ''}
                            <button onclick="NotesManager.shareNoteAsImage(${noteId})" class="share-note-btn">分享</button>
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
        const editButton = modal.querySelector('.edit-content-btn');
        const regenerateButton = modal.querySelector('.regenerate-ai-btn');
        const generateButton = modal.querySelector('.generate-ai-btn');
        const shareButton = modal.querySelector('.share-note-btn');

        const buttons = [editButton, regenerateButton, generateButton, shareButton].filter(btn => btn);

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
                        
                        // 在模态框底部添加"再次生成AI建议"按钮
                        const modalActions = document.querySelector('.modal-actions');
                        if (modalActions && !modalActions.querySelector('.regenerate-ai-btn')) {
                            // 在分享按钮之前插入"再次生成AI建议"按钮
                            const shareButton = modalActions.querySelector('.share-note-btn');
                            const regenerateButton = document.createElement('button');
                            regenerateButton.className = 'regenerate-ai-btn';
                            regenerateButton.setAttribute('onclick', `NotesManager.regenerateAISuggestions(${noteId})`);
                            regenerateButton.textContent = '再次生成AI建议';
                            
                            if (shareButton) {
                                modalActions.insertBefore(regenerateButton, shareButton);
                            } else {
                                modalActions.appendChild(regenerateButton);
                            }
                        }
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

    // 分享笔记为图片
    async shareNoteAsImage(noteId) {
        try {
            console.log('📸 开始分享笔记为图片，ID:', noteId);
            this.setShareLoadingState(true);
            const modal = document.getElementById('noteDetailsModal');
            if (!modal) throw new Error('找不到笔记详情页面');
            this.setAIGenerationLoadingState(true);
            this.showShareLoadingOverlay(modal);
            await this.ensureHtml2Canvas();
            await new Promise(res => setTimeout(res, 250));
            const response = await ApiClient.notes.getById(noteId);
            const note = response.success ? response.data : null;

            // 构建专用分享DOM
            const shareDiv = document.createElement('div');
            shareDiv.id = 'note-share-capture';
            shareDiv.style.cssText = `
                width: 600px; margin: 0 auto; background: #fafaf7; color: #222; font-family: 'Noto Sans SC', 'Segoe UI', Arial, sans-serif; border-radius: 12px; border: 1px solid #e1e1e1; box-shadow: 0 2px 8px #eee; padding: 36px 36px 70px 36px; position: relative; line-height: 1.7; letter-spacing: 0.01em;`
            ;
            // 电子墨水风格内容
            shareDiv.innerHTML = `
                <div style="font-size: 2.1rem; font-weight: 700; text-align: center; margin-bottom: 18px; letter-spacing: 0.04em;">${Utils.escapeHtml(note.title)}</div>
                <div style="border-bottom:1.5px solid #e1e1e1; margin-bottom:18px;"></div>
                <div style="margin-bottom: 18px;"><span style="font-weight:600;">详细描述</span><div style="margin-top:6px; color:#222;">${note.description ? Utils.escapeHtml(note.description) : 'N/A'}</div></div>
                <div style="margin-bottom: 18px;"><span style="font-weight:600;">注意事项/医嘱</span><div style="margin-top:6px; color:#222;">${note.precautions ? Utils.escapeHtml(note.precautions) : 'N/A'}</div></div>
                <div style="margin-bottom: 18px;"><span style="font-weight:600;">AI建议</span><div style="margin-top:6px; color:#222;">${note.ai_suggestions ? this.formatAISuggestions(note.ai_suggestions).replace(/<br>/g, '<br/>') : '暂无AI建议'}</div></div>
                <div style="position:absolute;left:0;right:0;bottom:18px;text-align:center;color:#888;font-size:15px;letter-spacing:0.04em;">
                    <span style="font-weight:700;">WENTING</span><br/>
                    Household Health Supervisor
                </div>
            `;
            document.body.appendChild(shareDiv);
            // 截图
            const canvas = await html2canvas(shareDiv, {
                backgroundColor: '#fafaf7',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                width: 600
            });
            // 清理
            document.body.removeChild(shareDiv);
            this.hideShareLoadingOverlay();
            this.setAIGenerationLoadingState(false);
            this.setShareLoadingState(false);
            // 保存
            const filename = `雯婷健康档案-${note ? note.title : 'note'}-${new Date().toISOString().split('T')[0]}.png`;
            await this.saveImageByDevice(canvas, filename);
        } catch (error) {
            console.error('❌ 分享笔记图片失败:', error);
            this.showMessage('生成图片失败: ' + error.message, 'error');
        } finally {
            this.setShareLoadingState(false);
            this.setAIGenerationLoadingState(false);
            this.hideShareLoadingOverlay();
        }
    },

    // 设置分享加载状态
    setShareLoadingState(isLoading) {
        const shareButton = document.querySelector('.share-note-btn');
        if (!shareButton) return;

        if (isLoading) {
            shareButton.disabled = true;
            shareButton.textContent = '生成中...';
            shareButton.style.opacity = '0.6';
        } else {
            shareButton.disabled = false;
            shareButton.textContent = '分享';
            shareButton.style.opacity = '1';
        }
    },

    // 确保html2canvas库已加载
    async ensureHtml2Canvas() {
        if (typeof html2canvas !== 'undefined') {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = () => {
                console.log('✅ html2canvas库加载成功');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ html2canvas库加载失败');
                reject(new Error('无法加载图片生成库，请检查网络连接'));
            };
            document.head.appendChild(script);
        });
    },

    // 检测设备类型
    detectDeviceType() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/.test(userAgent);
        const isIOS = /ipad|iphone|ipod/.test(userAgent);
        const isAndroid = /android/.test(userAgent);
        
        return {
            isMobile,
            isIOS,
            isAndroid,
            isDesktop: !isMobile
        };
    },

    // 根据设备类型保存图片
    async saveImageByDevice(canvas, filename) {
        const device = this.detectDeviceType();
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        
        try {
            if (device.isMobile) {
                // 移动设备：尝试保存到相册
                await this.saveToGallery(dataUrl, filename, device);
            } else {
                // 桌面设备：下载到桌面/下载文件夹
                this.downloadToDesktop(dataUrl, filename);
            }
        } catch (error) {
            console.error('❌ 保存图片失败:', error);
            // 降级处理：直接下载
            this.downloadToDesktop(dataUrl, filename);
        }
    },

    // 保存到移动设备相册
    async saveToGallery(dataUrl, filename, device) {
        try {
            // 尝试使用 Web Share API (现代浏览器支持)
            if (navigator.share && navigator.canShare) {
                const blob = this.dataUrlToBlob(dataUrl);
                const file = new File([blob], filename, { type: 'image/png' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: '雯婷健康档案',
                        text: '分享我的健康档案'
                    });
                    this.showSuccessMessage('✅ 健康档案已成功分享！', '图片已通过系统分享保存到设备');
                    return;
                }
            }

            // 降级方案1：创建下载链接（会保存到下载文件夹）
            if (device.isAndroid || device.isIOS) {
                this.downloadToDesktop(dataUrl, filename);
                
                if (device.isIOS) {
                    this.showSuccessMessage('📱 图片已保存成功！', 'iPhone用户：图片在下载文件夹中，长按选择"存储到相册"即可保存到相册');
                } else {
                    this.showSuccessMessage('📱 图片已保存到相册！', 'Android用户：图片已保存到下载文件夹，可在相册中查看');
                }
                return;
            }

            // 降级方案2：直接下载
            this.downloadToDesktop(dataUrl, filename);
            this.showSuccessMessage('📱 图片已下载成功！', '请手动将图片保存到相册');
            
        } catch (error) {
            console.error('❌ 保存到相册失败:', error);
            throw error;
        }
    },

    // 下载到桌面/下载文件夹
    downloadToDesktop(dataUrl, filename) {
        try {
            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('✅ 图片下载成功:', filename);
            
            const device = this.detectDeviceType();
            if (device.isDesktop) {
                this.showSuccessMessage('💻 健康档案已保存成功！', '图片已保存到电脑的下载文件夹中');
            } else {
                this.showSuccessMessage('📱 图片已下载完成！', '请在下载文件夹中查看');
            }
            
        } catch (error) {
            console.error('❌ 图片下载失败:', error);
            throw error;
        }
    },

    // 将 Data URL 转换为 Blob
    dataUrlToBlob(dataUrl) {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        return new Blob([u8arr], { type: mime });
    },

    // 显示分享加载遮罩
    showShareLoadingOverlay(modal) {
        // 如果已经存在遮罩，先移除
        this.hideShareLoadingOverlay();
        
        // 复用AI生成的加载遮罩样式
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'ai-loading-overlay share-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="ai-loading-spinner">
                <div class="spinner"></div>
                <p>正在生成健康档案图片...</p>
                <small>请稍候，正在处理中</small>
            </div>
        `;
        modal.appendChild(loadingOverlay);
    },

    // 隐藏分享加载遮罩
    hideShareLoadingOverlay() {
        const loadingOverlay = document.querySelector('.share-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    },

    // 绑定事件
    bindEvents() {
        // 用户标签点击事件在TodoManager中已处理，这里不需要重复绑定
    }
};

// 导出到全局
window.NotesManager = NotesManager;