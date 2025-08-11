// 前端WebSocket修复脚本
// 在浏览器控制台中运行此脚本来修复WebSocket连接问题

console.log('🔧 开始修复WebSocket连接...');

// 1. 检查当前用户身份设置
console.log('1️⃣ 检查用户身份设置...');
const currentAppUser = localStorage.getItem('wenting_current_app_user');
const currentUser = localStorage.getItem('wenting_current_user');

console.log('当前用户身份:', {
    'wenting_current_app_user': currentAppUser,
    'wenting_current_user': currentUser
});

if (!currentAppUser) {
    console.error('❌ 缺少app用户身份，请先登录');
    console.log('💡 如果您是blackblade用户，请运行:');
    console.log('   localStorage.setItem("wenting_current_app_user", "blackblade");');
    console.log('   localStorage.setItem("wenting_current_user", "20");');
    console.log('💡 如果您是whiteblade用户，请运行:');
    console.log('   localStorage.setItem("wenting_current_app_user", "whiteblade");');
    console.log('   localStorage.setItem("wenting_current_user", "21");');
} else {
    console.log(`✅ 用户身份: ${currentAppUser}`);
}

// 2. 检查WebSocket客户端状态
console.log('\n2️⃣ 检查WebSocket客户端状态...');
if (window.WebSocketClient) {
    console.log('WebSocket客户端状态:', {
        isConnected: window.WebSocketClient.isConnected,
        wsReadyState: window.WebSocketClient.ws ? window.WebSocketClient.ws.readyState : 'null'
    });
    
    // 3. 强制重新连接WebSocket
    console.log('\n3️⃣ 强制重新连接WebSocket...');
    
    // 断开现有连接
    if (window.WebSocketClient.ws) {
        window.WebSocketClient.ws.close();
        console.log('🔌 已断开现有WebSocket连接');
    }
    
    // 重新初始化
    setTimeout(() => {
        console.log('🔄 正在重新连接WebSocket...');
        window.WebSocketClient.init().then(() => {
            console.log('✅ WebSocket重新连接成功');
            
            // 4. 测试连接状态
            setTimeout(() => {
                console.log('\n4️⃣ 测试连接状态...');
                console.log('最终WebSocket状态:', {
                    isConnected: window.WebSocketClient.isConnected,
                    wsReadyState: window.WebSocketClient.ws ? window.WebSocketClient.ws.readyState : 'null'
                });
                
                if (window.WebSocketClient.isConnected) {
                    console.log('🎉 WebSocket连接修复成功！');
                    console.log('💡 现在您应该能够看到实时的Notes同步更新了');
                } else {
                    console.error('❌ WebSocket连接修复失败');
                    console.log('💡 请尝试刷新页面或联系技术支持');
                }
            }, 2000);
            
        }).catch(error => {
            console.error('❌ WebSocket重新连接失败:', error);
            console.log('💡 请检查网络连接或刷新页面重试');
        });
    }, 1000);
    
} else {
    console.error('❌ WebSocketClient未找到');
    console.log('💡 请确保页面已完全加载，然后刷新页面重试');
}

// 5. 提供手动设置用户身份的函数
window.setUserIdentity = function(appUserId, userId) {
    localStorage.setItem('wenting_current_app_user', appUserId);
    localStorage.setItem('wenting_current_user', userId.toString());
    console.log(`✅ 用户身份已设置为: ${appUserId} (ID: ${userId})`);
    console.log('💡 请运行 location.reload() 刷新页面以应用更改');
};

// 6. 提供强制刷新Notes的函数
window.forceRefreshNotes = function() {
    if (window.NotesManager) {
        console.log('🔄 强制刷新Notes数据...');
        window.NotesManager.loadNotesFromAPI(true, window.NotesManager.currentUser).then(() => {
            console.log('✅ Notes数据刷新完成');
        }).catch(error => {
            console.error('❌ Notes数据刷新失败:', error);
        });
    } else {
        console.error('❌ NotesManager未找到');
    }
};

console.log('\n📋 可用的修复函数:');
console.log('   setUserIdentity("blackblade", 20) - 设置为blackblade用户');
console.log('   setUserIdentity("whiteblade", 21) - 设置为whiteblade用户');
console.log('   forceRefreshNotes() - 强制刷新Notes数据');
console.log('   location.reload() - 刷新页面');

console.log('\n🔧 WebSocket修复脚本执行完成');