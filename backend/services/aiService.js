const { GoogleGenerativeAI } = require('@google/generative-ai');

// 加载环境变量
require('dotenv').config();

// 配置Gemini API
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL;

if (!API_KEY || !MODEL_NAME) {
    console.warn('⚠️ Gemini API配置缺失，AI功能将被禁用');
    console.log('💡 如需启用AI功能，请在.env文件中配置GEMINI_API_KEY和GEMINI_MODEL');
}

class AIService {
    constructor() {
        this.isEnabled = !!(API_KEY && MODEL_NAME);
        
        if (this.isEnabled) {
            this.genAI = new GoogleGenerativeAI(API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: MODEL_NAME });
            console.log(`🤖 AI服务初始化完成，使用模型: ${MODEL_NAME}`);
        } else {
            console.log('🤖 AI服务已禁用（缺少API配置）');
        }
    }

    /**
     * 为健康笔记生成AI建议（使用真实天气数据）
     * @param {Object} noteData - 笔记数据
     * @param {Object} weatherData - 真实天气数据
     * @param {Object} userLocation - 用户位置信息
     * @returns {Promise<string>} AI建议内容
     */
    async generateHealthSuggestions(noteData, weatherData = null, userLocation = null) {
        if (!this.isEnabled) {
            console.log('⚠️ AI服务未启用，返回默认建议');
            return this.getDefaultHealthSuggestions(noteData, weatherData);
        }

        try {
            const { title, description, precautions } = noteData;

            console.log('🤖 使用真实天气数据生成AI健康建议');
            console.log('🌤️ 天气数据:', weatherData);
            console.log('📍 用户位置信息:', userLocation);

            const prompt = this.buildWeatherBasedPrompt(title, description, precautions, weatherData, userLocation);

            console.log('🔄 正在生成AI建议（使用真实天气数据）...');
            console.log('📄 提示词长度:', prompt.length);

            // 调用Gemini API
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log('✅ AI建议生成成功');
            console.log('📝 生成内容长度:', text.length);
            console.log('📝 生成内容预览:', text.substring(0, 200) + '...');

            return text;

        } catch (error) {
            console.error('❌ 生成AI建议失败:', error);
            
            // 降级到默认建议
            console.log('🔄 降级到默认健康建议');
            return this.getDefaultHealthSuggestions(noteData, weatherData);
        }
    }

    /**
     * 获取默认健康建议（当AI服务不可用时）
     * @param {Object} noteData - 笔记数据
     * @param {Object} weatherData - 天气数据
     * @returns {string} 默认建议
     */
    getDefaultHealthSuggestions(noteData, weatherData = null) {
        const { title, precautions } = noteData;
        const now = new Date();
        const season = this.getSeason(now.getMonth() + 1);
        const timeOfDay = this.getTimeOfDay(now.getHours());
        
        let suggestions = `📋 基于您的健康状况"${title}"的一般性建议：\n\n`;
        
        // 基于时间的建议
        suggestions += `🕐 **${timeOfDay}时段建议**\n`;
        if (timeOfDay === '早晨') {
            suggestions += `- 适量饮水，补充夜间流失的水分\n- 进行轻度活动，促进血液循环\n`;
        } else if (timeOfDay === '晚上') {
            suggestions += `- 避免剧烈运动，保持心情平静\n- 注意保暖，避免受凉\n`;
        } else {
            suggestions += `- 保持适当的活动量\n- 注意休息，避免过度疲劳\n`;
        }
        
        // 基于季节的建议
        suggestions += `\n🌸 **${season}季节注意事项**\n`;
        if (season === '春季') {
            suggestions += `- 注意防过敏，避免接触过敏原\n- 适当增减衣物，预防感冒\n`;
        } else if (season === '夏季') {
            suggestions += `- 注意防暑降温，多饮水\n- 避免长时间暴露在高温环境中\n`;
        } else if (season === '秋季') {
            suggestions += `- 注意保暖，预防感冒\n- 保持室内湿度适宜\n`;
        } else {
            suggestions += `- 加强保暖措施\n- 注意室内通风，预防呼吸道疾病\n`;
        }
        
        // 基于天气的建议
        if (weatherData && !weatherData.isError) {
            suggestions += `\n🌤️ **当前天气应对**\n`;
            suggestions += `- 当前天气：${weatherData.condition}\n`;
            suggestions += `- 温度：${weatherData.temperature}，请适当调整衣物\n`;
            if (weatherData.humidity) {
                suggestions += `- 湿度：${weatherData.humidity.value}，注意保持舒适的环境湿度\n`;
            }
        }
        
        // 通用健康建议
        suggestions += `\n💡 **通用健康建议**\n`;
        suggestions += `- 保持规律的作息时间\n`;
        suggestions += `- 均衡饮食，适量运动\n`;
        suggestions += `- 定期监测相关健康指标\n`;
        suggestions += `- 如有不适，及时就医咨询\n`;
        
        if (precautions) {
            suggestions += `\n⚠️ **特别注意**\n`;
            suggestions += `- ${precautions}\n`;
        }
        
        suggestions += `\n💡 *提示：这是基于一般健康原则的建议。如需更个性化的建议，请启用AI功能或咨询专业医生。*`;
        
        return suggestions;
    }

    /**
     * 构建基于真实天气数据的提示词
     * @param {string} title - 标题
     * @param {string} description - 描述  
     * @param {string} precautions - 注意事项
     * @param {Object} weatherData - 真实天气数据
     * @param {Object} userLocation - 用户位置信息
     * @returns {string} 构建的提示词
     */
    buildWeatherBasedPrompt(title, description, precautions, weatherData, userLocation = null) {
        const now = new Date();
        const dateInfo = this.buildDetailedDateInfo(now);
        const locationInfo = this.buildDetailedLocationInfo(userLocation);

        this._logPromptBuildingInfo(dateInfo, locationInfo, weatherData);

        // 构建完整提示词
        return this._assemblePrompt(title, description, precautions, dateInfo, locationInfo, weatherData);
    }

    // 记录提示词构建信息
    _logPromptBuildingInfo(dateInfo, locationInfo, weatherData) {
        console.log('📅 构建的日期信息:', dateInfo);
        console.log('📍 构建的位置信息:', locationInfo);
        console.log('🌤️ 使用的天气数据:', weatherData);
    }

    // 组装完整提示词
    _assemblePrompt(title, description, precautions, dateInfo, locationInfo, weatherData) {
        let prompt = this._buildPromptHeader(title, description, precautions);
        prompt += this._buildTimeSection(dateInfo);
        prompt += this._buildLocationSection(locationInfo);
        prompt += this._buildWeatherSection(weatherData, locationInfo, dateInfo);
        prompt += this._buildAnalysisRequirements(dateInfo, locationInfo);
        prompt += this._buildDiseaseSpecificSection(title);
        prompt += this._buildRecommendationsSection();
        prompt += this._buildOutputFormat();
        
        return prompt;
    }

    // 构建提示词头部
    _buildPromptHeader(title, description, precautions) {
        let header = `【健康建议生成任务】基于真实天气数据的个性化健康建议

【用户健康信息】
健康状况：${title}`;

        if (description) {
            header += `\n详细描述：${description}`;
        }

        if (precautions) {
            header += `\n医嘱/注意事项：${precautions}`;
        }

        return header;
    }

    // 构建时间信息部分
    _buildTimeSection(dateInfo) {
        return `

【当前时间信息】
完整日期：${dateInfo.dateWithWeekday}
当前季节：${dateInfo.season}
时间段：${dateInfo.timeOfDay}`;
    }

    // 构建位置信息部分
    _buildLocationSection(locationInfo) {
        if (!locationInfo.hasLocation) return '';

        let section = `

【用户位置信息】
具体位置：${locationInfo.formattedLocation}`;
        
        if (locationInfo.climate) {
            section += `\n气候特征：${locationInfo.climate}`;
        }

        return section;
    }

    // 构建天气信息部分
    _buildWeatherSection(weatherData, locationInfo, dateInfo) {
        if (weatherData && !weatherData.isError) {
            return this._buildRealWeatherSection(weatherData);
        } else {
            return this._buildFallbackWeatherSection(locationInfo, dateInfo);
        }
    }

    // 构建真实天气数据部分
    _buildRealWeatherSection(weatherData) {
        const updateTime = weatherData.lastUpdated ? 
            new Date(weatherData.lastUpdated).toLocaleString('zh-CN') : '刚刚';

        return `

【实时天气数据】
位置：${weatherData.location || '当前位置'}
天气状况：${weatherData.condition}
温度：${weatherData.temperature}
湿度：${weatherData.humidity.value}
风力：${weatherData.wind.level}
数据更新时间：${updateTime}`;
    }

    // 构建备用天气信息部分
    _buildFallbackWeatherSection(locationInfo, dateInfo) {
        return `

【天气信息】
抱歉，当前无法获取准确的天气数据。请基于${locationInfo.climate || '当地气候'}和${dateInfo.season}季节特点给出通用建议。`;
    }

    // 构建分析要求部分
    _buildAnalysisRequirements(dateInfo, locationInfo) {
        return `

【个性化分析要求】
1. 🎯 **天气影响分析**
   - 结合当前天气状况分析对健康的具体影响
   - 考虑${dateInfo.season}季节和${dateInfo.timeOfDay}时段特点
   - 基于${locationInfo.climate || '当地气候'}特征评估风险

2. 📊 **疾病特定关注点**`;
    }

    // 构建疾病特定部分
    _buildDiseaseSpecificSection(title) {
        const diseaseTypes = this._identifyDiseaseType(title);
        let section = '';

        diseaseTypes.forEach(type => {
            section += this._getDiseaseSpecificAdvice(type);
        });

        return section;
    }

    // 识别疾病类型
    _identifyDiseaseType(title) {
        const types = [];
        
        if (this._isJointRelated(title)) types.push('joint');
        if (this._isRespiratoryRelated(title)) types.push('respiratory');
        if (this._isCardiovascularRelated(title)) types.push('cardiovascular');
        if (this._isSkinRelated(title)) types.push('skin');
        if (this._isDigestiveRelated(title)) types.push('digestive');
        
        return types.length > 0 ? types : ['general'];
    }

    // 疾病类型判断方法
    _isJointRelated(title) {
        return title.includes('关节') || title.includes('骨折') || title.includes('风湿');
    }

    _isRespiratoryRelated(title) {
        return title.includes('咳嗽') || title.includes('哮喘') || title.includes('肺') || title.includes('呼吸');
    }

    _isCardiovascularRelated(title) {
        return title.includes('心脏') || title.includes('血压') || title.includes('心血管');
    }

    _isSkinRelated(title) {
        return title.includes('皮肤') || title.includes('湿疹') || title.includes('过敏');
    }

    _isDigestiveRelated(title) {
        return title.includes('胃') || title.includes('肠') || title.includes('消化');
    }

    // 获取疾病特定建议
    _getDiseaseSpecificAdvice(type) {
        const adviceMap = {
            joint: `
   - 关节疾病：重点关注湿度、气压变化对关节的影响
   - 温度骤变可能加重疼痛，需要保暖措施`,
            respiratory: `
   - 呼吸系统：关注空气质量、湿度对呼吸道的影响
   - 温差变化可能诱发症状加重`,
            cardiovascular: `
   - 心血管系统：注意气温变化对血压、心率的影响
   - 极端天气可能增加心血管负担`,
            skin: `
   - 皮肤问题：关注湿度、紫外线对皮肤的影响
   - 干燥或潮湿环境可能加重症状`,
            digestive: `
   - 消化系统：注意温度变化对肠胃功能的影响
   - 季节变化可能影响食欲和消化`,
            general: `
   - 综合考虑天气对整体健康状况的影响`
        };

        return adviceMap[type] || adviceMap.general;
    }

    // 构建建议部分
    _buildRecommendationsSection() {
        return `

3. 💡 **具体建议内容**
   - 日常护理要点（结合天气条件）
   - 饮食调理建议（考虑季节特点）
   - 运动锻炼指导（适应天气状况）
   - 用药注意事项（如有相关）
   - 生活起居调整

4. ⚠️ **风险提醒**
   - 当前天气条件下需要特别注意的事项
   - 可能加重症状的环境因素
   - 紧急情况的识别和处理`;
    }

    // 构建输出格式部分
    _buildOutputFormat() {
        return `

【输出要求】
- 语言：简洁明了的中文
- 结构：分点列出，便于阅读
- 长度：200-400字
- 语气：专业但温和，避免过于医学化的术语
- 重点：实用性强，可操作性高的建议

请基于以上信息生成个性化的健康建议。`;
    }

    /**
     * 构建让AI获取真实天气的提示词（备用方法）
     * @param {string} title - 标题
     * @param {string} description - 描述  
     * @param {string} precautions - 注意事项
     * @param {Object} userLocation - 用户位置信息
     * @returns {string} 构建的提示词
     */
    buildRealWeatherPrompt(title, description, precautions, userLocation = null) {
        // 获取完整的日期和时间信息
        const now = new Date();
        const dateInfo = this.buildDetailedDateInfo(now);
        
        // 构建详细的位置信息
        const locationInfo = this.buildDetailedLocationInfo(userLocation);

        console.log('📅 构建的日期信息:', dateInfo);
        console.log('📍 构建的位置信息:', locationInfo);

        // 构建优化的提示词
        let prompt = `【健康建议生成任务】基于用户真实位置和时间的个性化健康建议

【用户健康信息】
健康状况：${title}`;

        if (description) {
            prompt += `\n详细描述：${description}`;
        }

        if (precautions) {
            prompt += `\n医嘱/注意事项：${precautions}`;
        }

        // 添加详细的时间信息
        prompt += `

【当前时间信息】
完整日期：${dateInfo.dateWithWeekday}
当前季节：${dateInfo.season}
时间段：${dateInfo.timeOfDay}`;

        // 添加详细的位置信息
        if (locationInfo.hasLocation) {
            prompt += `

【用户位置信息】
具体位置：${locationInfo.formattedLocation}`;
            
            if (locationInfo.climate) {
                prompt += `\n气候特征：${locationInfo.climate}`;
            }
            
            if (locationInfo.coordinates) {
                prompt += `\n精确坐标：纬度${locationInfo.coordinates.latitude}°，经度${locationInfo.coordinates.longitude}°`;
            }
        } else {
            prompt += `

【位置信息】${locationInfo.message}`;
        }

        prompt += `

【核心任务要求】
1. 🌤️ **获取实时天气数据**
   - 使用上述精确位置坐标获取当前实时天气
   - 包含：温度、湿度、天气状况、风力、气压、能见度等
   - 可使用Open-Meteo API或其他可靠天气服务

2. 📊 **天气数据格式要求**
   - 必须以此格式开头："【${dateInfo.fullDate} ${locationInfo.city || '当前位置'}天气实况】"
   - 然后详细列出：温度XX°C，湿度XX%，天气状况XXX，风力X级，等等

3. 🎯 **个性化分析要求**
   - 结合${dateInfo.season}季节特点分析天气影响
   - 考虑${dateInfo.timeOfDay}时段的特殊需求
   - 基于${locationInfo.climate || '当地气候'}特征给出建议

【健康建议重点】（根据疾病类型重点关注）
- 关节疾病：温湿度变化、气压变化、${dateInfo.season}季保暖防潮
- 外伤骨折：防水保护、活动限制、${dateInfo.timeOfDay}环境安全
- 心理疾病：天气对情绪影响、${dateInfo.season}季节性情绪调节
- 呼吸疾病：空气质量、温差变化、湿度影响
- 心血管疾病：气压变化、温度波动影响
- 皮肤疾病：湿度、紫外线、${dateInfo.season}季护理

【严格禁止】
❌ 编造虚假天气数据
❌ 使用模糊表述如"天气适宜"
❌ 忽略位置和时间信息
❌ 给出不具体的建议

【输出格式要求】
✅ 必须以实时天气数据开头
✅ 分点列出3-5个具体可行的建议
✅ 结合季节、时段、位置特点
✅ 语言自然流畅，专业但易懂
✅ 如无法获取天气数据，明确说明原因

请立即获取实时天气数据并生成个性化健康建议：`;

        return prompt;
    }

    /**
     * 构建详细的日期信息
     * @param {Date} date - 日期对象
     * @returns {Object} 详细的日期信息
     */
    buildDetailedDateInfo(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hour = date.getHours();
        
        // 获取星期
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const weekday = weekdays[date.getDay()];
        
        // 获取季节
        const season = this.getSeason(month);
        
        // 获取时段
        const timeOfDay = this.getTimeOfDay(hour);
        
        return {
            year,
            month,
            day,
            weekday,
            season,
            timeOfDay,
            fullDate: `${year}年${month}月${day}日`,
            dateWithWeekday: `${year}年${month}月${day}日 ${weekday}`
        };
    }

    /**
     * 构建详细的位置信息
     * @param {Object} userLocation - 用户位置信息
     * @returns {Object} 详细的位置信息
     */
    buildDetailedLocationInfo(userLocation) {
        if (!userLocation) {
            return {
                hasLocation: false,
                message: '未提供位置信息'
            };
        }

        const info = {
            hasLocation: true,
            coordinates: null,
            city: null,
            formattedLocation: '',
            climate: null
        };

        // 处理坐标信息
        if (userLocation.latitude && userLocation.longitude) {
            info.coordinates = {
                latitude: parseFloat(userLocation.latitude).toFixed(4),
                longitude: parseFloat(userLocation.longitude).toFixed(4)
            };
            
            // 推断气候区域
            info.climate = this.inferClimateZone(userLocation.latitude, userLocation.longitude);
        }

        // 处理城市信息
        if (userLocation.city) {
            info.city = userLocation.city;
        } else if (typeof userLocation === 'string') {
            info.city = userLocation;
        }

        // 构建格式化的位置描述
        if (info.coordinates && info.city) {
            info.formattedLocation = `${info.city}（纬度${info.coordinates.latitude}°，经度${info.coordinates.longitude}°）`;
        } else if (info.coordinates) {
            info.formattedLocation = `纬度${info.coordinates.latitude}°，经度${info.coordinates.longitude}°`;
        } else if (info.city) {
            info.formattedLocation = info.city;
        }

        return info;
    }

    /**
     * 根据月份获取季节
     * @param {number} month - 月份 (1-12)
     * @returns {string} 季节
     */
    getSeason(month) {
        if (month >= 3 && month <= 5) return '春季';
        if (month >= 6 && month <= 8) return '夏季';
        if (month >= 9 && month <= 11) return '秋季';
        return '冬季';
    }

    /**
     * 根据小时获取时段
     * @param {number} hour - 小时 (0-23)
     * @returns {string} 时段
     */
    getTimeOfDay(hour) {
        if (hour >= 6 && hour < 9) return '早晨';
        if (hour >= 9 && hour < 12) return '上午';
        if (hour >= 12 && hour < 14) return '中午';
        if (hour >= 14 && hour < 18) return '下午';
        if (hour >= 18 && hour < 22) return '晚上';
        return '深夜';
    }

    /**
     * 根据经纬度推断气候区域
     * @param {number} lat - 纬度
     * @param {number} lon - 经度
     * @returns {string} 气候特征
     */
    inferClimateZone(lat) {
        const latitude = parseFloat(lat);
        
        // 简单的气候区域推断
        if (Math.abs(latitude) <= 23.5) {
            return '热带气候';
        } else if (Math.abs(latitude) <= 40) {
            return '亚热带气候';
        } else if (Math.abs(latitude) <= 60) {
            return '温带气候';
        } else {
            return '寒带气候';
        }
    }

    /**
     * 测试AI服务连接
     * @returns {Promise<boolean>} 连接是否成功
     */
    async testConnection() {
        if (!this.isEnabled) {
            console.log('🧪 AI服务未启用，跳过连接测试');
            return false;
        }

        try {
            const result = await this.model.generateContent('测试连接，请回复"连接成功"');
            const response = await result.response;
            const text = response.text();

            console.log('🧪 AI服务连接测试成功:', text);
            return true;
        } catch (error) {
            console.error('❌ AI服务连接测试失败:', error);
            return false;
        }
    }
}

// 创建单例实例
const aiService = new AIService();

module.exports = aiService;