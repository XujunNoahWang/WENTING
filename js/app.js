// 主应用程序
const App = {
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
            DeviceManager.init();
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
        
        // 设置默认模块为todo
        if (window.GlobalUserState) {
            GlobalUserState.setCurrentModule('todo');
            // 绑定全局用户选择器事件
            GlobalUserState.bindUserSelectorEvents();
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
        
        // 底部导航点击效果
        Utils.$$('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const label = item.querySelector('.nav-label')?.textContent;
                console.log('导航到：', label);
                
                // 这里可以添加路由逻辑
                this.handleNavigation(label);
            });
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
                alert('链接功能开发中');
                break;
            case 'Profile':
                alert('个人设置功能开发中');
                break;
            default:
                console.log('未知导航目标:', page);
        }
    },

    // 显示Todo页面
    showTodoPage() {
        console.log('切换到Todo页面');
        
        // 设置全局状态为todo模块
        if (window.GlobalUserState) {
            GlobalUserState.setCurrentModule('todo');
        }
        
        if (window.TodoManager) {
            const currentUser = GlobalUserState ? GlobalUserState.getCurrentUser() : TodoManager.currentUser;
            console.log('渲染TODO页面，用户:', currentUser);
            TodoManager.renderTodoPanel(currentUser);
        } else {
            console.error('TodoManager未初始化');
        }
    },

    // 显示Notes页面（优化版，避免重复初始化）
    async showNotesPage() {
        console.log('切换到Notes页面');
        
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
            
            if (NotesManager.notes && Object.keys(NotesManager.notes).length > 0) {
                // 已有数据，直接渲染
                const currentUser = GlobalUserState ? GlobalUserState.getCurrentUser() : NotesManager.currentUser;
                console.log('Notes数据已存在，直接渲染，用户:', currentUser);
                NotesManager.renderNotesPanel(currentUser);
            } else {
                // 首次加载或数据为空，需要初始化
                console.log('首次加载Notes或数据为空，开始初始化');
                await NotesManager.init();
            }
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