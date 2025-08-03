// API客户端 - 连接前端和后端
const ApiClient = {
    baseURL: 'http://localhost:3001/api',
    
    // 通用请求方法
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API请求失败:', error);
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
        // 获取所有用户
        async getAll() {
            return ApiClient.get('/users');
        },

        // 根据ID获取用户
        async getById(id) {
            return ApiClient.get(`/users/${id}`);
        },

        // 创建用户
        async create(userData) {
            return ApiClient.post('/users', userData);
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
        // 获取用户的TODO列表
        async getByUserId(userId, options = {}) {
            const params = new URLSearchParams();
            Object.keys(options).forEach(key => {
                if (options[key] !== null && options[key] !== undefined) {
                    params.append(key, options[key]);
                }
            });
            const queryString = params.toString();
            return ApiClient.get(`/todos/user/${userId}${queryString ? '?' + queryString : ''}`);
        },

        // 获取用户今日TODO
        async getTodayTodos(userId, date = null) {
            const params = date ? `?date=${date}` : '';
            return ApiClient.get(`/todos/user/${userId}/today${params}`);
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
        async delete(id) {
            return ApiClient.delete(`/todos/${id}`);
        },

        // 完成TODO
        async complete(id, userId, date = null, notes = '', mood = null) {
            return ApiClient.post(`/todos/${id}/complete`, {
                user_id: userId,
                date: date || new Date().toISOString().split('T')[0],
                notes,
                mood
            });
        },

        // 取消完成TODO
        async uncomplete(id, date = null) {
            return ApiClient.post(`/todos/${id}/uncomplete`, {
                date: date || new Date().toISOString().split('T')[0]
            });
        },

        // 批量更新排序
        async updateSortOrder(todoOrders) {
            return ApiClient.put('/todos/batch/sort', { todoOrders });
        },

        // 获取用户完成统计
        async getStats(userId, startDate = null, endDate = null) {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            const queryString = params.toString();
            return ApiClient.get(`/todos/user/${userId}/stats${queryString ? '?' + queryString : ''}`);
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