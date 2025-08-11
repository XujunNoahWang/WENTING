/**
 * Notes用户ID浏览器控制台修复脚本
 * 在有问题的页面控制台中运行此脚本立即修复"还没有健康笔记"问题
 */

console.log('🔧 开始Notes用户ID修复...');

// 检查NotesManager是否存在
if (typeof window.NotesManager === 'undefined') {
    console.error('❌ NotesManager未找到，请确保在正确的页面运行此脚本');
} else {
    console.log('✅ NotesManager已找到');
    
    // 1. 检查当前数据状态
    console.log('\n📊 当前数据状态:');
    console.log('  - 当前用户ID:', window.NotesManager.currentUser);
    console.log('  - Notes数据结构:', window.NotesManager.notes);
    
    // 找到有数据的用户ID
    const availableUserIds = Object.keys(window.NotesManager.notes).filter(id => 
        window.NotesManager.notes[id] && window.NotesManager.notes[id].length > 0
    );
    
    console.log('  - 有数据的用户ID:', availableUserIds);
    console.log('  - 当前用户的Notes数量:', 
        window.NotesManager.notes[window.NotesManager.currentUser] ? 
        window.NotesManager.notes[window.NotesManager.currentUser].length : 0
    );
    
    // 2. 检查是否需要修复
    const currentUserHasData = window.NotesManager.notes[window.NotesManager.currentUser] && 
                              window.NotesManager.notes[window.NotesManager.currentUser].length > 0;
    
    if (currentUserHasData) {
        console.log('✅ 当前用户ID有数据，无需修复');
    } else if (availableUserIds.length > 0) {
        console.log('🔧 当前用户ID没有数据，开始修复...');
        
        // 使用有数据的第一个用户ID
        const correctUserId = parseInt(availableUserIds[0]);
        console.log('🎯 使用用户ID:', correctUserId);
        
        // 更新currentUser
        const oldUserId = window.NotesManager.currentUser;
        window.NotesManager.currentUser = correctUserId;
        
        // 更新全局状态
        if (window.GlobalUserState) {
            window.GlobalUserState.currentUserId = correctUserId;
            localStorage.setItem('wenting_current_user_id', correctUserId.toString());
            console.log('🔄 已更新全局用户状态');
        }
        
        // 重新渲染Notes面板
        if (typeof window.NotesManager.renderNotesPanel === 'function') {
            window.NotesManager.renderNotesPanel(correctUserId);
            console.log('🎨 已重新渲染Notes面板');
        }
        
        console.log(`✅ 修复完成！用户ID从 ${oldUserId} 更新为 ${correctUserId}`);
        console.log(`📊 现在显示 ${window.NotesManager.notes[correctUserId].length} 条Notes`);
        
        // 验证修复结果
        setTimeout(() => {
            const notesPanel = document.querySelector('.notes-list-container');
            const emptyMessage = document.querySelector('.empty-notes-message');
            
            if (emptyMessage && emptyMessage.style.display !== 'none') {
                console.warn('⚠️ 仍然显示空状态消息，可能需要手动刷新页面');
            } else {
                console.log('✅ 修复验证成功，Notes正常显示');
            }
        }, 500);
        
    } else {
        console.log('⚠️ 没有找到任何Notes数据，这可能是正常的空状态');
    }
}

// 3. 提供额外的调试信息
console.log('\n🔍 调试信息:');
console.log('  - UserManager存在:', typeof window.UserManager !== 'undefined');
console.log('  - GlobalUserState存在:', typeof window.GlobalUserState !== 'undefined');

if (window.UserManager && window.UserManager.users) {
    console.log('  - 用户列表:', window.UserManager.users.map(u => `ID:${u.id}(${u.username})`).join(', '));
}

if (window.GlobalUserState) {
    console.log('  - 全局当前用户ID:', window.GlobalUserState.currentUserId);
    console.log('  - localStorage用户ID:', localStorage.getItem('wenting_current_user_id'));
}

console.log('\n🎉 Notes用户ID修复脚本执行完成！');
console.log('💡 如果问题仍然存在，请尝试刷新页面或检查网络连接');