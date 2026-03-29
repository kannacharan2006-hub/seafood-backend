const db = require('./db');
const logger = require('./logger');

/**
 * Database abstraction layer for consistent query execution
 */
class Database {
  /**
   * Execute a query with parameters
   * @param {string} query - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Query results
   */
  static async query(query, params = []) {
    return new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) {
          logger.error('Database query error', { 
            error: err.message, 
            query, 
            params 
          });
          return reject(err);
        }
        resolve(results);
      });
    });
  }

  /**
   * Execute a query using promises (mysql2/promise)
   * @param {string} query - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Query results
   */
  static async execute(query, params = []) {
    try {
      const [results] = await db.promise().query(query, params);
      return results;
    } catch (err) {
      logger.error('Database execute error', { 
        error: err.message, 
        query, 
        params 
      });
      throw err;
    }
  }

  /**
   * Begin a transaction
   * @returns {Promise<Object>} - Connection object
   */
  static async beginTransaction() {
    const connection = await db.promise().getConnection();
    await connection.beginTransaction();
    return connection;
  }

  /**
   * Commit a transaction
   * @param {Object} connection - Connection object
   * @returns {Promise<void>}
   */
  static async commit(connection) {
    try {
      await connection.commit();
      connection.release();
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }

  /**
   * Rollback a transaction
   * @param {Object} connection - Connection object
   * @returns {Promise<void>}
   */
  static async rollback(connection) {
    await connection.rollback();
    connection.release();
  }
}

module.exports = Database;