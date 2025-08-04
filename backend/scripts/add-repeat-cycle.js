// 添加重复周期功能的数据库更新脚本
const { query, testConnection } = require('../config/sqlite');

async function addRepeatCycle() {
    try {
        console.log('🔄 开始添加重复周期功能...');
        
        // 测试连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        
        // 添加重复周期相关字段
        try {
            await query('ALTER TABLE todos ADD COLUMN cycle_type TEXT DEFAULT "long_term" CHECK(cycle_type IN ("long_term", "custom"))');
            console.log('✅ 添加cycle_type字段成功');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('📝 cycle_type字段已存在，跳过');
            } else {
                throw error;
            }
        }
        
        try {
            await query('ALTER TABLE todos ADD COLUMN cycle_duration INTEGER DEFAULT NULL');
            console.log('✅ 添加cycle_duration字段成功');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('📝 cycle_duration字段已存在，跳过');
            } else {
                throw error;
            }
        }
        
        try {
            await query('ALTER TABLE todos ADD COLUMN cycle_unit TEXT DEFAULT "days" CHECK(cycle_unit IN ("days", "weeks", "months"))');
            console.log('✅ 添加cycle_unit字段成功');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('📝 cycle_unit字段已存在，跳过');
            } else {
                throw error;
            }
        }
        
        console.log('🎉 重复周期功能添加完成！');
        
    } catch (error) {
        console.error('❌ 添加重复周期功能失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    addRepeatCycle().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { addRepeatCycle };