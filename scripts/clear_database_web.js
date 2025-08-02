#!/usr/bin/env node
/**
 * Web版数据库清空脚本
 * 使用Firebase Web SDK清空数据库
 * 
 * 使用方法:
 * 1. npm install firebase
 * 2. node clear_database_web.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');
const readline = require('readline');

// Firebase配置 (与你的应用相同)
const firebaseConfig = {
  apiKey: "AIzaSyBQHUptHEKoJiu5XCA9ZGmmGuYkdGi7Ubk",
  authDomain: "wenting-health-app.firebaseapp.com",
  projectId: "wenting-health-app",
  storageBucket: "wenting-health-app.firebasestorage.app",
  messagingSenderId: "879987592871",
  appId: "1:879987592871:web:fd14b280de87c9769ad582",
  measurementId: "G-B3FPN0HZH2"
};

// 需要清空的集合
const COLLECTIONS_TO_CLEAR = [
  'users',
  'households', 
  'household_members',
  'health_records',
  'user_profiles',
  'invitations',
  'notifications'
];

// 初始化Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * 删除集合中的所有文档
 */
async function clearCollection(collectionName) {
  try {
    console.log(`\n📁 正在清空集合: ${collectionName}`);
    
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log(`  ℹ️  集合 '${collectionName}' 为空`);
      return 0;
    }
    
    let deleted = 0;
    const deletePromises = [];
    
    snapshot.forEach((docSnapshot) => {
      const docRef = doc(db, collectionName, docSnapshot.id);
      deletePromises.push(deleteDoc(docRef));
      deleted++;
    });
    
    // 批量删除
    await Promise.all(deletePromises);
    console.log(`  ✅ 删除了 ${deleted} 个文档`);
    
    return deleted;
    
  } catch (error) {
    console.error(`  ❌ 删除集合 '${collectionName}' 失败:`, error.message);
    return 0;
  }
}

/**
 * 清空所有集合
 */
async function clearAllCollections() {
  let totalDeleted = 0;
  
  console.log(`\n🗑️  开始清空 ${COLLECTIONS_TO_CLEAR.length} 个集合...`);
  console.log("=".repeat(50));
  
  for (const collectionName of COLLECTIONS_TO_CLEAR) {
    const deleted = await clearCollection(collectionName);
    totalDeleted += deleted;
  }
  
  console.log("=".repeat(50));
  console.log(`✅ 清空完成! 总共删除了 ${totalDeleted} 个文档`);
  
  return totalDeleted;
}

/**
 * 用户确认
 */
function askForConfirmation() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log("⚠️  警告: 此操作将永久删除数据库中的所有数据!");
    console.log("⚠️  此操作不可逆转!");
    console.log(`\n将要清空的集合: ${COLLECTIONS_TO_CLEAR.join(', ')}`);
    
    const askQuestion = () => {
      rl.question("\n确定要继续吗? (输入 'yes' 确认, 'no' 取消): ", (answer) => {
        const response = answer.toLowerCase().trim();
        if (response === 'yes') {
          rl.close();
          resolve(true);
        } else if (response === 'no') {
          rl.close();
          resolve(false);
        } else {
          console.log("请输入 'yes' 或 'no'");
          askQuestion();
        }
      });
    };
    
    askQuestion();
  });
}

/**
 * 主函数
 */
async function main() {
  console.log("🔥 Firebase数据库清空工具 (Web版)");
  console.log("=".repeat(35));
  
  try {
    // 确认操作
    const confirmed = await askForConfirmation();
    if (!confirmed) {
      console.log("❌ 操作已取消");
      process.exit(0);
    }
    
    console.log("\n🚀 开始清空数据库...");
    
    // 清空所有集合
    const totalDeleted = await clearAllCollections();
    
    if (totalDeleted > 0) {
      console.log("\n🎉 数据库清空完成!");
    } else {
      console.log("\n📄 数据库本来就是空的!");
    }
    
  } catch (error) {
    console.error("\n❌ 清空过程中发生错误:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main().then(() => {
    console.log("\n👋 脚本执行完成");
    process.exit(0);
  }).catch((error) => {
    console.error("❌ 脚本执行失败:", error);
    process.exit(1);
  });
}

module.exports = { clearAllCollections, clearCollection };