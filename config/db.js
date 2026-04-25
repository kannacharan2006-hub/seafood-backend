const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: 'Asia/Kolkata',
    dateStrings: false,
    ssl: {
        rejectUnauthorized: true
    }
});

db.on('connection', (connection) => {
    console.log(`[DB] New connection established: ${connection.threadId}`);
    connection.query(`SET time_zone = '+05:30'`);
});

db.on('release', (connection) => {
    console.log(`[DB] Connection released: ${connection.threadId}`);
});

module.exports = db;