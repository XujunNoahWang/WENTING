// Notes路由 - 健康笔记API
const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const aiService = require('../services/aiService');

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

        console.log(`🤖 开始为笔记 ${id} 生成AI建议（完全依赖AI获取真实天气）...`);
        
        // 获取用户位置信息（从前端传递）
        const userLocation = req.body.userLocation || req.query.userLocation;
        console.log('📍 接收到的请求体:', JSON.stringify(req.body, null, 2));
        console.log('📍 接收到的查询参数:', JSON.stringify(req.query, null, 2));
        console.log('📍 解析出的用户位置信息:', userLocation);
        
        // 完全依赖AI获取真实天气数据，不使用任何本地天气API
        const aiSuggestions = await aiService.generateHealthSuggestions({
            title: note.title,
            description: note.description,
            precautions: note.precautions
        }, userLocation);

        // 更新笔记的AI建议
        const updatedNote = await Note.updateById(id, {
            ai_suggestions: aiSuggestions
        });

        res.json({
            success: true,
            data: {
                ai_suggestions: aiSuggestions,
                note: updatedNote
            },
            message: 'AI建议生成成功（AI自获取真实天气）'
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