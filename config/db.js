const mysql = require('mysql2');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Charan2006$',
    database: 'seafood_erp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    port: 3306
});



module.exports = db;