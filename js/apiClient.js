// API客户端 - 连接前端和后端
const ApiClient = {
    // 动态获取API基础URL
    get baseURL() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        let apiHost;

        // 自动适配 cloudflare tunnel 的 https 域名
        if (protocol === 'https:' && hostname.endsWith('.trycloudflare.com')) {
            // 直接用当前域名的 https，且不加端口
            apiHost = `https://${hostname}`;
        } else if (hostname === '192.168.3.5') {
            apiHost = 'http://192.168.3.5:3001';
        } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
            apiHost = 'http://localhost:3001';
        } else {
            // 默认使用当前主机的3001端口
            apiHost = `http://${hostname}:3001`;
        }

        return `${apiHost}/api`;
    },
    
    // 通用请求方法
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        // 添加设备ID和当前登录用户到请求头
        const deviceId = window.DeviceManager ? window.DeviceManager.getCurrentDeviceId() : null;
        const currentAppUser = localStorage.getItem('wenting_current_app_user');
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'X-Device-ID': deviceId,
                'X-App-User': currentAppUser,
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            console.log('🌐 发送API请求:', url, config);
            const response = await fetch(url, config);
            console.log('📡 收到响应:', response.status, response.statusText);
            
            let data;
            try {
                data = await response.json();
                console.log('📄 响应数据:', data);
            } catch (jsonError) {
                console.error('JSON解析失败:', jsonError);
                throw new Error('服务器响应格式错误');
            }
            
            if (!response.ok) {
                let errorMessage = data.message || `HTTP error! status: ${response.status}`;
                
                // 如果有详细的验证错误，显示它们
                if (data.errors && Array.isArray(data.errors)) {
                    errorMessage += ': ' + data.errors.join(', ');
                }
                
                console.error('❌ API请求失败:', errorMessage);
                console.error('❌ 完整错误信息:', data);
                throw new Error(errorMessage);
            }
            
            return data;
        } catch (error) {
            console.error('❌ API请求异常:', error);
            
            // 处理网络错误
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('网络连接失败，请检查服务器是否运行');
            }
            
            throw error;
        }
    },

    // GET请求
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    // POST请求
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data
        });
    },

    // PUT请求
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data
        });
    },

    // DELETE请求
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // 用户相关API
    users: {
        // 获取所有用户（支持跨设备访问）
        async getAll() {
            const deviceId = window.DeviceManager ? window.DeviceManager.getCurrentDeviceId() : null;
            const appUserId = localStorage.getItem('wenting_current_app_user');
            
            console.log('🔍 ApiClient.users.getAll 调试信息:');
            console.log('  - deviceId:', deviceId);
            console.log('  - appUserId:', appUserId);
            console.log('  - localStorage keys:', Object.keys(localStorage));
            
            if (!appUserId) {
                console.error('❌ 用户未登录，跳转到登录页');
                // 自动跳转到登录页
                window.location.href = 'login.html';
                throw new Error('用户未登录，正在跳转到登录页...');
            }
            
            // 使用跨设备查询模式（推荐）
            let url = `/users?app_user_id=${encodeURIComponent(appUserId)}`;
            
            // 如果有设备ID，也传递给后端（用于审计和兼容性）
            if (deviceId) {
                url += `&device_id=${encodeURIComponent(deviceId)}`;
            }
            
            console.log('📡 发送用户列表请求（跨设备模式）:', url);
            
            return ApiClient.get(url);
        },

        // 根据ID获取用户
        async getById(id) {
            return ApiClient.get(`/users/${id}`);
        },

        // 创建用户
        async create(userData) {
            const deviceId = window.DeviceManager ? window.DeviceManager.getCurrentDeviceId() : null;
            const appUserId = localStorage.getItem('wenting_current_app_user');
            
            console.log('🔍 ApiClient.users.create 调试信息:');
            console.log('  - deviceId:', deviceId);
            console.log('  - appUserId:', appUserId);
            
            if (!deviceId) {
                console.error('❌ 设备ID未初始化');
                throw new Error('设备ID未初始化，请刷新页面重试');
            }
            
            if (!appUserId) {
                console.error('❌ 用户未登录，跳转到登录页');
                // 自动跳转到登录页
                window.location.href = 'login.html';
                throw new Error('用户未登录，正在跳转到登录页...');
            }
            
            // 添加设备ID和注册用户ID到用户数据
            const userDataWithDevice = {
                ...userData,
                device_id: deviceId,
                app_user_id: appUserId
            };
            
            console.log('📤 发送创建用户请求，数据:', userDataWithDevice);
            
            return ApiClient.post('/users', userDataWithDevice);
        },

        // 更新用户
        async update(id, userData) {
            return ApiClient.put(`/users/${id}`, userData);
        },

        // 删除用户
        async delete(id) {
            return ApiClient.delete(`/users/${id}`);
        },

        // 获取用户设置
        async getSettings(id) {
            return ApiClient.get(`/users/${id}/settings`);
        },

        // 更新用户设置
        async updateSettings(id, settings) {
            return ApiClient.put(`/users/${id}/settings`, settings);
        }
    },

    // TODO相关API
    todos: {
        // 获取用户的所有TODO
        async getByUserId(userId) {
            return ApiClient.get(`/todos/user/${userId}`);
        },

        // 获取用户今日TODO
        async getTodayTodos(userId) {
            return ApiClient.get(`/todos/user/${userId}/today`);
        },

        // 获取用户指定日期的TODO
        async getTodosForDate(userId, date) {
            return ApiClient.get(`/todos/user/${userId}/date/${date}`);
        },

        // 根据ID获取TODO
        async getById(id) {
            return ApiClient.get(`/todos/${id}`);
        },

        // 创建TODO
        async create(todoData) {
            return ApiClient.post('/todos', todoData);
        },

        // 更新TODO
        async update(id, todoData) {
            return ApiClient.put(`/todos/${id}`, todoData);
        },

        // 删除TODO
        async delete(id, deletionType = 'all', deletionDate = null) {
            return ApiClient.request(`/todos/${id}`, {
                method: 'DELETE',
                body: { deletion_type: deletionType, deletion_date: deletionDate }
            });
        },

        // 完成TODO
        async complete(id, userId, date, notes = '') {
            return ApiClient.post(`/todos/${id}/complete`, {
                user_id: userId,
                date: date,
                notes
            });
        },

        // 取消完成TODO
        async uncomplete(id, date) {
            return ApiClient.post(`/todos/${id}/uncomplete`, {
                date: date
            });
        }
    },

    // 重复模式相关API
    patterns: {
        // 获取所有重复模式
        async getAll() {
            return ApiClient.get('/patterns');
        },

        // 获取预设重复模式
        async getPresets() {
            return ApiClient.get('/patterns/presets');
        },

        // 根据ID获取重复模式
        async getById(id) {
            return ApiClient.get(`/patterns/${id}`);
        },

        // 创建重复模式
        async create(patternData) {
            return ApiClient.post('/patterns', patternData);
        },

        // 创建预设重复模式
        async createPreset(name) {
            return ApiClient.post(`/patterns/presets/${name}`);
        },

        // 检查日期是否匹配模式
        async checkDateMatch(id, targetDate, startDate) {
            return ApiClient.post(`/patterns/${id}/check`, {
                targetDate,
                startDate
            });
        },

        // 获取下一个匹配日期
        async getNextMatchDate(id, currentDate, startDate) {
            return ApiClient.post(`/patterns/${id}/next`, {
                currentDate,
                startDate
            });
        },

        // 获取时间范围内的匹配日期
        async getMatchDatesInRange(id, startDate, rangeStart, rangeEnd) {
            return ApiClient.post(`/patterns/${id}/range`, {
                startDate,
                rangeStart,
                rangeEnd
            });
        }
    },

    // Notes相关API
    notes: {
        // 获取用户的所有Notes
        async getByUserId(userId) {
            return ApiClient.get(`/notes/user/${userId}`);
        },

        // 根据ID获取Note
        async getById(id) {
            return ApiClient.get(`/notes/${id}`);
        },

        // 创建Note
        async create(noteData) {
            return ApiClient.post('/notes', noteData);
        },

        // 更新Note
        async update(id, noteData) {
            return ApiClient.put(`/notes/${id}`, noteData);
        },

        // 删除Note
        async delete(id) {
            return ApiClient.delete(`/notes/${id}`);
        },

        // 搜索Notes
        async search(searchTerm, userId = null) {
            const params = userId ? `?userId=${userId}` : '';
            return ApiClient.get(`/notes/search/${encodeURIComponent(searchTerm)}${params}`);
        },

        // 生成AI建议（传递真实天气数据）
        async generateAISuggestions(id) {
            // 获取用户位置信息
            console.log('🔍 开始获取用户位置和天气信息...');
            
            let userLocation = null;
            
            // 检查WeatherManager是否存在和初始化
            if (!window.WeatherManager) {
                console.log('❌ WeatherManager未初始化，无法获取位置信息');
            } else {
                console.log('✅ WeatherManager已初始化，状态:', {
                    locationReady: window.WeatherManager.locationReady,
                    hasUserLocation: !!window.WeatherManager.userLocation
                });
                
                if (window.WeatherManager.locationReady && window.WeatherManager.userLocation) {
                    userLocation = window.WeatherManager.userLocation;
                    console.log('📍 直接获取到用户位置:', userLocation);
                } else {
                    console.log('⏳ 用户位置还未准备好，尝试等待获取...');
                    
                    // 等待位置获取完成，最多等待5秒
                    let attempts = 0;
                    const maxAttempts = 10; // 5秒内检查10次
                    
                    while (attempts < maxAttempts && !userLocation) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        if (window.WeatherManager.locationReady && window.WeatherManager.userLocation) {
                            userLocation = window.WeatherManager.userLocation;
                            console.log('📍 等待后获取到用户位置:', userLocation);
                            break;
                        }
                        
                        attempts++;
                        console.log(`⏳ 位置获取尝试 ${attempts}/${maxAttempts}`);
                    }
                    
                    if (!userLocation) {
                        console.log('❌ 等待超时，无法获取用户位置');
                        console.log('🔍 最终WeatherManager状态:', {
                            locationReady: window.WeatherManager.locationReady,
                            userLocation: window.WeatherManager.userLocation
                        });
                    }
                }
            }
            
            // 获取天气数据
            console.log('🌤️ 开始获取天气数据...');
            let weatherData = null;
            
            if (window.WeatherManager && window.WeatherManager.weatherData) {
                weatherData = window.WeatherManager.weatherData;
                console.log('🌤️ 获取到天气数据:', weatherData);
            } else {
                console.log('❌ WeatherManager中无天气数据');
            }
            
            console.log('📍 最终发送给AI服务的位置:', userLocation);
            console.log('🌤️ 最终发送给AI服务的天气数据:', weatherData);
            
            return ApiClient.post(`/notes/${id}/ai-suggestions`, {
                userLocation: userLocation,
                weatherData: weatherData
            });
        }
    },

    // 认证相关API
    auth: {
        // 注册
        async register(username, password) {
            // 认证API不需要在headers中添加当前用户信息
            return fetch(`${ApiClient.baseURL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            }).then(response => response.json());
        },

        // 登录
        async login(username, password) {
            return fetch(`${ApiClient.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            }).then(response => response.json());
        },

        // 验证登录状态
        async verify(username) {
            return fetch(`${ApiClient.baseURL}/auth/verify?username=${encodeURIComponent(username)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then(response => response.json());
        },

        // 获取用户资料（用于Profile页面）
        async getProfile(username) {
            return fetch(`${ApiClient.baseURL}/auth/profile/${encodeURIComponent(username)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then(response => response.json());
        }
    },

    // 健康检查
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
            return await response.json();
        } catch (error) {
            console.error('健康检查失败:', error);
            return { success: false, message: '服务器连接失败' };
        }
    },

    // 测试连接
    async testConnection() {
        try {
            const health = await this.healthCheck();
            if (health.success) {
                console.log('✅ 后端服务连接成功');
                return true;
            } else {
                console.warn('⚠️ 后端服务响应异常:', health.message);
                return false;
            }
        } catch (error) {
            console.error('❌ 后端服务连接失败:', error.message);
            return false;
        }
    }
};

// 导出到全局
window.ApiClient = ApiClient;