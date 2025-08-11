// 调试WebSocket注册问题的脚本
const { query } = require('../config/sqlite');

async function debugWebSocketRegistration() {
    try {
        console.log('=== 调试WebSocket注册问题 ===');
        
        console.log('🔍 步骤1: 检查数据库中的用户信息...');
        
        // 检查app_users表
        const appUsers = await query('SELECT username FROM app_users');
        console.log('注册用户:', appUsers.map(u => u.username));
        
        // 检查users表
        const users = await query('SELECT id, app_user_id, username, display_name FROM users WHERE is_active = 1');
        console.log('\n被添加用户:');
        users.forEach(u => console.log(`  - ID:${u.id}, App用户:${u.app_user_id}, 用户名:${u.username}, 显示名:${u.display_name}`));
        
        console.log('\n🔍 步骤2: 模拟前端WebSocket注册消息...');
        
        // 模拟blackblade用户的注册信息
        const blackbladeRegistration = {
            deviceId: 'test_device_blackblade',
            userId: users.find(u => u.app_user_id === 'blackblade')?.id || null,
            appUserId: 'blackblade'
        };
        
        console.log('blackblade注册信息:', blackbladeRegistration);
        
        // 模拟whiteblade用户的注册信息
        const whitebladeRegistration = {
            deviceId: 'test_device_whiteblade', 
            userId: users.find(u => u.app_user_id === 'whiteblade')?.id || null,
            appUserId: 'whiteblade'
        };
        
        console.log('whiteblade注册信息:', whitebladeRegistration);
        
        console.log('\n🔍 步骤3: 检查注册信息的完整性...');
        
        function validateRegistration(name, reg) {
            console.log(`\n${name}注册验证:`);
            console.log(`  - deviceId: ${reg.deviceId} ${reg.deviceId ? '✅' : '❌'}`);
            console.log(`  - userId: ${reg.userId} ${reg.userId ? '✅' : '❌'}`);
            console.log(`  - appUserId: ${reg.appUserId} ${reg.appUserId ? '✅' : '❌'}`);
            
            const isValid = reg.deviceId && reg.appUserId;
            console.log(`  - 整体有效性: ${isValid ? '✅' : '❌'}`);
            
            if (!isValid) {
                console.log(`  ⚠️ ${name}的WebSocket注册会失败！`);
                if (!reg.deviceId) console.log('    - 缺少deviceId');
                if (!reg.appUserId) console.log('    - 缺少appUserId');
            }
            
            return isValid;
        }
        
        const blackbladeValid = validateRegistration('blackblade', blackbladeRegistration);
        const whitebladeValid = validateRegistration('whiteblade', whitebladeRegistration);
        
        console.log('\n🔍 步骤4: 分析可能的问题...');
        
        if (!blackbladeValid || !whitebladeValid) {
            console.log('\n❌ 发现WebSocket注册问题:');
            
            if (!blackbladeRegistration.userId || !whitebladeRegistration.userId) {
                console.log('  1. userId为null - 可能原因:');
                console.log('     - 前端GlobalUserState.getCurrentUser()返回null');
                console.log('     - 用户没有正确登录或选择用户');
                console.log('     - localStorage中的wenting_current_user_id丢失');
            }
            
            if (!blackbladeRegistration.appUserId || !whitebladeRegistration.appUserId) {
                console.log('  2. appUserId为null - 可能原因:');
                console.log('     - 前端GlobalUserState.getAppUserId()返回null');
                console.log('     - localStorage中的wenting_current_app_user丢失');
                console.log('     - 用户没有正确登录');
            }
            
            console.log('\n🔧 建议的修复步骤:');
            console.log('  1. 检查前端localStorage是否正确设置:');
            console.log('     - wenting_current_app_user (应该是blackblade或whiteblade)');
            console.log('     - wenting_current_user_id (应该是被添加用户的ID)');
            console.log('  2. 检查前端GlobalUserState的方法是否正确返回值');
            console.log('  3. 检查前端DeviceManager是否正确生成deviceId');
            console.log('  4. 在浏览器控制台检查WebSocket注册消息的发送');
        } else {
            console.log('\n✅ WebSocket注册信息看起来正常');
            console.log('   问题可能在于:');
            console.log('   1. WebSocket连接本身失败');
            console.log('   2. 前端没有正确发送注册消息');
            console.log('   3. 后端WebSocket服务没有正确处理注册消息');
        }
        
        console.log('\n🔍 步骤5: 提供调试建议...');
        console.log('\n在浏览器控制台中检查以下内容:');
        console.log('1. localStorage.getItem("wenting_current_app_user")');
        console.log('2. localStorage.getItem("wenting_current_user_id")');
        console.log('3. window.DeviceManager?.getCurrentDeviceId()');
        console.log('4. window.GlobalUserState?.getAppUserId()');
        console.log('5. window.GlobalUserState?.getCurrentUser()');
        console.log('6. WebSocketClient.isConnected');
        console.log('7. 查看Network标签中是否有WebSocket连接');
        console.log('8. 查看Console中是否有WebSocket相关的错误或日志');
        
        console.log('\n✅ WebSocket注册调试完成');
        
    } catch (error) {
        console.error('❌ WebSocket注册调试失败:', error);
    }
}

debugWebSocketRegistration().then(() => process.exit(0)).catch(console.error);