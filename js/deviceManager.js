// 设备管理器 - 基于设备指纹的设备识别
const DeviceManager = {
    deviceId: null,
    deviceInfo: null,

    // 初始化设备管理器
    async init() {
        console.log('🔧 初始化设备管理器...');
        this.deviceId = this.getOrCreateDeviceId();
        this.deviceInfo = this.getDeviceInfo();
        
        console.log('📱 设备ID:', this.deviceId);
        console.log('📊 设备信息:', this.deviceInfo);
        
        // 在页面上显示设备信息（调试用）
        this.displayDeviceInfo();
        
        // 确保新用户的设备ID同步到数据库
        const currentAppUser = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : localStorage.getItem('wenting_current_app_user');
        if (currentAppUser && this.deviceId) {
            console.log('🔄 为新用户同步设备ID到数据库...');
            // 异步同步，不阻塞初始化
            setTimeout(() => {
                this.syncDeviceIdToDatabase();
            }, 1000);
        }
        
        return this.deviceId;
    },

    // 获取或创建设备ID
    getOrCreateDeviceId() {
        // 先尝试从localStorage获取已存在的设备ID
        let deviceId = localStorage.getItem('wenting_device_id');
        
        if (deviceId) {
            console.log('📱 找到已存在的设备ID:', deviceId);
            return deviceId;
        }
        
        // 检查是否有当前登录用户，如果有，尝试从数据库获取该用户的设备ID
        const currentAppUser = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : localStorage.getItem('wenting_current_app_user');
        if (currentAppUser) {
            console.log('🔍 检测到已登录用户:', currentAppUser, '尝试获取其设备ID...');
            const existingDeviceId = this.tryGetExistingDeviceId(currentAppUser);
            if (existingDeviceId) {
                console.log('✅ 找到现有设备ID:', existingDeviceId);
                localStorage.setItem('wenting_device_id', existingDeviceId);
                return existingDeviceId;
            }
        }
        
        // 如果没有，则生成新的设备ID
        deviceId = this.generateDeviceId();
        localStorage.setItem('wenting_device_id', deviceId);
        
        console.log('🆕 生成新的设备ID:', deviceId);
        return deviceId;
    },

    // 生成设备指纹ID
    generateDeviceId() {
        const fingerprint = this.generateDeviceFingerprint();
        
        // 使用指纹生成一个相对稳定的设备ID
        const deviceId = this.hashString(fingerprint);
        
        console.log('🔍 设备指纹:', fingerprint);
        console.log('🆔 生成的设备ID:', deviceId);
        
        return deviceId;
    },

    // 生成设备指纹
    generateDeviceFingerprint() {
        const components = [];
        
        // 1. 用户代理字符串
        components.push(navigator.userAgent);
        
        // 2. 屏幕分辨率
        components.push(`${screen.width}x${screen.height}`);
        
        // 3. 屏幕色深
        components.push(screen.colorDepth.toString());
        
        // 4. 时区偏移
        components.push(new Date().getTimezoneOffset().toString());
        
        // 5. 语言设置
        components.push(navigator.language || navigator.userLanguage || 'unknown');
        
        // 6. 平台信息
        components.push(navigator.platform);
        
        // 7. 是否支持触摸
        components.push(('ontouchstart' in window).toString());
        
        // 8. 设备内存（如果支持）
        if (navigator.deviceMemory) {
            components.push(navigator.deviceMemory.toString());
        }
        
        // 9. 硬件并发数
        if (navigator.hardwareConcurrency) {
            components.push(navigator.hardwareConcurrency.toString());
        }
        
        // 10. Canvas指纹（简化版）
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Device fingerprint test 🔍', 2, 2);
            components.push(canvas.toDataURL());
        } catch (e) {
            components.push('canvas-error');
        }
        
        return components.join('|');
    },

    // 简单的字符串哈希函数
    hashString(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        
        // 转换为正数并添加前缀
        const deviceId = 'device_' + Math.abs(hash).toString(16);
        return deviceId;
    },

    // 获取设备信息
    getDeviceInfo() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
        
        let deviceType = 'desktop';
        if (isTablet) {
            deviceType = 'tablet';
        } else if (isMobile) {
            deviceType = 'mobile';
        }
        
        return {
            type: deviceType,
            isMobile: isMobile,
            isTablet: isTablet,
            isDesktop: !isMobile && !isTablet,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
    },

    // 在页面上显示设备信息（调试用）
    displayDeviceInfo() {
        // 在天气栏添加设备标识
        const locationElement = document.querySelector('.weather-location');
        if (locationElement && this.deviceInfo) {
            const deviceTypeIcon = this.getDeviceTypeIcon();
            const shortDeviceId = this.deviceId.substring(this.deviceId.length - 6);
            
            // 在位置信息后添加设备标识
            const originalTitle = locationElement.title || '';
            locationElement.title = `${originalTitle}\n设备: ${deviceTypeIcon} ${this.deviceInfo.type} (${shortDeviceId})`;
            
            // 可选：在位置文本后添加设备图标
            if (locationElement.textContent && !locationElement.textContent.includes('📱') && !locationElement.textContent.includes('💻')) {
                locationElement.textContent += ` ${deviceTypeIcon}`;
            }
        }
        
        console.log('📱 设备信息已显示在天气栏');
    },

    // 获取设备类型图标
    getDeviceTypeIcon() {
        switch (this.deviceInfo.type) {
            case 'mobile':
                return '📱';
            case 'tablet':
                return '📱';
            case 'desktop':
            default:
                return '💻';
        }
    },

    // 获取当前设备ID
    getCurrentDeviceId() {
        return this.deviceId;
    },

    // 获取设备信息
    getDeviceInformation() {
        return this.deviceInfo;
    },

    // 重置设备ID（调试用）
    resetDeviceId() {
        localStorage.removeItem('wenting_device_id');
        console.log('🔄 设备ID已重置，请刷新页面');
        return this.init();
    },

    // 检查是否为新设备
    isNewDevice() {
        return !localStorage.getItem('wenting_device_id');
    },

    // 尝试从后端获取现有用户的设备ID
    tryGetExistingDeviceId(appUserId) {
        try {
            // 这是一个同步方法，我们需要用异步方式处理
            // 先返回null，然后通过事件系统处理
            setTimeout(() => {
                this.fetchExistingDeviceIdAsync(appUserId);
            }, 100);
            return null;
        } catch (error) {
            console.error('获取现有设备ID失败:', error);
            return null;
        }
    },

    // 异步获取现有设备ID
    async fetchExistingDeviceIdAsync(appUserId) {
        try {
            // 使用ApiClient的动态URL构建逻辑
            if (!window.ApiClient) {
                console.error('❌ ApiClient未初始化');
                return;
            }
            
            // 调用后端API获取该用户的设备ID
            const data = await window.ApiClient.get(`/auth/device-info/${encodeURIComponent(appUserId)}`);
            if (data.success && data.data && data.data.device_id) {
                const existingDeviceId = data.data.device_id;
                console.log('🔄 从服务器获取到设备ID:', existingDeviceId);
                
                // 更新localStorage中的设备ID
                localStorage.setItem('wenting_device_id', existingDeviceId);
                this.deviceId = existingDeviceId;
                
                // 触发设备ID更新事件
                window.dispatchEvent(new CustomEvent('deviceIdUpdated', {
                    detail: { deviceId: existingDeviceId }
                }));
                
                console.log('✅ 设备ID已同步，请刷新页面或重新加载用户数据');
            }
        } catch (error) {
            console.error('异步获取设备ID失败:', error);
        }
    },

    // 手动设置设备ID（调试用）
    setDeviceId(newDeviceId) {
        console.log('🔧 手动设置设备ID:', newDeviceId);
        localStorage.setItem('wenting_device_id', newDeviceId);
        this.deviceId = newDeviceId;
        
        // 触发设备ID更新事件
        window.dispatchEvent(new CustomEvent('deviceIdUpdated', {
            detail: { deviceId: newDeviceId }
        }));
        
        return newDeviceId;
    },

    // 同步设备ID到数据库中的用户记录
    async syncDeviceIdToDatabase() {
        const currentAppUser = window.GlobalUserState ? window.GlobalUserState.getAppUserId() : localStorage.getItem('wenting_current_app_user');
        if (!currentAppUser || !this.deviceId) {
            return;
        }
        
        try {
            console.log('🔄 尝试将设备ID同步到数据库用户记录...');
            
            // 使用ApiClient的动态URL构建逻辑
            if (!window.ApiClient) {
                console.error('❌ ApiClient未初始化');
                return;
            }
            
            const data = await window.ApiClient.post('/auth/update-device-id', {
                app_user_id: currentAppUser,
                device_id: this.deviceId
            });
            
            console.log('✅ 设备ID同步成功:', data);
        } catch (error) {
            console.error('设备ID同步失败:', error);
        }
    }
};

// 导出到全局
window.DeviceManager = DeviceManager;

// 调试方法
window.debugResetDevice = function() {
    console.log('🔧 调试：重置设备ID');
    DeviceManager.resetDeviceId();
    location.reload();
};

window.debugShowDeviceInfo = function() {
    console.log('📱 当前设备信息:');
    console.log('  设备ID:', DeviceManager.getCurrentDeviceId());
    console.log('  设备信息:', DeviceManager.getDeviceInformation());
};

window.debugSetDeviceId = function(deviceId) {
    console.log('🔧 调试：手动设置设备ID');
    DeviceManager.setDeviceId(deviceId);
    console.log('✅ 设备ID已设置，请刷新页面');
};

window.debugSyncDeviceId = function() {
    console.log('🔄 调试：同步设备ID到数据库');
    DeviceManager.syncDeviceIdToDatabase();
};