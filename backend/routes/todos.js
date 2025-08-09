// TODO路由 - 完全重写版本
const express = require('express');
const router = express.Router();
const Todo = require('../models/Todo');
const DataSyncService = require('../services/dataSyncService');
const DataAccessSecurity = require('../middleware/dataAccess');
const SecurityAudit = require('../middleware/securityAudit');

// 应用安全审计中间件到所有路由
router.use(SecurityAudit.logPermissionDenied);
router.use(SecurityAudit.logRateLimitExceeded);

// 获取用户的所有TODO
router.get('/user/:userId', 
    DataAccessSecurity.validateDataAccess,
    async (req, res) => {
    try {
        const { userId } = req.params;
        const todos = await Todo.findByUserId(userId);
        
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

// 获取用户指定日期的TODO
router.get('/user/:userId/date/:date', 
    DataAccessSecurity.validateDataAccess,
    async (req, res) => {
    try {
        const { userId, date } = req.params;
        const todos = await Todo.findByUserIdAndDate(userId, date);
        
        res.json({
            success: true,
            data: todos,
            message: '获取日期TODO成功'
        });
    } catch (error) {
        console.error('获取日期TODO失败:', error);
        res.status(500).json({
            success: false,
            message: '获取日期TODO失败',
            error: error.message
        });
    }
});

// 获取用户今日TODO
router.get('/user/:userId/today', 
    DataAccessSecurity.validateDataAccess,
    async (req, res) => {
    try {
        const { userId } = req.params;
        const today = new Date().toISOString().split('T')[0];
        const todos = await Todo.findByUserIdAndDate(userId, today);
        
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
router.get('/:id', 
    DataAccessSecurity.validateTodoAccess,
    async (req, res) => {
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
router.post('/', 
    DataAccessSecurity.validateCreateDataAccess,
    async (req, res) => {
    try {
        const todoData = req.body;
        const todo = await Todo.create(todoData);
        
        // 同步到关联用户
        try {
            await DataSyncService.syncTodoOperation('create', todo, todo.user_id);
        } catch (syncError) {
            console.error('⚠️  TODO同步失败，但创建成功:', syncError);
        }
        
        res.status(201).json({
            success: true,
            data: todo,
            message: '创建TODO成功'
        });
    } catch (error) {
        console.error('创建TODO失败:', error);
        
        if (error.message.includes('数据验证失败')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: '创建TODO失败',
            error: error.message
        });
    }
});

// 更新TODO信息
router.put('/:id', 
    DataAccessSecurity.validateTodoAccess,
    async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const todo = await Todo.updateById(id, updateData);
        
        if (!todo) {
            return res.status(404).json({
                success: false,
                message: 'TODO不存在'
            });
        }

        // 同步到关联用户
        try {
            await DataSyncService.syncTodoOperation('update', {
                originalTodoId: id,
                updateData: todo,
                title: todo.title
            }, todo.user_id);
        } catch (syncError) {
            console.error('⚠️  TODO更新同步失败:', syncError);
        }

        res.json({
            success: true,
            data: todo,
            message: '更新TODO信息成功'
        });
    } catch (error) {
        console.error('更新TODO信息失败:', error);
        
        if (error.message.includes('数据验证失败')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: '更新TODO信息失败',
            error: error.message
        });
    }
});

// 删除TODO
router.delete('/:id', 
    DataAccessSecurity.validateTodoAccess,
    async (req, res) => {
    try {
        const { id } = req.params;
        const { deletion_type = 'all', deletion_date } = req.body;
        
        // 获取TODO信息用于同步
        const todo = await Todo.findById(id);
        
        const success = await Todo.deleteById(id, deletion_type, deletion_date);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'TODO不存在'
            });
        }

        // 同步到关联用户
        if (todo) {
            try {
                await DataSyncService.syncTodoOperation('delete', {
                    originalTodoId: id,
                    deletionType: deletion_type,
                    deletionDate: deletion_date,
                    title: todo.title
                }, todo.user_id);
            } catch (syncError) {
                console.error('⚠️  TODO删除同步失败:', syncError);
            }
        }

        let message = '删除TODO成功';
        switch (deletion_type) {
            case 'single':
                message = '删除单个TODO实例成功';
                break;
            case 'from_date':
                message = '删除从指定日期开始的TODO实例成功';
                break;
            case 'all':
            default:
                message = '删除整个TODO成功';
                break;
        }

        res.json({
            success: true,
            message: message
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
router.post('/:id/complete', 
    DataAccessSecurity.validateTodoAccess,
    async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, date, notes = '' } = req.body;
        
        if (!user_id || !date) {
            return res.status(400).json({
                success: false,
                message: '用户ID和日期不能为空'
            });
        }

        // 获取TODO信息用于同步
        const todo = await Todo.findById(id);

        await Todo.markCompleted(id, user_id, date, notes);
        
        // 同步到关联用户
        if (todo) {
            try {
                await DataSyncService.syncTodoOperation('complete', {
                    originalTodoId: id,
                    date: date,
                    notes: notes,
                    title: todo.title
                }, user_id);
            } catch (syncError) {
                console.error('⚠️  TODO完成同步失败:', syncError);
            }
        }
        
        res.json({
            success: true,
            message: 'TODO完成成功'
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
router.post('/:id/uncomplete', 
    DataAccessSecurity.validateTodoAccess,
    async (req, res) => {
    try {
        const { id } = req.params;
        const { date, user_id } = req.body;
        
        if (!date) {
            return res.status(400).json({
                success: false,
                message: '日期不能为空'
            });
        }

        // 获取TODO信息用于同步
        const todo = await Todo.findById(id);

        const success = await Todo.markUncompleted(id, date);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: '未找到完成记录'
            });
        }

        // 同步到关联用户
        if (todo && user_id) {
            try {
                await DataSyncService.syncTodoOperation('uncomplete', {
                    originalTodoId: id,
                    date: date,
                    title: todo.title
                }, user_id);
            } catch (syncError) {
                console.error('⚠️  TODO取消完成同步失败:', syncError);
            }
        }

        res.json({
            success: true,
            message: '取消完成成功'
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

module.exports = router;