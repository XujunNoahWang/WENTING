// 天气管理模块
const WeatherManager = {
    weatherData: null,
    userLocation: null,
    autoUpdateTimer: null,
    locationReady: false,

    // Open-Meteo天气代码映射
    weatherCodeMap: {
        0: { condition: '晴朗', icon: '☀️' },
        1: { condition: '基本晴朗', icon: '🌤️' },
        2: { condition: '部分多云', icon: '⛅' },
        3: { condition: '阴天', icon: '☁️' },
        45: { condition: '雾', icon: '🌫️' },
        48: { condition: '冻雾', icon: '🌫️' },
        51: { condition: '细雨', icon: '🌦️' },
        53: { condition: '小雨', icon: '🌦️' },
        55: { condition: '中雨', icon: '🌧️' },
        61: { condition: '小雨', icon: '🌦️' },
        63: { condition: '中雨', icon: '🌧️' },
        65: { condition: '大雨', icon: '🌧️' },
        71: { condition: '小雪', icon: '🌨️' },
        73: { condition: '中雪', icon: '❄️' },
        75: { condition: '大雪', icon: '❄️' },
        80: { condition: '阵雨', icon: '🌦️' },
        81: { condition: '阵雨', icon: '🌦️' },
        82: { condition: '暴雨', icon: '⛈️' },
        95: { condition: '雷雨', icon: '⛈️' },
        96: { condition: '雷雨冰雹', icon: '⛈️' },
        99: { condition: '强雷雨冰雹', icon: '⛈️' }
    },

    async init() {
        console.log('WeatherManager 初始化开始 - 只使用用户实际位置');

        this.loadWeatherData();

        // 必须获取用户实际位置，不使用任何默认位置
        await this.getCurrentLocation();

        if (this.userLocation && this.locationReady) {
            console.log('✅ 用户位置获取成功，开始获取天气数据');
            this.fetchRealWeatherData();
            this.updateWeatherDisplay();
        } else {
            console.log('❌ 无法获取用户位置，天气功能不可用');
            this.showLocationError();
        }

        console.log('WeatherManager 初始化完成，用户位置:', this.userLocation);
    },

    // 清除位置缓存，强制重新获取
    clearLocationCache() {
        localStorage.removeItem('wenting_user_location');
        this.userLocation = null;
        this.locationReady = false;
        console.log('🗑️ 位置缓存已清除');
    },

    // 获取用户地理位置
    async getCurrentLocation() {
        try {
            // 先检查本地存储是否有用户选择的位置
            const savedLocation = localStorage.getItem('wenting_user_location');
            if (savedLocation) {
                this.userLocation = JSON.parse(savedLocation);
                this.locationReady = true;
                console.log('使用用户设定的位置:', this.userLocation);
                return;
            }

            if (!navigator.geolocation) {
                console.log('❌ 浏览器不支持地理位置，使用默认位置');
                this.useDefaultLocation();
                return;
            }

            // 检查是否为HTTPS或localhost
            const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
            if (!isSecureContext) {
                console.log('⚠️ 非安全上下文，地理位置API可能不可用，使用默认位置');
                this.useDefaultLocation();
                return;
            }

            console.log('🌍 请求用户地理位置权限...');
            
            // 显示位置权限请求提示
            this.showLocationPermissionPrompt();

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        console.log('✅ 用户授权地理位置成功');
                        this.hideLocationPermissionPrompt();
                        resolve(pos);
                    },
                    (error) => {
                        console.log('❌ 地理位置获取失败:', error.message);
                        this.hideLocationPermissionPrompt();
                        
                        if (error.code === error.PERMISSION_DENIED) {
                            console.log('用户拒绝了地理位置权限，使用默认位置');
                            this.showLocationDeniedMessage();
                        } else if (error.code === error.POSITION_UNAVAILABLE) {
                            console.log('位置信息不可用，使用默认位置');
                        } else if (error.code === error.TIMEOUT) {
                            console.log('获取位置超时，使用默认位置');
                        }
                        
                        // 使用默认位置而不是完全失败
                        this.useDefaultLocation();
                        resolve(null); // 不reject，而是resolve null
                    },
                    {
                        enableHighAccuracy: false, // 降低精度要求，提高成功率
                        timeout: 15000, // 增加超时时间
                        maximumAge: 600000 // 10分钟缓存
                    }
                );
            });

            if (!position) {
                // 已经使用默认位置，直接返回
                return;
            }

            // 使用用户的实际位置，不做任何地区限制
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            this.userLocation = {
                latitude: lat,
                longitude: lon,
                city: '获取中...'
            };
            this.locationReady = true;

            console.log('✅ 获取到用户实际位置:', this.userLocation);

            // 异步获取城市名称
            this.getCityFromCoords(lat, lon).then(cityName => {
                this.userLocation.city = cityName;
                console.log('🏙️ 城市名称更新:', cityName);
                // 更新显示
                this.updateWeatherDisplay();
            });

            // 获取到位置后立即更新天气
            this.fetchRealWeatherData();

        } catch (error) {
            console.log('❌ 获取用户位置失败:', error.message);
            this.userLocation = null;
            this.locationReady = false;
        }
    },

    // 根据坐标获取城市名称
    async getCityFromCoords(lat, lon) {
        try {
            // 使用免费的反向地理编码服务获取城市名
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`);
            if (response.ok) {
                const data = await response.json();
                const city = data.city || data.locality || data.principalSubdivision || '未知位置';
                console.log('🏙️ 获取到城市名:', city);
                return city;
            }
        } catch (error) {
            console.log('反向地理编码失败:', error);
        }

        // 如果反向地理编码失败，返回坐标
        return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    },

    // 获取真实天气数据
    async fetchRealWeatherData() {
        try {
            if (!this.userLocation || !this.locationReady) {
                console.log('❌ 没有用户位置信息，无法获取天气数据');
                this.showLocationError();
                return null;
            }

            const { latitude, longitude } = this.userLocation;

            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;

            console.log('正在获取天气数据...', url);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();
            console.log('天气API响应:', data);

            // 转换API数据为应用格式
            const weatherData = this.convertApiData(data, this.userLocation?.city || '当前位置');

            this.updateWeather(weatherData);
            console.log('天气数据更新成功:', weatherData);

            return weatherData;

        } catch (error) {
            console.error('获取天气数据失败:', error);
            // 如果没有用户位置，显示错误信息
            if (!this.userLocation || !this.locationReady) {
                this.showLocationError();
            }
            return null;
        }
    },

    // 转换API数据格式
    convertApiData(apiData, cityName) {
        const current = apiData.current;
        const weatherCode = current.weather_code;
        const weatherInfo = this.weatherCodeMap[weatherCode] || { condition: '未知', icon: '❓' };

        return {
            location: cityName,
            icon: weatherInfo.icon,
            condition: weatherInfo.condition,
            temperature: Math.round(current.temperature_2m) + '°C',
            wind: {
                level: this.convertWindSpeed(current.wind_speed_10m),
                label: '风力'
            },
            humidity: {
                value: Math.round(current.relative_humidity_2m) + '%',
                label: '湿度'
            },
            lastUpdated: new Date().toISOString(),
            isError: false
        };
    },

    // 转换风速为等级
    convertWindSpeed(windSpeedKmh) {
        if (windSpeedKmh < 6) return '1级';
        if (windSpeedKmh < 12) return '2级';
        if (windSpeedKmh < 20) return '3级';
        if (windSpeedKmh < 29) return '4级';
        if (windSpeedKmh < 39) return '5级';
        if (windSpeedKmh < 50) return '6级';
        if (windSpeedKmh < 62) return '7级';
        if (windSpeedKmh < 75) return '8级';
        if (windSpeedKmh < 89) return '9级';
        if (windSpeedKmh < 103) return '10级';
        if (windSpeedKmh < 118) return '11级';
        return '12级';
    },

    // 使用默认位置（深圳）
    useDefaultLocation() {
        console.log('🏙️ 使用默认位置：深圳');
        this.userLocation = {
            latitude: 22.5431,
            longitude: 114.0579,
            city: '深圳'
        };
        this.locationReady = true;
        
        // 获取默认位置的天气
        this.fetchRealWeatherData();
    },

    // 显示位置权限请求提示
    showLocationPermissionPrompt() {
        const locationElement = Utils.$('.weather-location');
        if (locationElement) {
            locationElement.textContent = '请求位置权限...';
            locationElement.className = 'weather-location requesting';
            locationElement.title = '正在请求地理位置权限，请允许访问';
        }
    },

    // 隐藏位置权限请求提示
    hideLocationPermissionPrompt() {
        // 提示会在后续的updateWeatherDisplay中被更新
    },

    // 显示位置权限被拒绝的消息
    showLocationDeniedMessage() {
        // 显示一个临时提示消息
        this.showTemporaryMessage('位置权限被拒绝，将使用默认位置（深圳）获取天气信息', 'warning');
    },

    // 显示临时消息
    showTemporaryMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `weather-message weather-message-${type}`;
        messageEl.textContent = message;
        let backgroundColor = '#2196F3'; // 默认蓝色
        if (type === 'warning') backgroundColor = '#ff9800';
        if (type === 'success') backgroundColor = '#4CAF50';
        if (type === 'error') backgroundColor = '#f44336';
        
        messageEl.style.cssText = `
            position: fixed;
            top: 90px;
            left: 50%;
            transform: translateX(-50%);
            background: ${backgroundColor};
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10001;
            max-width: 80%;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(messageEl);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.opacity = '0';
                messageEl.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    if (messageEl.parentNode) {
                        messageEl.parentNode.removeChild(messageEl);
                    }
                }, 300);
            }
        }, 3000);
    },

    // 显示位置错误信息
    showLocationError() {
        console.log('显示位置权限错误信息');
        const errorData = {
            location: '位置未授权',
            icon: '❌',
            condition: '需要位置权限',
            temperature: '--°C',
            wind: {
                level: '--',
                label: '风力'
            },
            humidity: {
                value: '--%',
                label: '湿度'
            },
            lastUpdated: new Date().toISOString(),
            isError: true
        };

        this.updateWeather(errorData);

        // 直接更新位置显示
        const locationElement = Utils.$('.weather-location');
        if (locationElement) {
            locationElement.textContent = '位置未授权';
            locationElement.className = 'weather-location error';
            locationElement.title = '请允许浏览器访问您的位置信息';
        }
    },

    // 加载天气数据
    loadWeatherData() {
        const savedWeather = localStorage.getItem('wenting_weather');
        if (savedWeather) {
            this.weatherData = JSON.parse(savedWeather);
            // 检查数据是否过期（超过30分钟）
            if (this.weatherData.lastUpdated) {
                const lastUpdate = new Date(this.weatherData.lastUpdated);
                const now = new Date();
                const diffMinutes = (now - lastUpdate) / (1000 * 60);

                if (diffMinutes > 30) {
                    console.log('天气数据已过期，将重新获取');
                    this.fetchRealWeatherData();
                }
            }
        } else {
            this.weatherData = Utils.deepClone(APP_CONFIG.weather);
        }
    },

    // 保存天气数据
    saveWeatherData() {
        localStorage.setItem('wenting_weather', JSON.stringify(this.weatherData));
    },

    // 更新天气显示
    updateWeatherDisplay() {
        console.log('🔄 updateWeatherDisplay 被调用');
        console.log('更新天气显示，数据:', this.weatherData);
        if (!this.weatherData) {
            console.log('没有天气数据');
            if (!this.userLocation || !this.locationReady) {
                this.showLocationError();
            }
            return;
        }

        const elements = {
            icon: Utils.$('.weather-icon'),
            condition: Utils.$('.weather-condition'),
            temp: Utils.$('.weather-temp'),
            windValue: Utils.$('.weather-wind-value'),
            windLabel: Utils.$('.weather-wind-label'),
            humidityValue: Utils.$('.weather-humidity-value'),
            humidityLabel: Utils.$('.weather-humidity-label'),
            location: Utils.$('.weather-location')
        };

        console.log('🔍 调试：location元素:', elements.location);
        console.log('🔍 调试：weatherData.location:', this.weatherData.location);
        console.log('🔍 调试：userLocation:', this.userLocation);
        console.log('🔍 调试：locationReady:', this.locationReady);

        if (elements.icon) {
            elements.icon.textContent = this.weatherData.icon;
        }

        if (elements.condition) {
            elements.condition.textContent = this.weatherData.condition;
            // 如果是备用数据，添加提示
            if (this.weatherData.isFallback) {
                elements.condition.title = '网络连接问题，显示备用数据';
            }
        }

        if (elements.temp) {
            elements.temp.textContent = this.weatherData.temperature;
        }

        if (elements.windValue) {
            elements.windValue.textContent = this.weatherData.wind.level;
        }

        if (elements.windLabel) {
            elements.windLabel.textContent = this.weatherData.wind.label;
        }

        if (elements.humidityValue) {
            elements.humidityValue.textContent = this.weatherData.humidity.value;
        }

        if (elements.humidityLabel) {
            elements.humidityLabel.textContent = this.weatherData.humidity.label;
        }

        // 更新位置显示
        console.log('🔍 开始更新位置显示');
        if (elements.location) {
            console.log('✅ 找到location元素');
            if (this.weatherData.isError) {
                console.log('❌ 显示错误状态');
                elements.location.textContent = '位置未授权';
                elements.location.className = 'weather-location error';
            } else if (this.weatherData.location) {
                console.log('🏙️ 使用天气数据中的位置:', this.weatherData.location);
                // 优先使用天气数据中的位置信息
                elements.location.textContent = this.weatherData.location;
                elements.location.className = 'weather-location';
                
                // 如果有用户位置坐标，添加到title中
                if (this.userLocation && this.userLocation.latitude && this.userLocation.longitude) {
                    elements.location.title = `纬度: ${this.userLocation.latitude.toFixed(4)}, 经度: ${this.userLocation.longitude.toFixed(4)}`;
                } else {
                    elements.location.title = '基于天气数据的位置';
                }
                console.log('✅ 位置已更新为:', elements.location.textContent);
            } else if (this.userLocation && this.locationReady) {
                console.log('📍 使用用户位置数据:', this.userLocation.city);
                // 备用：使用用户位置数据
                elements.location.textContent = this.userLocation.city || '当前位置';
                elements.location.className = 'weather-location';
                elements.location.title = `纬度: ${this.userLocation.latitude.toFixed(4)}, 经度: ${this.userLocation.longitude.toFixed(4)}`;
            } else {
                console.log('⏳ 显示定位中状态');
                elements.location.textContent = '定位中...';
                elements.location.className = 'weather-location loading';
            }
        } else {
            console.log('❌ 未找到location元素');
        }
    },

    // 更新天气数据
    updateWeather(newWeatherData) {
        this.weatherData = { ...this.weatherData, ...newWeatherData };
        this.saveWeatherData();
        this.updateWeatherDisplay();
    },

    // 手动刷新天气
    async refreshWeather() {
        console.log('手动刷新天气数据...');

        // 添加加载状态
        const weatherBar = Utils.$('.weather-bar');
        const weatherIcon = Utils.$('.weather-icon');

        if (weatherBar) {
            weatherBar.classList.add('loading');
        }
        if (weatherIcon) {
            weatherIcon.classList.add('loading');
        }

        try {
            await this.fetchRealWeatherData();
        } catch (error) {
            console.error('刷新天气失败:', error);
        } finally {
            // 移除加载状态
            setTimeout(() => {
                if (weatherBar) {
                    weatherBar.classList.remove('loading');
                }
                if (weatherIcon) {
                    weatherIcon.classList.remove('loading');
                }
            }, 300); // 延迟一下让用户看到反馈
        }
    },

    // 定时更新天气
    startAutoUpdate(interval = 30 * 60 * 1000) {
        console.log('启动天气自动更新，间隔:', interval / 60000, '分钟');

        // 清除之前的定时器，防止重复创建
        if (this.autoUpdateTimer) {
            clearInterval(this.autoUpdateTimer);
        }

        this.autoUpdateTimer = setInterval(() => {
            console.log('自动更新天气数据...');
            this.fetchRealWeatherData();
        }, interval);
    },

    // 停止自动更新
    stopAutoUpdate() {
        if (this.autoUpdateTimer) {
            clearInterval(this.autoUpdateTimer);
            this.autoUpdateTimer = null;
            console.log('天气自动更新已停止');
        }
    },

    // 根据天气代码获取天气信息（保持兼容性）
    getWeatherIcon(condition) {
        const iconMap = {
            '晴朗': '☀️',
            '多云': '⛅',
            '阴天': '☁️',
            '小雨': '🌦️',
            '大雨': '🌧️',
            '雷雨': '⛈️',
            '雪': '❄️',
            '雾': '🌫️'
        };

        return iconMap[condition] || '☀️';
    }
    // 显示位置设置对话框
    showLocationSettings() {
        const modalHtml = `
            <div class="modal-overlay" id="locationSettingsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>位置设置</h3>
                        <button class="modal-close" onclick="WeatherManager.closeLocationSettings()">×</button>
                    </div>
                    <div class="location-settings">
                        <div class="current-location">
                            <h4>当前位置</h4>
                            <p>${this.userLocation ? this.userLocation.city : '未设置'}</p>
                            ${this.userLocation ? `<small>纬度: ${this.userLocation.latitude.toFixed(4)}°, 经度: ${this.userLocation.longitude.toFixed(4)}°</small>` : ''}
                        </div>
                        
                        <div class="location-options">
                            <button class="location-btn" onclick="WeatherManager.requestLocationPermission()">
                                📍 获取当前位置
                            </button>
                            <p class="location-note">需要浏览器位置权限</p>
                            
                            <div class="manual-location">
                                <h4>手动设置位置</h4>
                                <div class="city-presets">
                                    <button class="city-btn" onclick="WeatherManager.setManualLocation(22.5431, 114.0579, '深圳')">深圳</button>
                                    <button class="city-btn" onclick="WeatherManager.setManualLocation(39.9042, 116.4074, '北京')">北京</button>
                                    <button class="city-btn" onclick="WeatherManager.setManualLocation(31.2304, 121.4737, '上海')">上海</button>
                                    <button class="city-btn" onclick="WeatherManager.setManualLocation(23.1291, 113.2644, '广州')">广州</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button onclick="WeatherManager.closeLocationSettings()">关闭</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // 关闭位置设置对话框
    closeLocationSettings() {
        const modal = document.getElementById('locationSettingsModal');
        if (modal) {
            modal.remove();
        }
    },

    // 请求位置权限
    async requestLocationPermission() {
        this.closeLocationSettings();
        
        // 清除之前的位置缓存，强制重新获取
        localStorage.removeItem('wenting_user_location');
        this.userLocation = null;
        this.locationReady = false;
        
        // 重新获取位置
        await this.getCurrentLocation();
        this.updateWeatherDisplay();
    },

    // 设置手动位置
    setManualLocation(lat, lon, city) {
        console.log(`🏙️ 手动设置位置: ${city} (${lat}, ${lon})`);
        
        this.userLocation = {
            latitude: lat,
            longitude: lon,
            city: city
        };
        this.locationReady = true;
        
        // 保存到本地存储
        localStorage.setItem('wenting_user_location', JSON.stringify(this.userLocation));
        
        // 关闭对话框
        this.closeLocationSettings();
        
        // 获取新位置的天气
        this.fetchRealWeatherData();
        this.updateWeatherDisplay();
        
        // 显示成功消息
        this.showTemporaryMessage(`位置已设置为 ${city}`, 'success');
    }
};

// 暴露WeatherManager到全局作用域，供其他模块使用
window.WeatherManager = WeatherManager;