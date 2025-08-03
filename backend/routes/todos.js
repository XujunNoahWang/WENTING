const express = require('express');
const router = express.Router();
const Todo = require('../models/Todo');
const RepeatPattern = require('../models/RepeatPattern');

// 获取用户的TODO列表
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { date, category, priority, completed, limit, offset } = req.query;
        
        const options = {
            date: date || null,
            category: category || null,
            priority: priority || null,
            completed: completed !== undefined ? completed === 'true' : null,
            limit: limit ? parseInt(limit) : null,
            offset: offset ? parseInt(offset) : 0
        };
        
        const todos = await Todo.findByUserId(userId, options);
        
        res.json({
            success: true,
            data: todos,
            message: '获取TODO列表成功'
        });
    } catch (error) {
        console.error('获取TODO列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取TODO列表失败',
            error: error.message
        });
    }
});

// 获取用户今日TODO
router.get('/user/:userId/today', async (req, res) => {
    try {
        const { userId } = req.params;
        const { date } = req.query;
        
        const todos = await Todo.getTodayTodos(userId, date);
        
        res.json({
            success: true,
            data: todos,
            message: '获取今日TODO成功'
        });
    } catch (error) {
        console.error('获取今日TODO失败:', error);
        res.status(500).json({
            success: false,
            message: '获取今日TODO失败',
            error: error.message
        });
    }
});

// 根据ID获取TODO
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const todo = await Todo.findById(id);
        
        if (!todo) {
            return res.status(404).json({
                success: false,
                message: 'TODO不存在'
            });
        }

        res.json({
            success: true,
            data: todo,
            message: '获取TODO信息成功'
        });
    } catch (error) {
        console.error('获取TODO信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取TODO信息失败',
            error: error.message
        });
    }
});

// 创建新TODO
router.post('/', async (req, res) => {
    try {
        const todoData = req.body;
        
        // 验证数据
        const validationErrors = Todo.validateTodoData(todoData);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: '数据验证失败',
                errors: validationErrors
            });
        }

        // 如果需要创建重复模式
        if (todoData.repeat_pattern && !todoData.repeat_pattern_id) {
            const patternErrors = RepeatPattern.validatePatternData(todoData.repeat_pattern);
            if (patternErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: '重复模式验证失败',
                    errors: patternErrors
                });
            }
            
            const pattern = await RepeatPattern.create(todoData.repeat_pattern);
            todoData.repeat_pattern_id = pattern.id;
        }

        const todo = await Todo.create(todoData);
        
        res.status(201).json({
            success: true,
            data: todo,
            message: '创建TODO成功'
        });
    } catch (error) {
        console.error('创建TODO失败:', error);
        res.status(500).json({
            success: false,
            message: '创建TODO失败',
            error: error.message
        });
    }
});

// 更新TODO
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // 验证数据
        const validationErrors = Todo.validateTodoData(updateData, true);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: '数据验证失败',
                errors: validationErrors
            });
        }

        const todo = await Todo.updateById(id, updateData);
        
        if (!todo) {
            return res.status(404).json({
                success: false,
                message: 'TODO不存在'
            });
        }

        res.json({
            success: true,
            data: todo,
            message: '更新TODO成功'
        });
    } catch (error) {
        console.error('更新TODO失败:', error);
        res.status(500).json({
            success: false,
            message: '更新TODO失败',
            error: error.message
        });
    }
});

// 删除TODO
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await Todo.deleteById(id);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'TODO不存在'
            });
        }

        res.json({
            success: true,
            message: '删除TODO成功'
        });
    } catch (error) {
        console.error('删除TODO失败:', error);
        res.status(500).json({
            success: false,
            message: '删除TODO失败',
            error: error.message
        });
    }
});

// 完成TODO
router.post('/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, date, notes, mood } = req.body;
        
        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: '用户ID不能为空'
            });
        }
        
        await Todo.completeTodo(id, user_id, date, notes, mood);
        
        res.json({
            success: true,
            message: '完成TODO成功'
        });
    } catch (error) {
        console.error('完成TODO失败:', error);
        res.status(500).json({
            success: false,
            message: '完成TODO失败',
            error: error.message
        });
    }
});

// 取消完成TODO
router.post('/:id/uncomplete', async (req, res) => {
    try {
        const { id } = req.params;
        const { date } = req.body;
        
        const success = await Todo.uncompleteTodo(id, date);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: '完成记录不存在'
            });
        }

        res.json({
            success: true,
            message: '取消完成TODO成功'
        });
    } catch (error) {
        console.error('取消完成TODO失败:', error);
        res.status(500).json({
            success: false,
            message: '取消完成TODO失败',
            error: error.message
        });
    }
});

// 批量更新排序
router.put('/batch/sort', async (req, res) => {
    try {
        const { todoOrders } = req.body;
        
        if (!Array.isArray(todoOrders)) {
            return res.status(400).json({
                success: false,
                message: 'todoOrders必须是数组'
            });
        }
        
        await Todo.updateSortOrder(todoOrders);
        
        res.json({
            success: true,
            message: '更新排序成功'
        });
    } catch (error) {
        console.error('更新排序失败:', error);
        res.status(500).json({
            success: false,
            message: '更新排序失败',
            error: error.message
        });
    }
});

// 获取用户完成统计
router.get('/user/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.query;
        
        const stats = await Todo.getCompletionStats(userId, startDate, endDate);
        
        res.json({
            success: true,
            data: stats,
            message: '获取统计数据成功'
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计数据失败',
            error: error.message
        });
    }
});

module.exports = router;