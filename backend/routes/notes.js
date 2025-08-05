// Notes路由 - 健康笔记API
const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const aiService = require('../services/aiService');
const fetch = require('node-fetch');

// 获取天气数据的函数
async function getCurrentWeather() {
    try {
        // 默认位置：上海
        const latitude = 31.2304;
        const longitude = 121.4737;
        
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
        
        console.log('🌤️ 正在获取天气数据...');
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`天气API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        const current = data.current;
        
        // 天气代码映射
        const weatherCodeMap = {
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
        };
        
        // 风力等级转换
        function convertWindSpeed(windSpeedKmh) {
            if (windSpeedKmh < 6) return '1级';
            if (windSpeedKmh < 12) return '2级';
            if (windSpeedKmh < 20) return '3级';
            if (windSpeedKmh < 29) return '4级';
            if (windSpeedKmh < 39) return '5级';
            if (windSpeedKmh < 50) return '6级';
            if (windSpeedKmh < 62) return '7级';
            return '8级及以上';
        }
        
        const weatherCode = current.weather_code;
        const weatherInfo = weatherCodeMap[weatherCode] || { condition: '未知', icon: '❓' };
        
        const weatherData = {
            location: '上海',
            icon: weatherInfo.icon,
            condition: weatherInfo.condition,
            temperature: Math.round(current.temperature_2m) + '°C',
            wind: {
                level: convertWindSpeed(current.wind_speed_10m),
                label: '风力'
            },
            humidity: {
                value: Math.round(current.relative_humidity_2m) + '%',
                label: '湿度'
            },
            lastUpdated: new Date().toISOString()
        };
        
        console.log('✅ 获取天气数据成功:', weatherData);
        return weatherData;
        
    } catch (error) {
        console.error('❌ 获取天气数据失败:', error);
        return null;
    }
}

// 获取用户的所有Notes
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const notes = await Note.findByUserId(userId);
        
        res.json({
            success: true,
            data: notes,
            message: '获取Notes列表成功'
        });
    } catch (error) {
        console.error('获取Notes列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取Notes列表失败',
            error: error.message
        });
    }
});

// 根据ID获取Note
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const note = await Note.findById(id);
        
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note不存在'
            });
        }

        res.json({
            success: true,
            data: note,
            message: '获取Note信息成功'
        });
    } catch (error) {
        console.error('获取Note信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取Note信息失败',
            error: error.message
        });
    }
});

// 创建新Note
router.post('/', async (req, res) => {
    try {
        const noteData = req.body;
        const note = await Note.create(noteData);
        
        res.status(201).json({
            success: true,
            data: note,
            message: '创建Note成功'
        });
    } catch (error) {
        console.error('创建Note失败:', error);
        
        if (error.message.includes('数据验证失败')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: '创建Note失败',
            error: error.message
        });
    }
});

// 更新Note信息
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const note = await Note.updateById(id, updateData);
        
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note不存在'
            });
        }

        res.json({
            success: true,
            data: note,
            message: '更新Note信息成功'
        });
    } catch (error) {
        console.error('更新Note信息失败:', error);
        
        if (error.message.includes('数据验证失败')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: '更新Note信息失败',
            error: error.message
        });
    }
});

// 删除Note
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const success = await Note.deleteById(id);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Note不存在'
            });
        }

        res.json({
            success: true,
            message: '删除Note成功'
        });
    } catch (error) {
        console.error('删除Note失败:', error);
        res.status(500).json({
            success: false,
            message: '删除Note失败',
            error: error.message
        });
    }
});

// 搜索Notes
router.get('/search/:term', async (req, res) => {
    try {
        const { term } = req.params;
        const { userId } = req.query;
        
        const notes = await Note.search(term, userId);
        
        res.json({
            success: true,
            data: notes,
            message: '搜索Notes成功'
        });
    } catch (error) {
        console.error('搜索Notes失败:', error);
        res.status(500).json({
            success: false,
            message: '搜索Notes失败',
            error: error.message
        });
    }
});

// AI建议生成
router.post('/:id/ai-suggestions', async (req, res) => {
    try {
        const { id } = req.params;
        
        const note = await Note.findById(id);
        
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note不存在'
            });
        }

        console.log(`🤖 开始为笔记 ${id} 生成AI今日建议...`);
        
        // 获取当前天气数据
        console.log('🌤️ 正在获取天气数据...');
        const weatherData = await getCurrentWeather();
        console.log('🌤️ 天气数据获取结果:', JSON.stringify(weatherData, null, 2));
        
        if (!weatherData) {
            console.error('❌ 警告：天气数据获取失败，AI建议可能不够准确');
        }
        
        // 使用AI服务生成建议，传入天气数据
        const aiSuggestions = await aiService.generateHealthSuggestions({
            title: note.title,
            description: note.description,
            precautions: note.precautions
        }, weatherData);

        // 更新笔记的AI建议
        const updatedNote = await Note.updateById(id, {
            ai_suggestions: aiSuggestions
        });

        res.json({
            success: true,
            data: {
                ai_suggestions: aiSuggestions,
                note: updatedNote,
                weather_data: weatherData
            },
            message: 'AI今日建议生成成功'
        });
    } catch (error) {
        console.error('生成AI建议失败:', error);
        res.status(500).json({
            success: false,
            message: '生成AI建议失败',
            error: error.message
        });
    }
});

module.exports = router;