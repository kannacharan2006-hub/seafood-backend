const mysql = require('mysql2');
const logger = require('./logger');

const DB_TIMEZONE = process.env.DB_TIMEZONE || '+05:30';

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
    timezone: DB_TIMEZONE,
    dateStrings: false,
    ssl: {
        rejectUnauthorized: true
    }
});

db.on('connection', (connection) => {
    logger.debug(`[DB] New connection: ${connection.threadId}`);
    connection.query(`SET time_zone = '${DB_TIMEZONE}'`);
});

// Removed verbose release logging - was spamming logs

module.exports = db;