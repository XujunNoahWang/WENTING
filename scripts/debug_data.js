#!/usr/bin/env node
/**
 * 调试数据库数据结构
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

// 初始化Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugData() {
  try {
    console.log('🔍 检查数据库中的数据结构...\n');
    
    // 检查household_members集合
    console.log('📁 household_members 集合:');
    const membersRef = collection(db, 'household_members');
    const membersSnapshot = await getDocs(membersRef);
    
    if (membersSnapshot.empty) {
      console.log('  ❌ 集合为空');
    } else {
      membersSnapshot.forEach((doc) => {
        console.log('  📄 文档ID:', doc.id);
        console.log('  📄 数据:', JSON.stringify(doc.data(), null, 2));
        console.log('  ---');
      });
    }
    
    // 检查users集合
    console.log('\n📁 users 集合:');
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    if (usersSnapshot.empty) {
      console.log('  ❌ 集合为空');
    } else {
      usersSnapshot.forEach((doc) => {
        console.log('  📄 文档ID:', doc.id);
        console.log('  📄 数据:', JSON.stringify(doc.data(), null, 2));
        console.log('  ---');
      });
    }
    
    // 检查households集合
    console.log('\n📁 households 集合:');
    const householdsRef = collection(db, 'households');
    const householdsSnapshot = await getDocs(householdsRef);
    
    if (householdsSnapshot.empty) {
      console.log('  ❌ 集合为空');
    } else {
      householdsSnapshot.forEach((doc) => {
        console.log('  📄 文档ID:', doc.id);
        console.log('  📄 数据:', JSON.stringify(doc.data(), null, 2));
        console.log('  ---');
      });
    }
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugData().then(() => {
  console.log('\n✅ 调试完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 脚本失败:', error);
  process.exit(1);
});