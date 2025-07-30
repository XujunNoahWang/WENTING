#!/usr/bin/env node

// Firebase 配置验证脚本
// 验证 Firebase 项目配置是否正确

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase 配置验证\n');

// 检查 .env 文件
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env 文件存在');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // 检查 Google 客户端 ID
  const googleClientIdMatch = envContent.match(/GOOGLE_WEB_CLIENT_ID=(.+)/);
  if (googleClientIdMatch && googleClientIdMatch[1] && googleClientIdMatch[1] !== 'your-google-web-client-id') {
    console.log('✅ Google Web 客户端 ID 已配置');
    console.log(`   ID: ${googleClientIdMatch[1].substring(0, 20)}...`);
  } else {
    console.log('❌ Google Web 客户端 ID 未配置');
  }
} else {
  console.log('❌ .env 文件不存在');
}

// 检查 Firebase 配置文件
const firebaseConfigPath = path.join(__dirname, '..', 'src', 'config', 'firebase.ts');
if (fs.existsSync(firebaseConfigPath)) {
  console.log('✅ Firebase 配置文件存在');
  
  const configContent = fs.readFileSync(firebaseConfigPath, 'utf8');
  
  // 检查项目 ID
  const projectIdMatch = configContent.match(/projectId:\s*["']([^"']+)["']/);
  if (projectIdMatch && projectIdMatch[1] && projectIdMatch[1] !== 'your-project-id') {
    console.log('✅ Firebase 项目 ID 已配置');
    console.log(`   项目 ID: ${projectIdMatch[1]}`);
  } else {
    console.log('❌ Firebase 项目 ID 未配置');
  }
  
  // 检查 API Key
  const apiKeyMatch = configContent.match(/apiKey:\s*["']([^"']+)["']/);
  if (apiKeyMatch && apiKeyMatch[1] && apiKeyMatch[1] !== 'your-api-key-here') {
    console.log('✅ Firebase API Key 已配置');
    console.log(`   API Key: ${apiKeyMatch[1].substring(0, 20)}...`);
  } else {
    console.log('❌ Firebase API Key 未配置');
  }
} else {
  console.log('❌ Firebase 配置文件不存在');
}

// 检查 Firestore 规则文件
const rulesPath = path.join(__dirname, '..', 'firestore.rules');
if (fs.existsSync(rulesPath)) {
  console.log('✅ Firestore 安全规则文件存在');
} else {
  console.log('❌ Firestore 安全规则文件不存在');
}

// 检查 .gitignore
const gitignorePath = path.join(__dirname, '..', '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  if (gitignoreContent.includes('.env')) {
    console.log('✅ .env 文件已添加到 .gitignore');
  } else {
    console.log('❌ .env 文件未添加到 .gitignore');
  }
} else {
  console.log('❌ .gitignore 文件不存在');
}

console.log('\n🚀 下一步:');
console.log('1. 运行: firebase login');
console.log('2. 运行: firebase init firestore');
console.log('3. 运行: firebase deploy --only firestore:rules');
console.log('4. 测试应用: npm run web');

console.log('\n📋 配置完成度检查:');
const checks = [
  fs.existsSync(envPath),
  fs.existsSync(firebaseConfigPath),
  fs.existsSync(rulesPath),
  fs.existsSync(gitignorePath)
];
const completionRate = (checks.filter(Boolean).length / checks.length * 100).toFixed(0);
console.log(`${completionRate}% 完成`);

if (completionRate === '100') {
  console.log('🎉 所有配置文件都已就绪！');
} else {
  console.log('⚠️  还有配置需要完成');
}