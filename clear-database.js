// 临时脚本：清除Firebase数据库数据
const { firebaseWebAuthService } = require('./src/config/firebase-web');

async function clearDatabase() {
  console.log('🗑️ 开始清除Firebase数据库数据...');
  
  try {
    // 初始化Firebase服务
    await firebaseWebAuthService.initialize();
    
    // 清除所有数据
    const result = await firebaseWebAuthService.clearAllData();
    
    if (result.success) {
      console.log('✅ 数据库清除成功！');
      console.log('📊 清除统计：');
      console.log('   - 健康记录：已清除');
      console.log('   - 家庭成员：已清除');
      console.log('   - 家庭数据：已清除');
      console.log('   - 用户文档：已清除');
    } else {
      console.error('❌ 数据库清除失败：', result.error);
    }
  } catch (error) {
    console.error('❌ 清除过程中发生错误：', error);
  }
  
  // 清除本地存储
  console.log('🧹 清除本地存储缓存...');
  if (typeof localStorage !== 'undefined') {
    // 清除所有wenting相关的本地存储
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wenting_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`   - 已清除：${key}`);
    });
    
    console.log('✅ 本地存储清除完成！');
  }
  
  console.log('🎉 数据库和缓存清除完成！可以重新开始测试了。');
}

// 如果直接运行此脚本
if (require.main === module) {
  clearDatabase().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('脚本执行失败：', error);
    process.exit(1);
  });
}

module.exports = { clearDatabase };