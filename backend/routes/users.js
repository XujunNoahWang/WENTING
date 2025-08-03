const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 获取所有用户
router.get('/', async (req, res) => {
    try {
        const users = await User.findAll();
        res.json({
            success: true,
            data: users,
            message: '获取用户列表成功'
        });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户列表失败',
            error: error.message
        });
    }
});

// 根据ID获取用户
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        res.json({
            success: true,
            data: user,
            message: '获取用户信息成功'
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户信息失败',
            error: error.message
        });
    }
});

// 创建新用户
router.post('/', async (req, res) => {
    try {
        const userData = req.body;
        
        // 验证数据
        const validationErrors = User.validateUserData(userData);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: '数据验证失败',
                errors: validationErrors
            });
        }

        const user = await User.create(userData);
        
        res.status(201).json({
            success: true,
            data: user,
            message: '创建用户成功'
        });
    } catch (error) {
        console.error('创建用户失败:', error);
        
        if (error.message.includes('已存在') || error.message.includes('已被使用')) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: '创建用户失败',
            error: error.message
        });
    }
});

// 更新用户信息
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // 验证数据
        const validationErrors = User.validateUserData(updateData, true);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: '数据验证失败',
                errors: validationErrors
            });
        }

        const user = await User.updateById(id, updateData);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        res.json({
            success: true,
            data: user,
            message: '更新用户信息成功'
        });
    } catch (error) {
        console.error('更新用户信息失败:', error);
        
        if (error.message.includes('已存在') || error.message.includes('已被使用')) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: '更新用户信息失败',
            error: error.message
        });
    }
});

// 删除用户
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await User.deleteById(id);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        res.json({
            success: true,
            message: '删除用户成功'
        });
    } catch (error) {
        console.error('删除用户失败:', error);
        res.status(500).json({
            success: false,
            message: '删除用户失败',
            error: error.message
        });
    }
});

// 获取用户设置
router.get('/:id/settings', async (req, res) => {
    try {
        const { id } = req.params;
        const settings = await User.getSettings(id);
        
        if (!settings) {
            return res.status(404).json({
                success: false,
                message: '用户设置不存在'
            });
        }

        res.json({
            success: true,
            data: settings,
            message: '获取用户设置成功'
        });
    } catch (error) {
        console.error('获取用户设置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户设置失败',
            error: error.message
        });
    }
});

// 更新用户设置
router.put('/:id/settings', async (req, res) => {
    try {
        const { id } = req.params;
        const settingsData = req.body;
        
        const settings = await User.updateSettings(id, settingsData);
        
        res.json({
            success: true,
            data: settings,
            message: '更新用户设置成功'
        });
    } catch (error) {
        console.error('更新用户设置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新用户设置失败',
            error: error.message
        });
    }
});

module.exports = router;