const fs = require('fs');
const path = require('path');

console.log('🚀 开始构建优化版本...');

// JS文件的正确依赖顺序（基于index.html中的加载顺序）
const jsFiles = [
    'js/config.js',
    'js/utils.js', 
    'js/deviceManager.js',
    'js/apiClient.js',
    'js/websocketClient.js',
    'js/globalUserState.js',
    'js/dateManager.js',
    'js/todoManager.js',
    'js/notesManager.js',
    'js/userManager.js',
    'js/weatherManager.js',
    'js/app.js'
];

// CSS文件顺序
const cssFiles = [
    'styles/main.css',
    'styles/mobile.css',
    'styles/components.css'
];

// 创建构建目录
const buildDir = 'build';
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
}

// 合并JS文件
console.log('📦 合并JS文件...');
let jsContent = '';
let jsFilesProcessed = [];

for (const jsFile of jsFiles) {
    const filePath = path.join(__dirname, jsFile);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        jsContent += `\n/* === ${jsFile} === */\n`;
        jsContent += content;
        jsContent += '\n';
        jsFilesProcessed.push(jsFile);
        console.log(`  ✅ 已合并: ${jsFile}`);
    } else {
        console.log(`  ⚠️  文件不存在: ${jsFile}`);
    }
}

// 写入合并的JS文件
const bundledJsPath = path.join(buildDir, 'app.bundle.js');
fs.writeFileSync(bundledJsPath, jsContent);
console.log(`📝 JS合并完成: ${jsFilesProcessed.length}个文件 → ${bundledJsPath}`);

// 合并CSS文件
console.log('🎨 合并CSS文件...');
let cssContent = '';
let cssFilesProcessed = [];

for (const cssFile of cssFiles) {
    const filePath = path.join(__dirname, cssFile);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        cssContent += `\n/* === ${cssFile} === */\n`;
        cssContent += content;
        cssContent += '\n';
        cssFilesProcessed.push(cssFile);
        console.log(`  ✅ 已合并: ${cssFile}`);
    } else {
        console.log(`  ⚠️  文件不存在: ${cssFile}`);
    }
}

// 写入合并的CSS文件
const bundledCssPath = path.join(buildDir, 'app.bundle.css');
fs.writeFileSync(bundledCssPath, cssContent);
console.log(`📝 CSS合并完成: ${cssFilesProcessed.length}个文件 → ${bundledCssPath}`);

// 为了安全起见，暂时不进行JS压缩，只移除注释
console.log('🗜️  清理JS文件（移除注释）...');
let minifiedJs = jsContent;

// 只移除明显安全的注释
minifiedJs = minifiedJs.replace(/\/\*\*[\s\S]*?\*\//g, ''); // 移除文档注释
minifiedJs = minifiedJs.replace(/\/\*[\s\S]*?\*\//g, ''); // 移除多行注释
// 暂时不移除单行注释，因为可能会破坏字符串内容

console.log('ℹ️  为保证代码安全性，仅进行了注释清理，未进行空白压缩');

const minifiedJsPath = path.join(buildDir, 'app.min.js');
fs.writeFileSync(minifiedJsPath, minifiedJs);

// 简单的CSS压缩
console.log('🗜️  压缩CSS文件...');
const minifiedCss = cssContent
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除注释
    .replace(/\s+/g, ' ') // 压缩空白字符
    .replace(/;\s*/g, ';') // 压缩分号后空格
    .replace(/:\s*/g, ':') // 压缩冒号后空格
    .replace(/{\s*/g, '{') // 压缩大括号
    .replace(/\s*}/g, '}')
    .replace(/,\s*/g, ',') // 压缩逗号后空格
    .trim();

const minifiedCssPath = path.join(buildDir, 'app.min.css');
fs.writeFileSync(minifiedCssPath, minifiedCss);

// 计算文件大小
const getFileSize = (filePath) => {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2) + ' KB';
};

// 显示构建结果
console.log('\n📊 构建结果:');
console.log('┌─────────────────────────────────────┐');
console.log('│              文件大小统计             │');
console.log('├─────────────────────────────────────┤');
console.log(`│ JS合并版本: ${getFileSize(bundledJsPath).padEnd(23)}│`);
console.log(`│ JS压缩版本: ${getFileSize(minifiedJsPath).padEnd(23)}│`);
console.log(`│ CSS合并版本: ${getFileSize(bundledCssPath).padEnd(22)}│`);
console.log(`│ CSS压缩版本: ${getFileSize(minifiedCssPath).padEnd(22)}│`);
console.log('└─────────────────────────────────────┘');

console.log('\n✅ 构建完成！');
console.log('📁 构建文件位置: ./build/');
console.log('🔧 下一步: 修改 index.html 中的引用');

// 生成新的HTML建议
console.log('\n📋 HTML修改建议:');
console.log('将以下内容替换 index.html 中的多个 <script> 和 <link> 标签:');
console.log('');
console.log('<link rel="stylesheet" href="build/app.min.css">');
console.log('<script src="build/app.min.js" defer></script>');
console.log('');
console.log('🚨 注意: 确保移除所有原来的JS和CSS引用');