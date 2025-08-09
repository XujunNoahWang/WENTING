const { query } = require('./config/database');

(async () => {
  try {
    console.log('=== 检查数据库结构和设备ID ===');
    
    // 检查app_users表结构
    const appUsersSchema = await query("PRAGMA table_info(app_users)");
    console.log('\n📋 app_users 表结构:', appUsersSchema);
    if (Array.isArray(appUsersSchema)) {
      appUsersSchema.forEach(col => {
        console.log(`  - ${col.name}: ${col.type}`);
      });
    }
    
    // 检查app_users表数据
    const appUsers = await query('SELECT * FROM app_users ORDER BY created_at DESC');
    console.log('\n📋 app_users 表数据:');
    appUsers.forEach(user => {
      console.log(`  - 用户: ${user.username}, 创建时间: ${user.created_at}`);
    });
    
    // 检查users表结构
    const usersSchema = await query("PRAGMA table_info(users)");
    console.log('\n👥 users 表结构:', usersSchema);
    if (Array.isArray(usersSchema)) {
      usersSchema.forEach(col => {
        console.log(`  - ${col.name}: ${col.type}`);
      });
    }
    
    // 检查users表数据
    const users = await query('SELECT app_user_id, username, device_id FROM users WHERE is_active = TRUE ORDER BY created_at DESC');
    console.log('\n👥 users 表数据:');
    users.forEach(user => {
      console.log(`  - 注册用户: ${user.app_user_id}, 被管理用户: ${user.username}, 设备ID: ${user.device_id}`);
    });
    
    // 检查所有设备ID
    const distinctDeviceIds = [...new Set(users.map(u => u.device_id))];
    console.log('\n🆔 数据库中的所有设备ID:');
    distinctDeviceIds.forEach(id => console.log(`  - ${id}`));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库查询失败:', error);
    process.exit(1);
  }
})();