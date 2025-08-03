// 天气管理模块
const WeatherManager = {
    weatherData: null,
    userLocation: null,
    
    // 默认城市坐标（深圳）
    defaultLocation: {
        latitude: 22.5431,
        longitude: 114.0579,
        city: '深圳'
    },

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

    init() {
        console.log('WeatherManager 初始化开始');
        this.loadWeatherData();
        this.getCurrentLocation();
        this.fetchRealWeatherData();
        this.updateWeatherDisplay();
        console.log('WeatherManager 初始化完成');
    },

    // 获取用户地理位置
    async getCurrentLocation() {
        try {
            if (!navigator.geolocation) {
                console.log('浏览器不支持地理位置');
                this.userLocation = this.defaultLocation;
                return;
            }

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5分钟缓存
                });
            });

            this.userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                city: '当前位置'
            };

            console.log('获取到用户位置:', this.userLocation);
            
            // 获取到位置后立即更新天气
            this.fetchRealWeatherData();
            
        } catch (error) {
            console.log('获取位置失败，使用默认位置:', error.message);
            this.userLocation = this.defaultLocation;
        }
    },

    // 获取真实天气数据
    async fetchRealWeatherData() {
        try {
            const location = this.userLocation || this.defaultLocation;
            const { latitude, longitude } = location;

            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
            
            console.log('正在获取天气数据...', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('天气API响应:', data);
            
            // 转换API数据为应用格式
            const weatherData = this.convertApiData(data, location.city);
            
            this.updateWeather(weatherData);
            console.log('天气数据更新成功:', weatherData);
            
            return weatherData;
            
        } catch (error) {
            console.error('获取天气数据失败:', error);
            // 降级到备用数据
            this.loadFallbackWeather();
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

    // 加载备用天气数据
    loadFallbackWeather() {
        console.log('使用备用天气数据');
        const fallbackData = {
            location: this.userLocation?.city || '深圳',
            icon: '☀️',
            condition: '晴朗',
            temperature: '22°C',
            wind: {
                level: '3级',
                label: '风力'
            },
            humidity: {
                value: '65%',
                label: '湿度'
            },
            lastUpdated: new Date().toISOString(),
            isFallback: true
        };
        
        this.updateWeather(fallbackData);
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
        console.log('更新天气显示，数据:', this.weatherData);
        if (!this.weatherData) {
            console.log('没有天气数据，使用备用数据');
            this.loadFallbackWeather();
            return;
        }

        const elements = {
            icon: Utils.$('.weather-icon'),
            condition: Utils.$('.weather-condition'),
            temp: Utils.$('.weather-temp'),
            windValue: Utils.$('.weather-wind-value'),
            windLabel: Utils.$('.weather-wind-label'),
            humidityValue: Utils.$('.weather-humidity-value'),
            humidityLabel: Utils.$('.weather-humidity-label')
        };

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
        
        setInterval(() => {
            console.log('自动更新天气数据...');
            this.fetchRealWeatherData();
        }, interval);
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