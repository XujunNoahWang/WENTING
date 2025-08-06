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
        // 初始化全局用户状态管理器
        if (window.GlobalUserState) {
            GlobalUserState.init();
        }
        
        // 初始化日期管理器
        DateManager.init();
        
        // 初始化天气管理器（等待地理位置获取完成）
        await WeatherManager.init();
        
        // 启动天气自动更新（30分钟间隔）
        WeatherManager.startAutoUpdate();
        
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
    },

    // 绑定全局事件
    bindGlobalEvents() {
        // 底部导航点击效果
        Utils.$$('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const label = item.querySelector('.nav-label')?.textContent;
                console.log('导航到：', label);
                
                // 这里可以添加路由逻辑
                this.handleNavigation(label);
            });
        });

        // 天气栏点击刷新
        const weatherBar = Utils.$('.weather-bar');
        if (weatherBar) {
            weatherBar.addEventListener('click', () => {
                console.log('用户点击天气栏，刷新天气数据');
                WeatherManager.refreshWeather();
            });
            
            // 添加悬停提示
            weatherBar.style.cursor = 'pointer';
            weatherBar.title = '点击刷新天气数据';
        }

        // 全局错误处理
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
        });

        // 页面可见性变化处理
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // 页面变为可见时，更新当前时间和天气
                DateManager.updateCurrentDate();
                
                // 检查天气数据是否需要更新
                if (WeatherManager.weatherData?.lastUpdated) {
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
            WeatherManager.fetchRealWeatherData();
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

    // 显示Notes页面
    async showNotesPage() {
        console.log('切换到Notes页面');
        
        // 设置全局状态为notes模块
        if (window.GlobalUserState) {
            GlobalUserState.setCurrentModule('notes');
        }
        
        if (window.NotesManager) {
            await NotesManager.init();
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