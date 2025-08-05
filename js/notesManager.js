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
        
        // 渲染界面
        this.renderNotesPanel(this.currentUser);
        this.bindEvents();
        
        console.log('✅ Notes管理器初始化完成');
    },

    // 等待用户管理器初始化完成
    async waitForUserManager() {
        if (UserManager.users.length === 0) {
            await new Promise(resolve => {
                const checkUsers = () => {
                    if (UserManager.users.length > 0) {
                        resolve();
                    } else {
                        setTimeout(checkUsers, 100);
                    }
                };
                checkUsers();
            });
        }
    },

    // 从API加载Notes数据
    async loadNotesFromAPI() {
        try {
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
        } catch (error) {
            console.error('❌ 加载Notes数据失败:', error);
            this.showMessage('加载笔记数据失败: ' + error.message, 'error');
            // 初始化空数据
            UserManager.users.forEach(user => {
                this.notes[user.id] = [];
            });
        }
    },

    // 设置默认用户
    setDefaultUser() {
        if (UserManager.users.length > 0) {
            this.currentUser = UserManager.users[0].id;
            console.log('📍 设置默认用户:', this.currentUser);
        }
    },

    // 渲染Notes面板
    renderNotesPanel(userId) {
        const contentArea = Utils.$('#contentArea');
        if (!contentArea) return;

        const userNotes = this.notes[userId] || [];
        console.log(`🎨 渲染用户 ${userId} 的Notes面板，共 ${userNotes.length} 条笔记`);

        const panelHtml = `
            <div class="notes-panel" id="${userId}-notes-panel">
                <div class="notes-container">
                    ${userNotes.length > 0 
                        ? userNotes.map(note => this.renderNoteCard(note, userId)).join('')
                        : this.renderEmptyState()
                    }
                </div>
                <button class="new-note-btn" onclick="NotesManager.showAddNoteForm(${userId})">+ 添加新笔记</button>
            </div>
        `;

        contentArea.innerHTML = panelHtml;
        
        // 更新用户标签状态
        this.updateUserTabs(userId);
    },

    // 渲染笔记卡片
    renderNoteCard(note, userId) {
        const shortDescription = note.description.length > 50 
            ? note.description.substring(0, 50) + '...' 
            : note.description;

        return `
            <div class="note-card" data-note-id="${note.id}">
                <div class="note-header">
                    <h3 class="note-title">${Utils.escapeHtml(note.title)}</h3>
                    <div class="note-actions">
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
                <div class="note-footer">
                    <button class="view-details-btn" onclick="NotesManager.showNoteDetails(${note.id})">
                        查看更多
                    </button>
                </div>
            </div>
        `;
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
                console.log('✅ 笔记创建成功:', response.data);
                
                // 更新本地数据
                if (!this.notes[userId]) {
                    this.notes[userId] = [];
                }
                this.notes[userId].unshift(response.data);
                
                // 重新渲染
                this.renderNotesPanel(userId);
                
                // 关闭表单
                this.closeNoteForm();
                
                this.showMessage('笔记添加成功！', 'success');
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
                console.log('✅ 笔记更新成功:', response.data);
                
                // 更新本地数据
                Object.keys(this.notes).forEach(userId => {
                    const noteIndex = this.notes[userId].findIndex(note => note.id === noteId);
                    if (noteIndex !== -1) {
                        this.notes[userId][noteIndex] = { ...this.notes[userId][noteIndex], ...response.data };
                    }
                });
                
                // 重新渲染当前用户的面板
                this.renderNotesPanel(this.currentUser);
                
                // 关闭表单
                this.closeNoteForm();
                
                // 如果详情模态框打开，也关闭它
                this.closeNoteDetails();
                
                this.showMessage('笔记更新成功！', 'success');
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
            
            // 调用后端API生成AI建议，Gemini将自主获取天气数据
            console.log('🚀 再次调用API，Gemini将自主获取天气数据');
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
            
            // 调用后端API生成AI建议，Gemini将自主获取天气数据
            console.log('🚀 调用API，Gemini将自主获取天气数据');
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
            const response = await ApiClient.notes.delete(noteId);
            
            if (response.success) {
                // 从本地数据中移除
                Object.keys(this.notes).forEach(userId => {
                    this.notes[userId] = this.notes[userId].filter(note => note.id !== noteId);
                });
                
                // 重新渲染当前用户的面板
                this.renderNotesPanel(this.currentUser);
                
                this.showMessage('笔记删除成功', 'success');
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('删除笔记失败:', error);
            this.showMessage('删除笔记失败: ' + error.message, 'error');
        }
    },

    // 切换用户
    switchUser(userId) {
        console.log('切换到用户:', userId);
        this.currentUser = parseInt(userId);
        this.renderNotesPanel(this.currentUser);
    },

    // 更新用户标签状态
    updateUserTabs(activeUserId) {
        const userTabs = Utils.$$('.sidebar-tab');
        userTabs.forEach(tab => {
            const tabUserId = tab.dataset.tab;
            if (parseInt(tabUserId) === parseInt(activeUserId)) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
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

    // 绑定事件
    bindEvents() {
        // 用户标签点击事件在TodoManager中已处理，这里不需要重复绑定
    }
};

// 导出到全局
window.NotesManager = NotesManager;