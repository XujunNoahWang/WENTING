// 主应用程序
const App = {
    // 防重复调用标志
    _refreshingAfterLink: false,
    
    init() {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeApp();
            });
        } else {
            this.initializeApp();
        }
    },

    // 初始化应用
    async initializeApp() {
        console.log('雯婷应用启动中...');
        
        try {
            // 按顺序初始化各个模块
            await this.initializeModules();
            
            // 绑定全局事件
            this.bindGlobalEvents();
            
            console.log('雯婷应用启动完成');
        } catch (error) {
            console.error('应用初始化失败:', error);
        }
    },

    // 初始化模块
    async initializeModules() {
        // 首先初始化设备管理器
        if (window.DeviceManager) {
            await DeviceManager.init();
        }
        
        // 确保 ApiClient 已加载
        if (typeof window.ApiClient === 'undefined') {
            console.error('❌ ApiClient 未加载，请检查脚本加载顺序');
            return;
        }
        
        // 初始化全局用户状态管理器
        if (window.GlobalUserState) {
            GlobalUserState.init();
        }
        
        // 初始化日期管理器
        DateManager.init();
        
        // 初始化天气管理器（等待地理位置获取完成）
        if (window.WeatherManager) {
            await WeatherManager.init();
            // 启动天气自动更新（30分钟间隔）
            WeatherManager.startAutoUpdate();
        } else {
            console.error('❌ WeatherManager未加载');
        }
        
        // 初始化用户管理器（异步，需要等待完成）
        await UserManager.init();
        
        // 初始化TODO管理器（最后初始化，因为它依赖用户管理器）
        await TodoManager.init();
        
        // 初始化Notes管理器
        if (window.NotesManager) {
            await NotesManager.init();
        }
        
        // 初始化Profile管理器
        if (window.ProfileManager) {
            await ProfileManager.init();
        }
        
        // 设置默认模块为todo
        if (window.GlobalUserState) {
            GlobalUserState.setCurrentModule('todo');
            // 绑定全局用户选择器事件
            GlobalUserState.bindUserSelectorEvents();
        }
        
        // 初始化WebSocket连接
        if (window.WebSocketClient) {
            try {
                await WebSocketClient.init();
                console.log('✅ WebSocket连接已建立');
                
                // 🔥 关键修复：确保注册消息在用户信息准备好后发送
                this.ensureWebSocketRegistration();
            } catch (error) {
                console.error('⚠️ WebSocket连接失败，但应用将继续使用HTTP模式:', error);
            }
        }
        
        // 完成加载，显示应用界面
        if (window.LoadingManager) {
            LoadingManager.completeLoading();
            
            // 监听应用容器显示事件，然后初始化用户界面
            this.waitForAppContainerVisible();
        } else {
            console.log('⚠️ LoadingManager不存在，直接初始化用户界面');
            // 延迟一下确保DOM渲染完成
            setTimeout(() => {
                this.initializeUserInterface();
            }, 100);
        }
    },

    // 等待应用容器显示
    waitForAppContainerVisible() {
        console.log('⏳ 等待应用容器显示...');
        
        const checkAppContainer = () => {
            const appContainer = document.getElementById('appContainer');
            const loadingScreen = document.getElementById('loadingScreen');
            
            console.log('🔍 检查应用容器状态:');
            console.log('  - appContainer存在:', !!appContainer);
            console.log('  - appContainer显示:', appContainer?.style.display !== 'none');
            console.log('  - loadingScreen存在:', !!loadingScreen);
            console.log('  - loadingScreen显示:', loadingScreen?.style.display !== 'none');
            
            if (appContainer && appContainer.style.display !== 'none' && 
                (!loadingScreen || loadingScreen.style.display === 'none')) {
                console.log('✅ 应用容器已显示，开始初始化用户界面');
                this.initializeUserInterface();
            } else {
                console.log('⏳ 应用容器还未显示，继续等待...');
                setTimeout(checkAppContainer, 100);
            }
        };
        
        // 开始检查
        setTimeout(checkAppContainer, 500); // 给LoadingManager一些时间开始动画
    },

    // 初始化用户界面
    async initializeUserInterface() {
        console.log('🎨 开始初始化用户界面');
        console.log('🔍 调试信息:');
        console.log('  - TodoManager存在:', !!window.TodoManager);
        console.log('  - TodoManager.currentUser:', window.TodoManager?.currentUser);
        console.log('  - UserManager存在:', !!window.UserManager);
        console.log('  - UserManager.users数量:', window.UserManager?.users?.length || 0);
        console.log('  - GlobalUserState存在:', !!window.GlobalUserState);
        console.log('  - GlobalUserState.currentUserId:', window.GlobalUserState?.currentUserId);
        console.log('  - 当前模块:', window.GlobalUserState?.getCurrentModule());
        
        if (!window.TodoManager) {
            console.error('❌ TodoManager未初始化');
            return;
        }

        // 检查是否有用户数据存在
        if (window.UserManager && window.UserManager.users && window.UserManager.users.length > 0) {
            // 确保当前用户已设置
            if (!TodoManager.currentUser) {
                console.log('⚠️ 当前用户未设置，重新设置默认用户');
                TodoManager.setDefaultUser();
            }
            
            console.log('🎯 当前用户ID:', TodoManager.currentUser);
            console.log('🎯 当前模块:', GlobalUserState ? GlobalUserState.getCurrentModule() : 'unknown');
            
            // 首先渲染用户标签
            if (window.UserManager) {
                console.log('🔄 开始渲染用户标签...');
                window.UserManager.renderUserTabs();
                console.log('✅ 用户标签渲染完成');
            }
            
            // 然后更新用户选择器UI
            if (window.GlobalUserState) {
                console.log('🔄 开始更新用户选择器UI...');
                GlobalUserState.updateUserSelectorUI();
                console.log('✅ 用户选择器UI更新完成');
            }
            
            // 最后渲染TODO内容（如果当前模块是todo）
            if (window.GlobalUserState && GlobalUserState.getCurrentModule() === 'todo') {
                console.log('🔄 开始加载并渲染TODO内容');
                console.log('🔍 TODO数据调试:');
                console.log('  - TodoManager.todos:', TodoManager.todos);
                console.log('  - 当前用户的TODO数据:', TodoManager.todos[TodoManager.currentUser]);
                
                // 通过触发用户切换事件来加载TODO，确保与用户点击切换的行为一致
                if (TodoManager.currentUser) {
                    console.log('🎯 通过全局状态触发用户切换事件来初始化TODO显示');
                    
                    // 临时设置为null，确保setCurrentUser会触发事件
                    const targetUserId = TodoManager.currentUser;
                    GlobalUserState.currentUserId = null;
                    GlobalUserState.setCurrentUser(targetUserId);
                    
                    console.log('✅ 强制触发用户切换事件完成');
                } else {
                    console.warn('⚠️ 当前用户未设置，无法加载TODO');
                }
            } else {
                console.log('⚠️ 当前模块不是todo，跳过TODO渲染');
            }
        } else {
            console.log('🎨 没有用户，显示空用户状态');
            TodoManager.showEmptyUserState();
        }
    },

    // 绑定全局事件
    bindGlobalEvents() {
        // 绑定添加用户按钮事件
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                if (window.UserManager && typeof UserManager.addUser === 'function') {
                    UserManager.addUser();
                } else {
                    console.error('UserManager.addUser 方法不可用');
                }
            });
        }
        
        // 底部导航点击效果 - 使用事件委托确保正确绑定
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                const label = navItem.querySelector('.nav-label')?.textContent;
                console.log('导航到：', label);
                
                // 显示进度条（针对Todo和Notes页面切换）
                if ((label === 'Todo' || label === 'Notes') && window.DateManager) {
                    window.DateManager.showLoadingProgress();
                }
                
                // 这里可以添加路由逻辑
                this.handleNavigation(label);
            }
        });

        // 天气栏点击处理
        const weatherBar = Utils.$('.weather-bar');
        if (weatherBar) {
            weatherBar.addEventListener('click', (e) => {
                if (!window.WeatherManager) {
                    console.error('❌ WeatherManager未加载');
                    return;
                }
                
                // 如果点击的是位置区域且位置未授权，请求位置权限
                const locationElement = e.target.closest('.weather-location');
                if (locationElement && locationElement.classList.contains('error')) {
                    console.log('用户点击位置未授权区域，请求位置权限');
                    WeatherManager.requestLocationPermission();
                } else {
                    console.log('用户点击天气栏，刷新天气数据');
                    WeatherManager.refreshWeather();
                }
            });
            
            // 添加悬停提示
            weatherBar.style.cursor = 'pointer';
            weatherBar.title = '点击刷新天气数据，位置未授权时点击可请求权限';
        }

        // 全局错误处理
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
        });

        // 页面可见性变化处理
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // 页面变为可见时，更新当前时间和天气
                if (window.DateManager) {
                    DateManager.updateCurrentDate();
                }
                
                // 检查天气数据是否需要更新
                if (window.WeatherManager && WeatherManager.weatherData?.lastUpdated) {
                    const lastUpdate = new Date(WeatherManager.weatherData.lastUpdated);
                    const now = new Date();
                    const diffMinutes = (now - lastUpdate) / (1000 * 60);
                    
                    // 如果超过15分钟，刷新天气
                    if (diffMinutes > 15) {
                        console.log('页面重新激活，刷新天气数据');
                        WeatherManager.fetchRealWeatherData();
                    }
                }
            }
        });

        // 在线/离线状态处理
        window.addEventListener('online', () => {
            console.log('网络连接恢复，刷新天气数据');
            if (window.WeatherManager) {
                WeatherManager.fetchRealWeatherData();
            }
        });

        window.addEventListener('offline', () => {
            console.log('网络连接断开，将使用缓存数据');
        });

        // 设备ID更新处理
        window.addEventListener('deviceIdUpdated', (event) => {
            console.log('🔄 设备ID已更新:', event.detail.deviceId);
            
            // 延迟重新加载用户数据，让设备ID生效
            setTimeout(async () => {
                try {
                    if (window.UserManager && typeof UserManager.loadUsers === 'function') {
                        console.log('🔄 重新加载用户数据...');
                        await UserManager.loadUsers();
                        console.log('✅ 用户数据重新加载完成');
                    }
                } catch (error) {
                    console.error('❌ 重新加载用户数据失败:', error);
                }
            }, 1000);
        });

        // WebSocket消息处理将在WebSocketClient初始化后处理
        // 这些处理器现在通过WebSocketClient的handleMessage方法处理
        console.log('🔌 Link功能WebSocket处理器已准备');
    },

    // 处理导航
    handleNavigation(page) {
        switch (page) {
            case 'Todo':
                // 显示Todo页面
                this.showTodoPage();
                break;
            case 'Notes':
                // 显示Notes页面
                this.showNotesPage();
                break;
            case 'Link':
                // 显示Link页面（在SPA内切换）
                this.showLinkPage();
                break;
            case 'Profile':
                // 显示Profile页面
                this.showProfilePage();
                break;
            default:
                console.log('未知导航目标:', page);
        }
    },

    // 显示Todo页面
    async showTodoPage() {
        console.log('切换到Todo页面');
        
        // 恢复左侧边栏显示
        if (window.ProfileManager) {
            ProfileManager.showLeftSidebar();
        }
        
        // 设置全局状态为todo模块
        if (window.GlobalUserState) {
            GlobalUserState.setCurrentModule('todo');
        }
        
        if (window.TodoManager) {
            const currentUser = GlobalUserState ? GlobalUserState.getCurrentUser() : TodoManager.currentUser;
            console.log('渲染TODO页面，用户:', currentUser);
            
            // 检查用户是否存在于UserManager中
            if (currentUser && window.UserManager && window.UserManager.users) {
                const userExists = UserManager.users.find(u => u.id === currentUser);
                if (!userExists) {
                    console.log('⚠️ 当前用户不在用户列表中，可能是新关联的用户，重新加载用户数据...');
                    try {
                        await UserManager.loadUsersFromAPI();
                        console.log('✅ 用户数据重新加载完成');
                    } catch (error) {
                        console.error('❌ 重新加载用户数据失败:', error);
                    }
                }
            }
            
            // 确保TODO数据已加载
            if (currentUser && (!TodoManager.todos[currentUser] || TodoManager.todos[currentUser].length === 0)) {
                console.log('🔄 TODO数据未加载，正在加载...');
                try {
                    await TodoManager.loadTodosFromAPI();
                    console.log('✅ TODO数据加载完成');
                } catch (error) {
                    console.error('❌ TODO数据加载失败:', error);
                }
            }
            
            TodoManager.renderTodoPanel(currentUser);
            
            // 隐藏进度条 - 延长显示时间让用户看到效果
            setTimeout(() => {
                if (window.DateManager) window.DateManager.hideLoadingProgress();
            }, 600);
        } else {
            console.error('TodoManager未初始化');
            // 即使出错也隐藏进度条
            setTimeout(() => {
                if (window.DateManager) window.DateManager.hideLoadingProgress();
            }, 300);
        }
    },

    // 显示Notes页面（优化版，避免重复初始化）
    async showNotesPage() {
        console.log('切换到Notes页面');
        
        try {
            // 恢复左侧边栏显示
            if (window.ProfileManager) {
                ProfileManager.showLeftSidebar();
            }
            
            // 设置全局状态为notes模块
            if (window.GlobalUserState) {
                GlobalUserState.setCurrentModule('notes');
            }
            
            if (window.NotesManager) {
                // 检查是否已初始化，避免重复初始化
                if (NotesManager.isOnline === false) {
                    // 重新检查连接状态
                    NotesManager.isOnline = await ApiClient.testConnection();
                }
                
                const currentUser = GlobalUserState ? GlobalUserState.getCurrentUser() : NotesManager.currentUser;
                console.log('切换到Notes页面，当前用户:', currentUser);
                
                // 检查用户是否存在于UserManager中
                if (currentUser && window.UserManager && window.UserManager.users) {
                    const userExists = UserManager.users.find(u => u.id === currentUser);
                    if (!userExists) {
                        console.log('⚠️ 当前用户不在用户列表中，可能是新关联的用户，重新加载用户数据...');
                        try {
                            await UserManager.loadUsersFromAPI();
                            console.log('✅ 用户数据重新加载完成');
                        } catch (error) {
                            console.error('❌ 重新加载用户数据失败:', error);
                        }
                    }
                }
                
                // 检查当前用户的Notes数据是否已加载
                if (currentUser && (!NotesManager.notes[currentUser] || NotesManager.notes[currentUser].length === 0)) {
                    console.log('🔄 Notes数据未加载，正在加载...');
                    try {
                        await NotesManager.loadNotesFromAPI();
                        console.log('✅ Notes数据加载完成');
                    } catch (error) {
                        console.error('❌ Notes数据加载失败:', error);
                    }
                }
                
                // 渲染Notes面板
                NotesManager.renderNotesPanel(currentUser);
                
                // 延长显示时间让用户看到效果
                setTimeout(() => {
                    if (window.DateManager) window.DateManager.hideLoadingProgress();
                }, 600);
            } else {
                // 如果NotesManager还未加载，显示占位内容
                const contentArea = Utils.$('#contentArea');
                if (contentArea) {
                    contentArea.innerHTML = `
                        <div class="notes-content-panel">
                            <div class="notes-placeholder">
                                <h3>Notes 功能</h3>
                                <p>正在加载笔记功能...</p>
                            </div>
                        </div>
                    `;
                }
                
                // 显示占位内容后延迟隐藏进度条
                setTimeout(() => {
                    if (window.DateManager) window.DateManager.hideLoadingProgress();
                }, 600);
            }
        } catch (error) {
            console.error('加载Notes页面失败:', error);
            // 即使出错也要隐藏进度条
            setTimeout(() => {
                if (window.DateManager) window.DateManager.hideLoadingProgress();
            }, 300);
        }
    },

    // 显示Profile页面
    async showProfilePage() {
        console.log('切换到Profile页面');
        
        try {
            // 设置全局状态为profile模块
            if (window.GlobalUserState) {
                GlobalUserState.setCurrentModule('profile');
            }
            
            if (window.ProfileManager) {
                // 检查是否已初始化
                if (!ProfileManager.currentAppUser) {
                    console.log('首次加载Profile，开始初始化');
                    await ProfileManager.init();
                }
                
                // 渲染Profile页面
                await ProfileManager.renderProfilePanel();
                
                // 延长显示时间让用户看到效果
                setTimeout(() => {
                    if (window.DateManager) window.DateManager.hideLoadingProgress();
                }, 600);
            } else {
                console.error('❌ ProfileManager未加载');
                
                // 显示错误占位内容
                const contentArea = document.getElementById('contentArea');
                if (contentArea) {
                    contentArea.innerHTML = `
                        <div class="profile-content-panel">
                            <div class="profile-error">
                                <div class="error-icon">❌</div>
                                <h3>加载失败</h3>
                                <p>Profile功能未正确加载</p>
                            </div>
                        </div>
                    `;
                }
                
                // 即使出错也要隐藏进度条
                setTimeout(() => {
                    if (window.DateManager) window.DateManager.hideLoadingProgress();
                }, 300);
            }
        } catch (error) {
            console.error('加载Profile页面失败:', error);
            
            // 显示错误状态
            const contentArea = document.getElementById('contentArea');
            if (contentArea) {
                contentArea.innerHTML = `
                    <div class="profile-content-panel">
                        <div class="profile-error">
                            <div class="error-icon">❌</div>
                            <h3>加载失败</h3>
                            <p>${error.message}</p>
                            <button class="btn btn-primary" onclick="App.showProfilePage()">重试</button>
                        </div>
                    </div>
                `;
            }
            
            // 即使出错也要隐藏进度条
            setTimeout(() => {
                if (window.DateManager) window.DateManager.hideLoadingProgress();
            }, 300);
        }
    },

    // 显示Link页面
    async showLinkPage() {
        console.log('切换到Link页面');
        
        try {
            // 恢复左侧边栏显示
            if (window.ProfileManager) {
                ProfileManager.showLeftSidebar();
            }
            
            // 设置全局状态为link模块
            if (window.GlobalUserState) {
                GlobalUserState.setCurrentModule('link');
            }
            
            // 创建Link页面的内容
            const contentArea = document.getElementById('contentArea');
            if (contentArea) {
                contentArea.innerHTML = `
                    <div class="content-panel">
                        <!-- Link状态显示区 -->
                        <div class="link-status-area" id="linkStatusArea">
                            <div class="link-status-loading">
                                <div class="loading-spinner"></div>
                                <p>正在检查关联状态...</p>
                            </div>
                        </div>
                        
                        <!-- Link内容区域 -->
                        <div class="link-content-area">
                            <!-- 用户信息显示区 -->
                            <div class="user-info-display" id="userInfoDisplay">
                                <div class="empty-state">
                                    <div class="empty-icon">👤</div>
                                    <p>请从左侧选择一个用户</p>
                                    <p class="empty-subtitle">查看用户的详细信息</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                console.log('✅ Link页面HTML已创建');
            }
            
            // 初始化Link页面的事件监听
            this.initializeLinkPageEvents();
            
            // 检查并显示Link连接状态
            setTimeout(async () => {
                await this.displayLinkConnectionStatus();
                this.displayDefaultUserInLink();
            }, 100);
            
            console.log('✅ Link页面加载完成');
            
        } catch (error) {
            console.error('加载Link页面失败:', error);
            
            // 显示错误状态
            const contentArea = document.getElementById('contentArea');
            if (contentArea) {
                contentArea.innerHTML = `
                    <div class="content-panel">
                        <div class="link-error">
                            <div class="error-icon">❌</div>
                            <h3>加载失败</h3>
                            <p>${error.message}</p>
                            <button class="btn btn-primary" onclick="App.showLinkPage()">重试</button>
                        </div>
                    </div>
                `;
            }
        }
    },
    
    // 初始化Link页面事件监听
    initializeLinkPageEvents() {
        console.log('🎨 初始化Link页面事件监听...');
        
        // 监听用户选择事件
        const handleUserSelected = (event) => {
            const selectedUser = event.detail;
            console.log('👤 [SPA Link] 接收到用户选择事件:', selectedUser);
            this.displayUserInfoInLink(selectedUser);
        };
        
        // 移除旧的监听器（避免重复绑定）
        document.removeEventListener('userSelected', handleUserSelected);
        // 添加新的监听器
        document.addEventListener('userSelected', handleUserSelected);
        
        console.log('✅ Link页面事件监听初始化完成');
    },
    
    // 显示Link连接状态
    async displayLinkConnectionStatus() {
        try {
            console.log('🔍 [Link] 检查连接状态...');
            
            const linkStatusArea = document.getElementById('linkStatusArea');
            if (!linkStatusArea) return;
            
            const currentAppUser = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : localStorage.getItem('wenting_current_app_user');
            if (!currentAppUser) {
                linkStatusArea.innerHTML = `
                    <div class="link-status-error">
                        <div class="status-icon">❌</div>
                        <h3>未登录</h3>
                        <p>请先登录后查看关联状态</p>
                    </div>
                `;
                return;
            }
            
            // 检查用户的关联关系
            let response;
            try {
                if (window.WebSocketClient && window.WebSocketClient.isConnected) {
                    console.log('🔍 [Link] 使用WebSocket检查连接状态...');
                    response = await window.WebSocketClient.links.checkLinkStatus(currentAppUser);
                } else {
                    console.log('🔍 [Link] WebSocket未连接，使用HTTP模式...');
                    // HTTP降级模式
                    const apiResponse = await fetch(`/api/links/user/${currentAppUser}/status`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Device-ID': window.DeviceManager?.getCurrentDeviceId() || 'unknown'
                        }
                    });
                    
                    if (!apiResponse.ok) {
                        throw new Error(`HTTP ${apiResponse.status}: ${apiResponse.statusText}`);
                    }
                    
                    const data = await apiResponse.json();
                    response = { success: true, data: data };
                }
            } catch (error) {
                console.error('❌ [Link] 检查连接状态失败:', error);
                
                // 显示更详细的错误信息
                let errorMessage = '无法获取关联状态';
                if (error.message.includes('请求超时')) {
                    errorMessage = 'WebSocket请求超时，请检查网络连接';
                } else if (error.message.includes('HTTP')) {
                    errorMessage = `服务器错误: ${error.message}`;
                }
                
                linkStatusArea.innerHTML = `
                    <div class="link-status-error">
                        <div class="status-icon">⚠️</div>
                        <h3>检查失败</h3>
                        <p>${errorMessage}</p>
                        <button class="btn btn-secondary" onclick="App.displayLinkConnectionStatus()" style="margin-top: 10px;">重试</button>
                    </div>
                `;
                return;
            }
            
            if (response.success && response.data.links && response.data.links.length > 0) {
                // 有关联关系，显示连接状态
                const links = response.data.links;
                console.log('✅ [Link] 找到关联关系:', links);
                
                linkStatusArea.innerHTML = `
                    <div class="link-status-connected">
                        <div class="status-icon">🔗</div>
                        <h3>已建立关联</h3>
                        <div class="link-connections">
                            ${links.map(link => `
                                <div class="link-connection-item">
                                    <div class="connection-info">
                                        <span class="connection-partner">${link.manager_username || link.linked_username}</span>
                                        <span class="connection-user">${link.username}</span>
                                    </div>
                                    <div class="connection-status">
                                        <span class="status-badge active">活跃</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <p class="link-description">您可以在左侧看到关联用户，点击Todo或Notes查看共享数据</p>
                    </div>
                `;
            } else {
                // 没有关联关系
                linkStatusArea.innerHTML = `
                    <div class="link-status-empty">
                        <div class="status-icon">🔗</div>
                        <h3>暂无关联</h3>
                        <p>您还没有与其他用户建立关联关系</p>
                        <p class="link-hint">当其他用户向您发送关联邀请时，您会收到通知</p>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('❌ [Link] 显示连接状态失败:', error);
        }
    },
    
    // 在Link页面显示用户信息
    displayUserInfoInLink(user) {
        console.log('🎨 [SPA Link] 显示用户信息:', user);
        console.log('🔍 [SPA Link] 检查 userInfoDisplay 元素是否存在...');
        
        const userInfoDisplay = document.getElementById('userInfoDisplay');
        console.log('🔍 [SPA Link] userInfoDisplay 元素:', userInfoDisplay);
        
        if (userInfoDisplay && user) {
            userInfoDisplay.innerHTML = `
                <div class="selected-user-info">
                    <div class="user-avatar" style="background-color: ${user.avatar_color}">
                        ${user.display_name.charAt(0)}
                    </div>
                    <h3>${user.display_name}</h3>
                    <div class="user-details">
                        <div class="link-detail-item">
                            <span class="detail-label">用户名:</span>
                            <span class="detail-value">${user.username}</span>
                        </div>
                        <div class="link-detail-item">
                            <span class="detail-label">显示名称:</span>
                            <span class="detail-value">${user.display_name}</span>
                        </div>
                        <div class="link-detail-item">
                            <span class="detail-label">邮箱:</span>
                            <span class="detail-value">${user.email || '未设置'}</span>
                        </div>
                        <div class="link-detail-item">
                            <span class="detail-label">手机号:</span>
                            <span class="detail-value">${user.phone || '未设置'}</span>
                        </div>
                        <div class="link-detail-item">
                            <span class="detail-label">性别:</span>
                            <span class="detail-value">${user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : user.gender === 'other' ? '其他' : '未设置'}</span>
                        </div>
                        <div class="link-detail-item">
                            <span class="detail-label">生日:</span>
                            <span class="detail-value">${user.birthday ? new Date(user.birthday).toLocaleDateString() : '未设置'}</span>
                        </div>
                        <div class="link-detail-item">
                            <span class="detail-label">头像颜色:</span>
                            <span class="detail-value">
                                <span style="display: inline-block; width: 20px; height: 20px; background-color: ${user.avatar_color}; border-radius: 50%; vertical-align: middle; margin-right: 8px;"></span>
                                ${user.avatar_color}
                            </span>
                        </div>
                        <div class="link-detail-item">
                            <span class="detail-label">创建时间:</span>
                            <span class="detail-value">${new Date(user.created_at).toLocaleString()}</span>
                        </div>
                        <div class="link-detail-item">
                            <span class="detail-label">最后更新:</span>
                            <span class="detail-value">${new Date(user.updated_at).toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <!-- Link功能区域 -->
                    <div class="link-function-area" id="linkFunctionArea">
                        <div class="link-section-title">用户关联</div>
                        <div class="link-content" id="linkContent-${user.id}">
                            <div class="loading-link">正在检查关联状态...</div>
                        </div>
                    </div>
                </div>
            `;
            
            console.log('✅ [SPA Link] 用户信息已更新');
            
            // 延迟加载Link功能内容
            setTimeout(() => {
                this.loadLinkFunctionContent(user);
            }, 100);
        } else {
            console.error('❌ [SPA Link] userInfoDisplay元素未找到或用户为空');
        }
    },
    
    // 加载Link功能内容
    async loadLinkFunctionContent(user) {
        try {
            console.log('🔗 [SPA Link] 加载用户关联功能:', user.id);
            
            const linkContentEl = this._getLinkContentElement(user.id);
            if (!linkContentEl) return;
            
            const currentAppUser = this._getCurrentAppUser();
            if (!currentAppUser) {
                linkContentEl.innerHTML = '<div class="link-error">用户未登录</div>';
                return;
            }
            
            await this._loadAndRenderLinkStatus(user, currentAppUser, linkContentEl);
            console.log('✅ [SPA Link] 关联功能界面已加载');
        } catch (error) {
            console.error('❌ [SPA Link] 加载关联功能失败:', error);
            this._renderErrorState(user.id, '加载关联功能失败');
        }
    },

    // 获取关联内容元素
    _getLinkContentElement(userId) {
        const linkContentEl = document.getElementById(`linkContent-${userId}`);
        if (!linkContentEl) {
            console.error('❌ [SPA Link] 找不到关联内容容器');
            return null;
        }
        return linkContentEl;
    },

    // 获取当前应用用户
    _getCurrentAppUser() {
        return window.GlobalUserState ? 
               window.GlobalUserState.getAppUserId() : 
               localStorage.getItem('wenting_current_app_user');
    },

    // 加载并渲染关联状态
    async _loadAndRenderLinkStatus(user, currentAppUser, linkContentEl) {
        try {
            console.log('🔍 [SPA Link] 正在检查用户关联状态...');
            
            const response = await this._fetchLinkStatus(currentAppUser);
            const allLinks = this._parseLinkResponse(response);
            
            if (response.success && allLinks.length > 0) {
                this.renderLinkedUserInterface(user, allLinks, linkContentEl);
            } else {
                this.renderLinkInputInterface(user, linkContentEl);
            }
        } catch (error) {
            console.error('❌ [SPA Link] 检查关联状态失败:', error);
            this._logLinkStatusError(error, currentAppUser, user);
            this.renderLinkInputInterface(user, linkContentEl);
        }
    },

    // 获取关联状态
    async _fetchLinkStatus(currentAppUser) {
        if (window.WebSocketClient && window.WebSocketClient.isConnected) {
            return await window.WebSocketClient.links.checkLinkStatus(currentAppUser);
        } else {
            return await this._fetchLinkStatusViaHTTP(currentAppUser);
        }
    },

    // 通过HTTP获取关联状态
    async _fetchLinkStatusViaHTTP(currentAppUser) {
        const apiResponse = await fetch(`/api/links/user/${currentAppUser}/status`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Device-ID': window.DeviceManager?.getCurrentDeviceId() || 'unknown'
            }
        });
        
        if (!apiResponse.ok) {
            throw new Error(`HTTP ${apiResponse.status}: ${apiResponse.statusText}`);
        }
        
        const data = await apiResponse.json();
        return { success: true, data: data };
    },

    // 解析关联响应数据
    _parseLinkResponse(response) {
        console.log('🔗 [SPA Link] 用户关联状态:', response);
        
        let allLinks = [];
        if (response.data?.links) {
            if (Array.isArray(response.data.links)) {
                // 新格式：直接是数组
                allLinks = response.data.links;
                console.log('🔍 [Debug] 使用新格式数组:', allLinks.length);
            } else if (response.data.links.asManager || response.data.links.asLinked) {
                // 旧格式：合并asManager和asLinked
                allLinks = this._mergeLegacyLinkFormats(response.data.links);
            }
        }
        
        console.log('🔍 [Debug] 最终合并的links数组:', allLinks);
        return allLinks;
    },

    // 合并旧格式的关联数据
    _mergeLegacyLinkFormats(links) {
        const allLinks = [];
        if (links.asManager) {
            allLinks.push(...links.asManager);
        }
        if (links.asLinked) {
            allLinks.push(...links.asLinked);
        }
        console.log('🔍 [Debug] 使用旧格式对象，合并后数组长度:', allLinks.length);
        return allLinks;
    },

    // 记录关联状态错误日志
    _logLinkStatusError(error, currentAppUser, user) {
        console.error('❌ [Debug] 错误详情:', error.message);
        console.error('❌ [Debug] 当前用户:', currentAppUser);
        console.error('❌ [Debug] 被选中用户:', user);
    },

    // 渲染错误状态
    _renderErrorState(userId, errorMessage) {
        const linkContentEl = document.getElementById(`linkContent-${userId}`);
        if (linkContentEl) {
            linkContentEl.innerHTML = `<div class="link-error">${errorMessage}</div>`;
        }
    },
    
    // 渲染关联输入界面
    renderLinkInputInterface(user, container) {
        container.innerHTML = `
            <div class="link-input-area">
                <div class="link-description">
                    将 <strong>${user.display_name}</strong> 的健康数据与其他用户关联，实现数据同步。
                </div>
                <div class="link-input-group">
                    <input type="text" 
                           id="linkUserInput-${user.id}" 
                           class="link-user-input" 
                           placeholder="输入要关联的用户名（如：whiteblade）"
                           maxlength="10">
                    <button id="linkUserBtn-${user.id}" 
                            class="link-user-btn btn-primary" 
                            onclick="App.sendLinkRequest(${user.id})">
                        发送关联
                    </button>
                </div>
                <div class="link-tips">
                    💡 提示：关联后双方都能管理 ${user.display_name} 的健康数据，数据会实时同步。
                </div>
            </div>
        `;
    },
    
    // 渲染已关联用户界面
    renderLinkedUserInterface(user, links, container) {
        const currentAppUser = localStorage.getItem('wenting_current_app_user');
        const linkInfo = links[0]; // 取第一个关联关系
        
        // 确定对方用户
        const linkedUser = linkInfo.manager_app_user === currentAppUser ? 
                          linkInfo.linked_app_user : linkInfo.manager_app_user;
        const isManager = linkInfo.manager_app_user === currentAppUser;
        
        container.innerHTML = `
            <div class="link-linked-area">
                <div class="link-description">
                    <strong>${user.display_name}</strong> 的健康数据已与其他用户关联。
                </div>
                
                <!-- 第一行：关联状态和用户信息 -->
                <div class="link-info-row">
                    <div class="link-status-badge success">✓ 已关联</div>
                    <div class="link-partner-info">
                        <span class="partner-label">关联用户:</span>
                        <span class="partner-name">${linkedUser}</span>
                    </div>
                </div>
                
                <!-- 第二行：角色和时间信息 -->
                <div class="link-info-row">
                    <div class="link-role-info">
                        <span class="role-label">您的角色:</span>
                        <span class="role-badge ${isManager ? 'manager' : 'linked'}">${isManager ? '管理员' : '关联用户'}</span>
                    </div>
                    <div class="link-time-info">
                        <span class="time-label">关联时间:</span>
                        <span class="time-value">${new Date(linkInfo.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                
                <!-- 第三行：操作按钮 -->
                <div class="link-actions-row">
                    <button class="link-unlink-btn" 
                            onclick="App.confirmUnlink(${user.id}, ${linkInfo.id}, '${linkedUser}')">
                        🔗 取消关联
                    </button>
                </div>
                
                <div class="link-tips">
                    💡 取消关联后，对方将无法继续管理 ${user.display_name} 的健康数据
                </div>
            </div>
        `;
    },
    
    // 发送关联请求（主入口）
    async sendLinkRequest(supervisedUserId) {
        try {
            console.log('🔗 [SPA Link] 发送关联请求，被监管用户ID:', supervisedUserId);
            
            // 获取并验证表单元素
            const elements = this._getLinkRequestElements(supervisedUserId);
            if (!elements) return;
            
            // 验证输入并获取目标用户名
            const targetUsername = this._validateLinkInput(elements.inputEl);
            if (!targetUsername) return;
            
            // 获取并验证被监管用户信息
            const supervisedUser = this._getSupervisedUser(supervisedUserId);
            if (!supervisedUser) return;
            
            // 发送邀请
            await this._sendInvitation(elements, targetUsername, supervisedUserId, supervisedUser);
            
        } catch (error) {
            console.error('❌ [SPA Link] 发送关联请求失败:', error);
            this.showLinkNotification('error', '发送关联请求失败');
            this._resetButtonState(supervisedUserId);
        }
    },

    // 获取关联请求相关DOM元素
    _getLinkRequestElements(supervisedUserId) {
        const inputEl = document.getElementById(`linkUserInput-${supervisedUserId}`);
        const btnEl = document.getElementById(`linkUserBtn-${supervisedUserId}`);
        
        if (!inputEl || !btnEl) {
            console.error('❌ [SPA Link] 找不到输入元素');
            return null;
        }
        
        return { inputEl, btnEl };
    },

    // 验证关联输入
    _validateLinkInput(inputEl) {
        const targetUsername = inputEl.value.trim();
        
        if (!targetUsername) {
            this.showLinkNotification('error', '请输入要关联的用户名');
            return null;
        }
        
        // 验证用户名格式
        if (!/^[a-z0-9]{1,10}$/.test(targetUsername)) {
            this.showLinkNotification('error', '用户名格式不正确，只能包含小写字母和数字，长度1-10字符');
            return null;
        }
        
        // 检查是否尝试关联自己
        const currentAppUser = this._getCurrentAppUser();
        if (targetUsername === currentAppUser) {
            this.showLinkNotification('error', '不能关联自己');
            return null;
        }
        
        return targetUsername;
    },


    // 获取被监管用户信息
    _getSupervisedUser(supervisedUserId) {
        const supervisedUser = window.UserManager?.users?.find(u => u.id === supervisedUserId);
        if (!supervisedUser) {
            this.showLinkNotification('error', '找不到被监管用户信息');
            return null;
        }
        return supervisedUser;
    },

    // 发送邀请
    async _sendInvitation(elements, targetUsername, supervisedUserId, supervisedUser) {
        const { inputEl, btnEl } = elements;
        
        // 设置加载状态
        this._setButtonLoading(btnEl, '检查用户...');
        
        try {
            btnEl.textContent = '发送邀请...';
            
            // 发送邀请
            const invitationResponse = await this._sendInvitationRequest(targetUsername, supervisedUserId, supervisedUser);
            console.log('📨 [SPA Link] 邀请发送结果:', invitationResponse);
            
            // 处理响应
            this._handleInvitationResponse(invitationResponse, targetUsername, inputEl);
            
        } catch (error) {
            console.error('❌ [SPA Link] WebSocket请求失败:', error);
            this.showLinkNotification('error', error.message || '发送请求失败');
        } finally {
            // 重置按钮
            this._resetButton(btnEl);
        }
    },

    // 发送邀请请求
    async _sendInvitationRequest(targetUsername, supervisedUserId, supervisedUser) {
        const currentAppUser = this._getCurrentAppUser();
        const message = `${currentAppUser} 想要与您关联 ${supervisedUser.display_name} 的健康数据`;
        
        if (window.WebSocketClient && window.WebSocketClient.isConnected) {
            return await window.WebSocketClient.links.sendInvitation(targetUsername, supervisedUserId, message);
        } else {
            return await this._sendInvitationViaHTTP(targetUsername, supervisedUserId, message);
        }
    },

    // 通过HTTP发送邀请
    async _sendInvitationViaHTTP(targetUsername, supervisedUserId, message) {
        const apiResponse = await fetch('/api/links/requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Device-ID': window.DeviceManager?.getCurrentDeviceId() || 'unknown'
            },
            body: JSON.stringify({
                toAppUser: targetUsername,
                supervisedUserId: supervisedUserId,
                message: message
            })
        });
        
        return { success: apiResponse.ok, data: await apiResponse.json() };
    },

    // 处理邀请响应
    _handleInvitationResponse(invitationResponse, targetUsername, inputEl) {
        if (invitationResponse.success) {
            const message = invitationResponse.isOverride 
                ? `邀请已更新并重新发送给 ${targetUsername}` 
                : `关联邀请已发送给 ${targetUsername}`;
            this.showLinkNotification('success', message);
            inputEl.value = '';
        } else {
            this._handleInvitationError(invitationResponse, targetUsername);
        }
    },

    // 处理邀请错误
    _handleInvitationError(invitationResponse, targetUsername) {
        if (invitationResponse.error === 'TARGET_USER_OFFLINE') {
            this.showLinkNotification('warning', `${targetUsername} 当前不在线，请稍后再试或通过其他方式联系对方`);
        } else {
            this.showLinkNotification('error', invitationResponse.message || invitationResponse.error || '发送邀请失败');
        }
    },

    // 设置按钮加载状态
    _setButtonLoading(btnEl, text) {
        btnEl.disabled = true;
        btnEl.textContent = text;
    },

    // 重置按钮状态
    _resetButton(btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = '发送关联';
    },

    // 重置按钮状态（通过ID查找）
    _resetButtonState(supervisedUserId) {
        const btnEl = document.getElementById(`linkUserBtn-${supervisedUserId}`);
        if (btnEl) {
            this._resetButton(btnEl);
        }
    },
    
    // 发送WebSocket消息并等待响应
    async sendWebSocketMessage(message) {
        return new Promise((resolve, reject) => {
            // 检查WebSocket连接 - 修复对象名称不一致问题
            if (!window.WebSocketClient || !window.WebSocketClient.isConnected) {
                reject(new Error('WebSocket未连接'));
                return;
            }
            
            // 生成消息ID用于匹配响应
            const messageId = Date.now().toString();
            message.messageId = messageId;
            message.timestamp = Date.now();
            
            // 设置响应监听器
            const responseType = `${message.type}_RESPONSE`;
            const timeoutId = setTimeout(() => {
                reject(new Error('请求超时'));
            }, 10000); // 10秒超时
            
            const handleResponse = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    if (response.type === responseType && response.messageId === messageId) {
                        clearTimeout(timeoutId);
                        window.WebSocketClient.ws.removeEventListener('message', handleResponse);
                        resolve(response);
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            };
            
            // 监听响应
            window.WebSocketClient.ws.addEventListener('message', handleResponse);
            
            // 发送消息
            try {
                window.WebSocketClient.ws.send(JSON.stringify(message));
            } catch (error) {
                clearTimeout(timeoutId);
                window.WebSocketClient.ws.removeEventListener('message', handleResponse);
                reject(error);
            }
        });
    },
    
    // 显示Link通知
    showLinkNotification(type, message) {
        console.log(`🔔 [SPA Link] 显示${type}通知:`, message);
        
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `link-notification link-notification-${type}`;
        notification.innerHTML = `
            <div class="link-notification-content">
                <div class="link-notification-icon">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                </div>
                <div class="link-notification-message">${message}</div>
                <button class="link-notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 自动消失
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    },
    
    // 显示数据同步通知（更详细的提示）
    showDataSyncNotification(type, message) {
        console.log(`🔄 [数据同步] 显示${type}通知:`, message);
        
        // 创建更详细的通知元素
        const notification = document.createElement('div');
        notification.className = `data-sync-notification data-sync-notification-${type}`;
        notification.innerHTML = `
            <div class="data-sync-notification-content">
                <div class="data-sync-notification-header">
                    <div class="data-sync-notification-icon">
                        ${type === 'success' ? '🎉' : type === 'info' ? '📊' : type === 'warning' ? '⚠️' : '❌'}
                    </div>
                    <div class="data-sync-notification-title">数据同步通知</div>
                    <button class="data-sync-notification-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="data-sync-notification-body">
                    <p>${message}</p>
                    <div class="data-sync-details">
                        <small>📝 这意味着TODO项目、健康笔记等数据已完成同步</small>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 较长的显示时间，因为包含重要信息
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('data-sync-fade-out');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 500);
            }
        }, 8000);
    },
    
    // 显示关联邀请对话框
    showLinkInvitationDialog(invitationData) {
        console.log('🔔 [SPA Link] 显示关联邀请对话框:', invitationData);
        
        const { fromUser, supervisedUserName, message, timestamp, expiresIn } = invitationData;
        
        // 创建模态对话框
        const modal = document.createElement('div');
        modal.className = 'link-invitation-modal';
        modal.innerHTML = `
            <div class="link-invitation-dialog">
                <div class="link-invitation-header">
                    <div class="link-invitation-icon">🔗</div>
                    <h3>关联邀请</h3>
                </div>
                <div class="link-invitation-body">
                    <div class="link-invitation-from">
                        来自：<strong>${fromUser}</strong>
                    </div>
                    <div class="link-invitation-target">
                        关联用户：<strong>${supervisedUserName}</strong>
                    </div>
                    <div class="link-invitation-message">
                        ${message}
                    </div>
                    <div class="link-invitation-time">
                        ${new Date(timestamp).toLocaleString()}
                    </div>
                </div>
                <div class="link-invitation-actions">
                    <button class="btn btn-success" onclick="App.respondToLinkInvitation('accept', '${fromUser}', '${supervisedUserName}', ${invitationData.requestId})">
                        接受
                    </button>
                    <button class="btn btn-secondary" onclick="App.respondToLinkInvitation('reject', '${fromUser}', '${supervisedUserName}', ${invitationData.requestId})">
                        拒绝
                    </button>
                </div>
                <div class="link-invitation-expire">
                    邀请将在 ${Math.floor(expiresIn / 60000)} 分钟后过期
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 自动过期处理
        setTimeout(() => {
            if (modal.parentElement) {
                modal.remove();
                console.log('⏰ [SPA Link] 关联邀请已过期');
            }
        }, expiresIn);
    },
    
    // 响应关联邀请
    async respondToLinkInvitation(action, fromUser, supervisedUserName, requestId) {
        try {
            console.log(`📝 [SPA Link] 响应关联邀请: ${action}`, { fromUser, supervisedUserName, requestId });
            
            const currentAppUser = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : localStorage.getItem('wenting_current_app_user');
            if (!currentAppUser) {
                this.showLinkNotification('error', '用户未登录');
                return;
            }
            
            // 发送响应
            let response;
            try {
                if (window.WebSocketClient && window.WebSocketClient.isConnected) {
                    if (action === 'accept') {
                        response = await window.WebSocketClient.links.acceptInvitation(requestId);
                    } else {
                        response = await window.WebSocketClient.links.rejectInvitation(requestId);
                    }
                } else {
                    // HTTP降级模式
                    const apiResponse = await fetch(`/api/links/requests/${requestId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Device-ID': window.DeviceManager?.getCurrentDeviceId() || 'unknown'
                        },
                        body: JSON.stringify({
                            action: action,
                            appUser: currentAppUser
                        })
                    });
                    response = { success: apiResponse.ok, data: await apiResponse.json() };
                }
            } catch (error) {
                response = { success: false, error: error.message };
            }
            
            console.log('📨 [SPA Link] 邀请响应结果:', response);
            
            if (response.success) {
                if (action === 'accept') {
                    this.showLinkNotification('success', `已接受与 ${fromUser} 的关联邀请，正在刷新数据...`);
                    
                    // 🔥 修复：不在这里调用 refreshApplicationAfterLink，让 WebSocket 的 LINK_ESTABLISHED 消息处理
                    console.log('✅ [Link] 邀请接受成功，等待 WebSocket LINK_ESTABLISHED 消息触发数据刷新');
                    
                } else {
                    this.showLinkNotification('info', `已拒绝与 ${fromUser} 的关联邀请`);
                }
            } else {
                this.showLinkNotification('error', response.error || '处理邀请失败');
            }
            
            // 关闭对话框
            const modal = document.querySelector('.link-invitation-modal');
            if (modal) {
                modal.remove();
            }
            
        } catch (error) {
            console.error('❌ [SPA Link] 响应邀请失败:', error);
            this.showLinkNotification('error', '响应邀请失败');
        }
    },
    
    // Link成功后刷新应用数据
    async refreshApplicationAfterLink() {
        if (this._isDuplicateRefreshCall()) return;
        
        this._refreshingAfterLink = true;
        
        try {
            console.log('🔄 [Link] 开始刷新应用数据...');
            
            await this._refreshUserData();
            await this._refreshApplicationData();
            await this._navigateToLinkPage();
            await this._ensureDefaultUser();
            
            this.showLinkNotification('success', '关联建立成功！已自动跳转到Link页面查看连接状态');
            console.log('✅ [Link] 应用数据刷新完成');
            
        } catch (error) {
            console.error('❌ [Link] 刷新应用数据失败:', error);
            this.showLinkNotification('error', '数据刷新失败，请手动刷新页面');
        } finally {
            this._refreshingAfterLink = false;
        }
    },

    // 检查是否为重复刷新调用
    _isDuplicateRefreshCall() {
        if (this._refreshingAfterLink) {
            console.log('⚠️ [Link] 数据刷新已在进行中，跳过重复调用');
            return true;
        }
        return false;
    },

    // 刷新用户数据
    async _refreshUserData() {
        if (window.UserManager && typeof UserManager.loadUsersFromAPI === 'function') {
            console.log('🔄 [Link] 重新加载用户数据...');
            await UserManager.loadUsersFromAPI();
            console.log('✅ [Link] 用户数据重新加载完成，用户数量:', UserManager.users?.length || 0);
            
            this._logLoadedUserData();
        }
        
        this._updateUserInterface();
    },

    // 记录加载的用户数据
    _logLoadedUserData() {
        if (UserManager.users && UserManager.users.length > 0) {
            console.log('🔍 [Link] 加载的用户数据:', UserManager.users.map(u => ({ 
                id: u.id, 
                username: u.username, 
                app_user_id: u.app_user_id 
            })));
        }
    },

    // 更新用户界面
    _updateUserInterface() {
        if (window.UserManager && typeof UserManager.renderUserTabs === 'function') {
            console.log('🔄 [Link] 重新渲染用户标签...');
            UserManager.renderUserTabs();
            console.log('✅ [Link] 用户标签重新渲染完成');
        }
        
        if (window.GlobalUserState) {
            console.log('🔄 [Link] 更新全局用户状态...');
            GlobalUserState.updateUserSelectorUI();
            console.log('✅ [Link] 全局用户状态更新完成');
        }
    },

    // 刷新应用数据
    async _refreshApplicationData() {
        await this._refreshTodoData();
        await this._refreshNotesData();
    },

    // 刷新TODO数据
    async _refreshTodoData() {
        if (window.TodoManager) {
            console.log('🔄 [Link] 重新加载TODO数据...');
            await TodoManager.loadTodosFromAPI();
            console.log('✅ [Link] TODO数据重新加载完成');
        }
    },

    // 刷新Notes数据
    async _refreshNotesData() {
        if (window.NotesManager) {
            console.log('🔄 [Link] 重新加载Notes数据...');
            await NotesManager.loadNotesFromAPI();
            console.log('✅ [Link] Notes数据重新加载完成');
        }
    },

    // 导航到Link页面
    async _navigateToLinkPage() {
        console.log('🔄 [Link] 自动跳转到Link页面...');
        await this.showLinkPage();
    },

    // 确保有默认用户
    async _ensureDefaultUser() {
        if (UserManager.users && UserManager.users.length > 0 && window.GlobalUserState) {
            const currentUser = GlobalUserState.getCurrentUser();
            const userExists = UserManager.users.find(u => u.id === currentUser);
            
            if (!currentUser || !userExists) {
                this._setDefaultUser();
            } else {
                console.log('✅ [Link] 当前用户有效:', currentUser);
            }
        }
    },

    // 设置默认用户
    _setDefaultUser() {
        const firstUser = UserManager.users[0];
        console.log('🔄 [Link] 设置默认用户:', firstUser.username, 'ID:', firstUser.id);
        GlobalUserState.setCurrentUser(firstUser.id);
        
        setTimeout(() => {
            this._activateUserTab(firstUser);
        }, 500);
    },

    // 激活用户标签
    _activateUserTab(user) {
        const userTab = document.querySelector(`[data-user-id="${user.id}"]`);
        if (userTab) {
            document.querySelectorAll('.user-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            userTab.classList.add('active');
            console.log('✅ [Link] 用户标签已选中:', user.username);
        }
    },
    
    // 处理数据同步更新
    handleDataSyncUpdate(syncData) {
        try {
            console.log('🔄 [数据同步] 处理同步更新:', syncData);
            
            // 正确解构嵌套的数据结构
            const { table, operation, data } = syncData.data || syncData;
            
            // 显示同步通知
            this.showDataSyncOperationNotification(operation, table, data);
            
            // 根据数据类型刷新相应的界面
            if (table === 'todos' && window.TodoManager) {
                console.log('🔄 [数据同步] 刷新TODO数据');
                
                // 获取当前用户和日期
                const currentUserId = window.GlobalUserState ? GlobalUserState.getCurrentUser() : null;
                const currentDate = window.DateManager ? DateManager.selectedDate : new Date();
                
                if (currentUserId) {
                    // 清除缓存并重新加载数据
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const cacheKey = `${currentUserId}_${dateStr}`;
                    if (TodoManager.todoCache) {
                        TodoManager.todoCache.delete(cacheKey);
                        console.log('🧹 [数据同步] 清除TODO缓存:', cacheKey);
                    }
                    
                    // 延迟一下再刷新，确保服务器数据已同步
                    setTimeout(async () => {
                        try {
                            await TodoManager.loadTodosForDate(currentDate, currentUserId);
                            console.log('✅ [数据同步] TODO数据刷新完成');
                        } catch (error) {
                            console.error('❌ [数据同步] TODO数据刷新失败:', error);
                        }
                    }, 500);
                }
                
            } else if (table === 'notes' && window.NotesManager) {
                console.log('🔄 [数据同步] 刷新Notes数据');
                
                const currentUserId = window.GlobalUserState ? GlobalUserState.getCurrentUser() : null;
                if (currentUserId) {
                    setTimeout(async () => {
                        try {
                            await NotesManager.loadNotesFromAPI();
                            if (GlobalUserState.getCurrentModule() === 'notes') {
                                NotesManager.renderNotesPanel(currentUserId);
                            }
                            console.log('✅ [数据同步] Notes数据刷新完成');
                        } catch (error) {
                            console.error('❌ [数据同步] Notes数据刷新失败:', error);
                        }
                    }, 500);
                }
            }
            
        } catch (error) {
            console.error('❌ [数据同步] 处理同步更新失败:', error);
        }
    },
    
    // 显示数据同步操作通知
    showDataSyncOperationNotification(operation, table, data = {}) {
        const tableNames = {
            'todos': 'TODO',
            'notes': 'Notes'
        };
        
        const operationNames = {
            'create': '新增',
            'update': '更新', 
            'delete': '删除',
            'complete': '完成',
            'uncomplete': '取消完成'
        };
        
        const tableName = tableNames[table] || table;
        const operationName = operationNames[operation] || operation;
        const itemTitle = data.title ? `"${data.title}"` : '';
        
        // 创建同步通知
        const notification = document.createElement('div');
        notification.className = 'data-sync-notification';
        notification.innerHTML = `
            <div class="data-sync-content">
                <div class="data-sync-icon">🔄</div>
                <div class="data-sync-message">
                    关联用户${operationName}了${tableName}${itemTitle}，正在同步...
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => notification.classList.add('show'), 100);
        
        // 自动消失
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },
    
    // 确认取消关联
    confirmUnlink(supervisedUserId, linkId, linkedUser) {
        console.log('🔗 [SPA Link] 确认取消关联:', { supervisedUserId, linkId, linkedUser });
        
        // 创建确认对话框
        const modal = document.createElement('div');
        modal.className = 'link-unlink-modal';
        modal.innerHTML = `
            <div class="link-unlink-dialog">
                <div class="link-unlink-header">
                    <div class="link-unlink-icon">⚠️</div>
                    <h3>确认取消关联</h3>
                </div>
                <div class="link-unlink-body">
                    <p>您确定要取消与 <strong>${linkedUser}</strong> 的关联关系吗？</p>
                    <div class="link-unlink-warning">
                        ⚠️ 取消关联后：
                        <ul>
                            <li>对方将无法继续管理该用户的健康数据</li>
                            <li>数据同步将停止</li>
                            <li>需要重新发送邀请才能恢复关联</li>
                        </ul>
                    </div>
                </div>
                <div class="link-unlink-actions">
                    <button class="btn btn-danger" onclick="App.executeUnlink(${supervisedUserId}, ${linkId}, '${linkedUser}')">
                        确认取消
                    </button>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">
                        取消
                    </button>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
    },
    
    // 执行取消关联
    async executeUnlink(supervisedUserId, linkId, linkedUser) {
        try {
            console.log('🔗 [SPA Link] 执行取消关联:', { supervisedUserId, linkId, linkedUser });
            
            const currentAppUser = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : localStorage.getItem('wenting_current_app_user');
            if (!currentAppUser) {
                this.showLinkNotification('error', '用户未登录');
                return;
            }
            
            // 发送取消关联请求
            let response;
            try {
                if (window.WebSocketClient && window.WebSocketClient.isConnected) {
                    response = await window.WebSocketClient.links.cancelLink(linkId);
                } else {
                    // HTTP降级模式
                    const apiResponse = await fetch(`/api/links/${linkId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Device-ID': window.DeviceManager?.getCurrentDeviceId() || 'unknown'
                        },
                        body: JSON.stringify({
                            appUser: currentAppUser
                        })
                    });
                    const responseData = await apiResponse.json();
                    response = { success: apiResponse.ok, data: responseData };
                }
            } catch (error) {
                response = { success: false, error: error.message };
            }
            
            console.log('🔗 [SPA Link] 取消关联结果:', response);
            
            if (response.success) {
                this.showLinkNotification('success', `已取消与 ${linkedUser} 的关联`);
                
                // 关闭确认对话框
                const modal = document.querySelector('.link-unlink-modal');
                if (modal) {
                    modal.remove();
                }
                
                // 重新加载用户数据和Link页面
                setTimeout(async () => {
                    try {
                        // 重新加载用户数据
                        if (window.UserManager) {
                            await UserManager.loadUsersFromAPI();
                        }
                        
                        // 重新加载Link功能内容，显示发送关联界面
                        const user = window.UserManager?.users?.find(u => u.id === supervisedUserId);
                        if (user) {
                            this.displayUserInfoInLink(user);
                        }
                        
                        // 重新检查关联状态
                        await this.displayLinkConnectionStatus();
                    } catch (error) {
                        console.error('重新加载数据失败:', error);
                    }
                }, 1000);
                
            } else {
                this.showLinkNotification('error', response.data?.message || response.error || '取消关联失败');
            }
            
        } catch (error) {
            console.error('❌ [SPA Link] 取消关联失败:', error);
            this.showLinkNotification('error', '取消关联失败');
        }
    },

    // 处理Link状态变更通知
    handleLinkStatusChange(type, data) {
        console.log(`🔗 [SPA Link] 处理Link状态变更:`, type, data);
        
        switch (type) {
            case 'LINK_INVITATION_ACCEPTED':
                this.showLinkNotification('success', `${data.acceptedBy} 接受了您的关联邀请`);
                break;
                
            case 'LINK_INVITATION_REJECTED':
                this.showLinkNotification('info', `${data.rejectedBy} 拒绝了您的关联邀请`);
                break;
                
            case 'LINK_ESTABLISHED':
                this.showLinkNotification('success', `与 ${data.linkedUser} 的关联已建立`);
                
                // 如果有数据同步提示，显示详细通知
                if (data.syncMessage) {
                    setTimeout(() => {
                        this.showDataSyncNotification('info', data.syncMessage);
                    }, 2000);
                }
                
                // 如果当前在Link页面，刷新显示
                if (document.querySelector('.link-content-area')) {
                    setTimeout(async () => {
                        try {
                            // 重新加载用户数据
                            if (window.UserManager) {
                                await UserManager.loadUsersFromAPI();
                            }
                            
                            // 重新检查关联状态
                            await this.displayLinkConnectionStatus();
                            
                            // 如果有选中的用户，重新显示该用户信息
                            const currentUser = window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null;
                            if (currentUser) {
                                const user = window.UserManager?.users?.find(u => u.id === currentUser);
                                if (user) {
                                    this.displayUserInfoInLink(user);
                                }
                            }
                        } catch (error) {
                            console.error('处理关联建立通知时重新加载数据失败:', error);
                        }
                    }, 1000);
                }
                break;
                
            case 'LINK_ACCEPTED':
                this.showLinkNotification('success', `${data.acceptedBy} 接受了您的关联邀请`);
                
                // 🔥 修复：像取消关联一样，先检查是否在Link页面
                if (document.querySelector('.link-content-area')) {
                    // 如果当前在Link页面，直接更新页面状态（和LINK_CANCELLED保持一致）
                    console.log('✅ [Link] 发起方当前在Link页面，直接更新页面状态');
                    setTimeout(async () => {
                        try {
                            // 重新加载用户数据
                            if (window.UserManager) {
                                await UserManager.loadUsersFromAPI();
                            }
                            
                            // 重新检查关联状态
                            await this.displayLinkConnectionStatus();
                            
                            // 如果有选中的用户，重新显示该用户信息
                            const currentUser = window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null;
                            console.log('🔍 [Link] LINK_ACCEPTED 处理 - 当前选中用户ID:', currentUser);
                            console.log('🔍 [Link] LINK_ACCEPTED 处理 - 可用用户列表:', window.UserManager?.users?.map(u => ({id: u.id, username: u.username})));
                            
                            if (currentUser) {
                                const user = window.UserManager?.users?.find(u => u.id === currentUser);
                                console.log('🔍 [Link] LINK_ACCEPTED 处理 - 找到的用户:', user);
                                if (user) {
                                    console.log('🔄 [Link] LINK_ACCEPTED 处理 - 开始调用 displayUserInfoInLink...');
                                    this.displayUserInfoInLink(user);
                                } else {
                                    console.error('❌ [Link] LINK_ACCEPTED 处理 - 没有找到对应的用户对象');
                                }
                            } else {
                                console.error('❌ [Link] LINK_ACCEPTED 处理 - 当前没有选中的用户');
                            }
                        } catch (error) {
                            console.error('处理关联接受通知时更新Link页面失败:', error);
                        }
                    }, 1000);
                } else {
                    // 如果不在Link页面，跳转到Link页面
                    console.log('✅ [Link] 发起方不在Link页面，跳转并刷新应用数据');
                    setTimeout(async () => {
                        await this.refreshApplicationAfterLink();
                    }, 1000);
                }
                
                // 显示数据同步完成提示
                if (data.syncMessage) {
                    setTimeout(() => {
                        this.showDataSyncNotification('success', data.syncMessage);
                    }, 3000); // 延迟一点避免与页面操作冲突
                }
                break;
                
            case 'LINK_CANCELLED':
                this.showLinkNotification('warning', `${data.cancelledBy} 已取消关联关系`);
                // 如果当前在Link页面，刷新页面显示发送关联界面
                if (document.querySelector('.link-content-area')) {
                    setTimeout(async () => {
                        try {
                            // 重新加载用户数据
                            if (window.UserManager) {
                                await UserManager.loadUsersFromAPI();
                            }
                            
                            // 重新检查关联状态
                            await this.displayLinkConnectionStatus();
                            
                            // 如果有选中的用户，重新显示该用户信息
                            const currentUser = window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null;
                            if (currentUser) {
                                const user = window.UserManager?.users?.find(u => u.id === currentUser);
                                if (user) {
                                    this.displayUserInfoInLink(user);
                                }
                            }
                        } catch (error) {
                            console.error('处理关联取消通知时重新加载数据失败:', error);
                        }
                    }, 1000);
                }
                break;
                
            default:
                console.log('⚠️ [SPA Link] 未处理的Link状态类型:', type);
        }
    },
    
    // 显示默认选中用户的信息
    displayDefaultUserInLink() {
        console.log('🔍 [SPA Link] 检查默认选中用户...');
        
        const currentUserId = window.GlobalUserState ? GlobalUserState.getCurrentUser() : null;
        if (currentUserId && window.UserManager && window.UserManager.users) {
            const selectedUser = window.UserManager.users.find(user => user.id === currentUserId);
            if (selectedUser) {
                console.log('👤 [SPA Link] 找到默认用户，显示信息:', selectedUser.username);
                this.displayUserInfoInLink(selectedUser);
            } else {
                console.log('⚠️ [SPA Link] 未找到默认用户对象');
            }
        } else {
            console.log('ℹ️ [SPA Link] 没有默认用户或用户管理器未就绪');
        }
    },

    // 应用状态管理
    getState() {
        return {
            currentUser: TodoManager.currentUser,
            selectedDate: DateManager.selectedDate,
            todos: TodoManager.todos,
            users: UserManager.users,
            weather: WeatherManager.weatherData
        };
    },

    // 重置应用
    reset() {
        alert('重置功能已禁用，应用完全依赖服务器数据。');
    },

    // 导出数据
    exportData() {
        const data = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            ...this.getState()
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `wenting_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    },

    // 导入数据
    importData(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.version && data.todos) {
                    // 导入数据
                    if (data.todos) TodoManager.todos = data.todos;
                    if (data.users) UserManager.users = data.users;
                    if (data.weather) WeatherManager.weatherData = data.weather;
                    
                    // 保存数据
                    TodoManager.saveTodos();
                    UserManager.saveUsers();
                    WeatherManager.saveWeatherData();
                    
                    alert('数据导入成功！页面将刷新。');
                    location.reload();
                } else {
                    alert('无效的备份文件格式');
                }
            } catch (error) {
                alert('导入失败：' + error.message);
            }
        };
        reader.readAsText(file);
    },

    // 🔥 新增：确保WebSocket注册的方法
    ensureWebSocketRegistration() {
        let attempts = 0;
        const MAX_ATTEMPTS = 10;
        const CHECK_INTERVAL = 500; // 500ms

        const tryRegistration = () => {
            attempts++;
            console.log(`🔄 [WebSocket] 尝试注册 (${attempts}/${MAX_ATTEMPTS})`);

            const deviceId = window.DeviceManager ? window.DeviceManager.getCurrentDeviceId() : null;
            const appUserId = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : null;
            const userId = window.GlobalUserState ? window.GlobalUserState.getCurrentUser() : null;

            console.log('🔍 [WebSocket] 注册信息检查:', { deviceId, appUserId, userId });

            if (deviceId && appUserId) {
                console.log('✅ [WebSocket] 注册信息完整，发送注册消息');
                WebSocketClient.sendRegistrationMessage();
                return;
            }

            if (attempts < MAX_ATTEMPTS) {
                console.log(`⏳ [WebSocket] 注册信息不完整，${CHECK_INTERVAL}ms后重试...`);
                setTimeout(tryRegistration, CHECK_INTERVAL);
            } else {
                console.error('❌ [WebSocket] 达到最大重试次数，注册失败');
                console.log('💡 [WebSocket] 请检查用户登录状态和设备ID生成');
            }
        };

        // 立即尝试一次，然后根据需要重试
        tryRegistration();
    }
};

// 启动应用
App.init();

// 将App暴露到全局，方便调试
window.App = App;

// 调试方法：清除位置缓存并重新获取
window.debugClearLocation = function() {
    console.log('🔧 调试：清除位置缓存并重新获取');
    WeatherManager.clearLocationCache();
    WeatherManager.getCurrentLocation().then(() => {
        WeatherManager.fetchRealWeatherData();
        WeatherManager.updateWeatherDisplay();
    });
};