const { query } = require('../config/sqlite');

async function checkTables() {
    try {
        const tables = await query('SELECT name FROM sqlite_master WHERE type="table"');
        console.log('Tables:', tables);
        
        const notes = await query('SELECT * FROM notes LIMIT 5');
        console.log('Notes:', notes);
    } catch(e) {
        console.error(e);
    }
}

checkTables();