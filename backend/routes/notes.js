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
        
        // 同步到关联用户
        try {
            const DataSyncService = require('../services/dataSyncService');
            await DataSyncService.syncNotesOperation('create', note, note.user_id);
        } catch (syncError) {
            console.error('⚠️ Note同步失败，但创建成功:', syncError);
        }
        
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
        
        // 🔥 关键修复：触发Notes同步逻辑（和TODO保持一致）
        try {
            const DataSyncService = require('../services/dataSyncService');
            await DataSyncService.syncNotesOperation('update', {
                originalNoteId: id,
                updateData: note,
                title: note.title,
                original_title: note.title  // 添加original_title用于匹配
            }, note.user_id);
        } catch (syncError) {
            console.error('⚠️ Notes更新同步失败，但更新成功:', syncError);
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
        
        // 获取Note信息用于同步
        const note = await Note.findById(id);
        
        const success = await Note.deleteById(id);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Note不存在'
            });
        }
        
        // 🔥 关键修复：触发Notes删除同步逻辑（和TODO保持一致）
        if (note) {
            try {
                const DataSyncService = require('../services/dataSyncService');
                await DataSyncService.syncNotesOperation('delete', {
                    originalNoteId: id,
                    title: note.title
                }, note.user_id);
            } catch (syncError) {
                console.error('⚠️ Notes删除同步失败，但删除成功:', syncError);
            }
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

        console.log(`🤖 开始为笔记 ${id} 生成AI建议（使用真实天气数据）...`);
        
        // 获取用户位置信息和天气数据（从前端传递）
        const userLocation = req.body.userLocation || req.query.userLocation;
        const weatherData = req.body.weatherData || req.query.weatherData;
        
        console.log('📍 接收到的请求体:', JSON.stringify(req.body, null, 2));
        console.log('📍 接收到的查询参数:', JSON.stringify(req.query, null, 2));
        console.log('📍 解析出的用户位置信息:', userLocation);
        console.log('🌤️ 解析出的天气数据:', weatherData);
        
        // 使用真实天气数据生成AI建议
        const aiSuggestions = await aiService.generateHealthSuggestions({
            title: note.title,
            description: note.description,
            precautions: note.precautions
        }, weatherData, userLocation);

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
            message: 'AI建议生成成功（基于真实天气数据）'
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