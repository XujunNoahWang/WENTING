/**
 * Notes删除问题立即修复脚本
 * 在浏览器控制台运行此脚本立即修复删除Notes后显示空状态的问题
 */

console.log('🔧 开始Notes删除问题立即修复...');

// 检查NotesManager是否存在
if (typeof window.NotesManager === 'undefined') {
    console.error('❌ NotesManager未找到，请确保在正确的页面运行此脚本');
} else {
    console.log('✅ NotesManager已找到');
    
    // 1. 检查当前数据状态
    console.log('\n📊 当前数据状态:');
    console.log('  - 当前用户ID:', window.NotesManager.currentUser);
    console.log('  - Notes数据结构:', window.NotesManager.notes);
    
    // 计算每个用户的Notes数量
    const userNotesCount = {};
    Object.keys(window.NotesManager.notes).forEach(userId => {
        const notes = window.NotesManager.notes[userId];
        userNotesCount[userId] = notes ? notes.length : 0;
        console.log(`  - 用户ID ${userId}: ${userNotesCount[userId]} 条Notes`);
    });
    
    // 2. 检查当前用户是否有数据
    const currentUserHasData = window.NotesManager.notes[window.NotesManager.currentUser] && 
                              window.NotesManager.notes[window.NotesManager.currentUser].length > 0;
    
    console.log(`\n🔍 当前用户ID ${window.NotesManager.currentUser} 有数据:`, currentUserHasData);
    
    if (currentUserHasData) {
        console.log('✅ 当前用户有数据，无需修复');
    } else {
        console.log('🔧 当前用户没有数据，开始修复...');
        
        // 3. 查找有数据的用户
        const usersWithNotes = Object.keys(window.NotesManager.notes)
            .filter(userId => window.NotesManager.notes[userId] && window.NotesManager.notes[userId].length > 0)
            .map(userId => parseInt(userId))
            .sort((a, b) => a - b); // 按ID排序
        
        console.log('📊 有数据的用户ID:', usersWithNotes);
        
        if (usersWithNotes.length > 0) {
            const correctUserId = usersWithNotes[0];
            console.log(`🎯 切换到用户ID: ${correctUserId}`);
            
            // 4. 更新currentUser
            const oldUserId = window.NotesManager.currentUser;
            window.NotesManager.currentUser = correctUserId;
            
            // 5. 更新全局状态
            if (window.GlobalUserState) {
                window.GlobalUserState.currentUserId = correctUserId;
                localStorage.setItem('wenting_current_user_id', correctUserId.toString());
                console.log('🔄 已更新全局用户状态');
            }
            
            // 6. 重新渲染Notes面板
            if (typeof window.NotesManager.renderNotesPanel === 'function') {
                window.NotesManager.renderNotesPanel(correctUserId);
                console.log('🎨 已重新渲染Notes面板');
            }
            
            console.log(`✅ 修复完成！用户ID从 ${oldUserId} 更新为 ${correctUserId}`);
            console.log(`📊 现在显示 ${window.NotesManager.notes[correctUserId].length} 条Notes`);
            
            // 7. 验证修复结果
            setTimeout(() => {
                const emptyStateElement = document.querySelector('.notes-empty-state');
                const notesContainer = document.querySelector('.notes-container');
                
                if (emptyStateElement && emptyStateElement.style.display !== 'none') {
                    console.warn('⚠️ 仍然显示空状态，可能需要手动刷新页面');
                } else if (notesContainer) {
                    const noteCards = notesContainer.querySelectorAll('.note-card');
                    console.log(`✅ 修复验证成功，显示 ${noteCards.length} 个Notes卡片`);
                } else {
                    console.log('🔍 无法验证修复结果，请检查页面元素');
                }
            }, 500);
            
        } else {
            console.log('⚠️ 没有找到任何Notes数据');
            console.log('   这可能是正常的空状态，或者数据还未加载完成');
            
            // 尝试重新加载数据
            if (typeof window.NotesManager.loadNotesFromAPI === 'function') {
                console.log('🔄 尝试重新加载Notes数据...');
                window.NotesManager.loadNotesFromAPI(true, window.NotesManager.currentUser)
                    .then(() => {
                        console.log('✅ 数据重新加载完成');
                        
                        // 重新检查数据
                        const hasDataNow = Object.keys(window.NotesManager.notes).some(userId => 
                            window.NotesManager.notes[userId] && window.NotesManager.notes[userId].length > 0
                        );
                        
                        if (hasDataNow) {
                            console.log('🎉 重新加载后发现数据，请重新运行此脚本');
                        } else {
                            console.log('📝 确认没有Notes数据，显示空状态是正常的');
                        }
                    })
                    .catch(error => {
                        console.error('❌ 重新加载数据失败:', error);
                    });
            }
        }
    }
}

// 8. 提供额外的调试信息
console.log('\n🔍 调试信息:');
console.log('  - UserManager存在:', typeof window.UserManager !== 'undefined');
console.log('  - GlobalUserState存在:', typeof window.GlobalUserState !== 'undefined');

if (window.UserManager && window.UserManager.users) {
    console.log('  - 用户列表:', window.UserManager.users.map(u => `ID:${u.id}(${u.username})`).join(', '));
}

if (window.GlobalUserState) {
    console.log('  - 全局当前用户ID:', window.GlobalUserState.currentUserId);
    console.log('  - localStorage用户ID:', localStorage.getItem('wenting_current_user_id'));
    console.log('  - 当前模块:', window.GlobalUserState.getCurrentModule ? window.GlobalUserState.getCurrentModule() : 'unknown');
}

console.log('\n🎉 Notes删除问题修复脚本执行完成！');
console.log('💡 如果问题仍然存在，请尝试:');
console.log('   1. 刷新页面');
console.log('   2. 检查网络连接');
console.log('   3. 查看浏览器控制台是否有其他错误');