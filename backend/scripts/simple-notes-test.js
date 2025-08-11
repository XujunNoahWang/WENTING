const { query } = require('../config/sqlite');

async function testInsert() {
    try {
        const result = await query(
            'INSERT INTO notes (user_id, title, description, precautions, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [20, 'test', 'test desc', 'test precautions']
        );
        console.log('Insert result:', result);
        
        const note = await query('SELECT * FROM notes WHERE id = ?', [result.lastID]);
        console.log('Created note:', note);
        
        // 清理
        await query('DELETE FROM notes WHERE id = ?', [result.lastID]);
        console.log('Cleaned up');
    } catch(e) {
        console.error(e);
    }
}

testInsert();