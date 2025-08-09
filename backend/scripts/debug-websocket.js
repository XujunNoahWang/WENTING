// WebSocket调试脚本
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3001/ws';

async function debugWebSocket() {
    try {
        console.log('🔍 调试WebSocket连接...');
        
        const ws = new WebSocket(WS_URL);
        
        ws.on('open', () => {
            console.log('✅ WebSocket连接已建立');
            
            // 发送PING消息测试基本连接
            console.log('📤 发送PING消息...');
            ws.send(JSON.stringify({
                type: 'PING',
                userId: 'testuser',
                deviceId: 'testdevice',
                timestamp: Date.now()
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('📨 收到消息:', message);
                
                if (message.type === 'PING_RESPONSE') {
                    console.log('✅ PING/PONG测试成功');
                    
                    // 测试Link功能
                    console.log('📤 测试Link功能...');
                    ws.send(JSON.stringify({
                        type: 'LINK_GET_PENDING_REQUESTS',
                        userId: 'testuser',
                        deviceId: 'testdevice',
                        timestamp: Date.now()
                    }));
                } else if (message.type === 'LINK_GET_PENDING_REQUESTS_RESPONSE') {
                    console.log('✅ Link功能响应成功');
                } else if (message.type === 'LINK_GET_PENDING_REQUESTS_ERROR') {
                    console.log('❌ Link功能错误:', message.error);
                }
            } catch (error) {
                console.error('❌ 解析消息失败:', error);
            }
        });
        
        ws.on('error', (error) => {
            console.error('❌ WebSocket错误:', error);
        });
        
        ws.on('close', () => {
            console.log('🔌 WebSocket连接已关闭');
        });
        
        // 10秒后关闭连接
        setTimeout(() => {
            ws.close();
        }, 10000);
        
    } catch (error) {
        console.error('❌ 调试失败:', error);
    }
}

debugWebSocket();