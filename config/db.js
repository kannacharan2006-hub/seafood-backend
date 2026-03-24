const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Charan2006$',
    database: process.env.DB_NAME || 'seafood_erp',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: '+05:30',
    dateStrings: false
});

db.on('connection', (connection) => {
    console.log(`[DB] New connection established: ${connection.threadId}`);
});

db.on('release', (connection) => {
    console.log(`[DB] Connection released: ${connection.threadId}`);
});

module.exports = db;