const fs = require('fs');
const path = require('path');

console.log('🔍 检查是否需要重新构建...');

// 源文件列表
const sourceFiles = [
    'js/config.js', 'js/utils.js', 'js/deviceManager.js',
    'js/apiClient.js', 'js/websocketClient.js', 'js/globalUserState.js',
    'js/dateManager.js', 'js/todoManager.js', 'js/notesManager.js',
    'js/userManager.js', 'js/weatherManager.js', 'js/app.js',
    'styles/main.css', 'styles/mobile.css', 'styles/components.css'
];

// 构建产物
const buildFiles = [
    'build/app.min.js',
    'build/app.min.css'
];

// 检查文件是否存在
function fileExists(filePath) {
    return fs.existsSync(path.join(__dirname, filePath));
}

// 获取文件修改时间
function getModTime(filePath) {
    try {
        const stats = fs.statSync(path.join(__dirname, filePath));
        return stats.mtime.getTime();
    } catch (error) {
        return 0;
    }
}

// 检查构建文件是否存在
const missingBuildFiles = buildFiles.filter(file => !fileExists(file));
if (missingBuildFiles.length > 0) {
    console.log('❌ 构建文件不存在:', missingBuildFiles);
    console.log('🔧 需要运行构建: node build.js');
    process.exit(1);
}

// 检查源文件是否比构建文件新
const buildTime = Math.min(...buildFiles.map(getModTime));
const newerSources = sourceFiles.filter(file => {
    const sourceTime = getModTime(file);
    return sourceTime > buildTime;
});

if (newerSources.length > 0) {
    console.log('⚠️  检测到源文件更新:', newerSources);
    console.log('🔧 需要重新构建: node build.js');
    process.exit(1);
} else {
    console.log('✅ 构建文件是最新的，无需重新构建');
    process.exit(0);
}