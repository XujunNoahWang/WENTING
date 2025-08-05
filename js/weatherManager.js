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
                console.log('❌ 浏览器不支持地理位置，天气功能不可用');
                this.locationReady = false;
                return;
            }

            console.log('🌍 请求用户地理位置权限...');

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        console.log('✅ 用户授权地理位置成功');
                        resolve(pos);
                    },
                    (error) => {
                        console.log('❌ 地理位置获取失败:', error.message);
                        if (error.code === error.PERMISSION_DENIED) {
                            console.log('用户拒绝了地理位置权限');
                        } else if (error.code === error.POSITION_UNAVAILABLE) {
                            console.log('位置信息不可用');
                        } else if (error.code === error.TIMEOUT) {
                            console.log('获取位置超时');
                        }
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 300000 // 5分钟缓存
                    }
                );
            });

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
            lastUpdated: new Date().toISOString()
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
            locationElement.style.color = '#e0245e';
            locationElement.style.backgroundColor = 'rgba(224, 36, 94, 0.1)';
            locationElement.style.borderColor = 'rgba(224, 36, 94, 0.2)';
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
                elements.location.style.color = '#e0245e';
                elements.location.style.backgroundColor = 'rgba(224, 36, 94, 0.1)';
                elements.location.style.borderColor = 'rgba(224, 36, 94, 0.2)';
            } else if (this.weatherData.location) {
                console.log('🏙️ 使用天气数据中的位置:', this.weatherData.location);
                // 优先使用天气数据中的位置信息
                elements.location.textContent = this.weatherData.location;
                elements.location.style.color = '#1d9bf0';
                elements.location.style.backgroundColor = 'rgba(29, 155, 240, 0.1)';
                elements.location.style.borderColor = 'rgba(29, 155, 240, 0.2)';
                
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
                elements.location.style.color = '#1d9bf0';
                elements.location.style.backgroundColor = 'rgba(29, 155, 240, 0.1)';
                elements.location.style.borderColor = 'rgba(29, 155, 240, 0.2)';
                elements.location.title = `纬度: ${this.userLocation.latitude.toFixed(4)}, 经度: ${this.userLocation.longitude.toFixed(4)}`;
            } else {
                console.log('⏳ 显示定位中状态');
                elements.location.textContent = '定位中...';
                elements.location.style.color = '#657786';
                elements.location.style.backgroundColor = 'rgba(101, 119, 134, 0.1)';
                elements.location.style.borderColor = 'rgba(101, 119, 134, 0.2)';
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
};