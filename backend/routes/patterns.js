const express = require('express');
const router = express.Router();
const RepeatPattern = require('../models/RepeatPattern');

// 获取所有重复模式
router.get('/', async (req, res) => {
    try {
        const patterns = await RepeatPattern.findAll();
        res.json({
            success: true,
            data: patterns,
            message: '获取重复模式列表成功'
        });
    } catch (error) {
        console.error('获取重复模式列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取重复模式列表失败',
            error: error.message
        });
    }
});

// 获取预设重复模式
router.get('/presets', async (req, res) => {
    try {
        const presets = await RepeatPattern.getPresetPatterns();
        res.json({
            success: true,
            data: presets,
            message: '获取预设模式成功'
        });
    } catch (error) {
        console.error('获取预设模式失败:', error);
        res.status(500).json({
            success: false,
            message: '获取预设模式失败',
            error: error.message
        });
    }
});

// 根据ID获取重复模式
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pattern = await RepeatPattern.findById(id);
        
        if (!pattern) {
            return res.status(404).json({
                success: false,
                message: '重复模式不存在'
            });
        }

        res.json({
            success: true,
            data: pattern,
            message: '获取重复模式成功'
        });
    } catch (error) {
        console.error('获取重复模式失败:', error);
        res.status(500).json({
            success: false,
            message: '获取重复模式失败',
            error: error.message
        });
    }
});

// 创建新重复模式
router.post('/', async (req, res) => {
    try {
        const patternData = req.body;
        
        // 验证数据
        const validationErrors = RepeatPattern.validatePatternData(patternData);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: '数据验证失败',
                errors: validationErrors
            });
        }

        const pattern = await RepeatPattern.create(patternData);
        
        res.status(201).json({
            success: true,
            data: pattern,
            message: '创建重复模式成功'
        });
    } catch (error) {
        console.error('创建重复模式失败:', error);
        res.status(500).json({
            success: false,
            message: '创建重复模式失败',
            error: error.message
        });
    }
});

// 创建预设重复模式
router.post('/presets/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const pattern = await RepeatPattern.createPresetPattern(name);
        
        res.status(201).json({
            success: true,
            data: pattern,
            message: '创建预设模式成功'
        });
    } catch (error) {
        console.error('创建预设模式失败:', error);
        
        if (error.message.includes('未找到')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: '创建预设模式失败',
            error: error.message
        });
    }
});

// 检查日期是否匹配模式
router.post('/:id/check', async (req, res) => {
    try {
        const { id } = req.params;
        const { targetDate, startDate } = req.body;
        
        if (!targetDate || !startDate) {
            return res.status(400).json({
                success: false,
                message: '目标日期和开始日期不能为空'
            });
        }
        
        const pattern = await RepeatPattern.findById(id);
        if (!pattern) {
            return res.status(404).json({
                success: false,
                message: '重复模式不存在'
            });
        }
        
        const isMatch = RepeatPattern.isDateMatch(pattern, targetDate, startDate);
        
        res.json({
            success: true,
            data: { isMatch },
            message: '检查日期匹配成功'
        });
    } catch (error) {
        console.error('检查日期匹配失败:', error);
        res.status(500).json({
            success: false,
            message: '检查日期匹配失败',
            error: error.message
        });
    }
});

// 获取下一个匹配日期
router.post('/:id/next', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentDate, startDate } = req.body;
        
        if (!currentDate || !startDate) {
            return res.status(400).json({
                success: false,
                message: '当前日期和开始日期不能为空'
            });
        }
        
        const pattern = await RepeatPattern.findById(id);
        if (!pattern) {
            return res.status(404).json({
                success: false,
                message: '重复模式不存在'
            });
        }
        
        const nextDate = RepeatPattern.getNextMatchDate(pattern, currentDate, startDate);
        
        res.json({
            success: true,
            data: { nextDate },
            message: '获取下一个匹配日期成功'
        });
    } catch (error) {
        console.error('获取下一个匹配日期失败:', error);
        res.status(500).json({
            success: false,
            message: '获取下一个匹配日期失败',
            error: error.message
        });
    }
});

// 获取时间范围内的匹配日期
router.post('/:id/range', async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, rangeStart, rangeEnd } = req.body;
        
        if (!startDate || !rangeStart || !rangeEnd) {
            return res.status(400).json({
                success: false,
                message: '开始日期、范围开始和范围结束不能为空'
            });
        }
        
        const pattern = await RepeatPattern.findById(id);
        if (!pattern) {
            return res.status(404).json({
                success: false,
                message: '重复模式不存在'
            });
        }
        
        const matchDates = RepeatPattern.getMatchDatesInRange(pattern, startDate, rangeStart, rangeEnd);
        
        res.json({
            success: true,
            data: { matchDates },
            message: '获取范围内匹配日期成功'
        });
    } catch (error) {
        console.error('获取范围内匹配日期失败:', error);
        res.status(500).json({
            success: false,
            message: '获取范围内匹配日期失败',
            error: error.message
        });
    }
});

module.exports = router;