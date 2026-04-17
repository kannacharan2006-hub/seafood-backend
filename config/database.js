const db = require('./db');
const logger = require('./logger');

class Database {
  static async query(query, params = []) {
    return new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) {
          logger.error('Database query error', { error: err.message, query, params });
          return reject(err);
        }
        resolve(results);
      });
    });
  }

  static async execute(query, params = []) {
    try {
      const [results] = await db.promise().query(query, params);
      return results;
    } catch (err) {
      logger.error('Database execute error', { error: err.message, query, params });
      throw err;
    }
  }

  static async getOne(query, params = []) {
    const results = await this.execute(query, params);
    return results[0] || null;
  }

  static async getAll(query, params = []) {
    return await this.execute(query, params);
  }

  static async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const [result] = await db.promise().query(query, values);
    return result;
  }

  static async update(table, data, where, whereParams = []) {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), ...whereParams];
    const query = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
    const [result] = await db.promise().query(query, values);
    return result;
  }

  static async delete(table, where, params = []) {
    const query = `DELETE FROM ${table} WHERE ${where}`;
    const [result] = await db.promise().query(query, params);
    return result;
  }

  static async count(table, where = '1=1', params = []) {
    const query = `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`;
    const result = await this.getOne(query, params);
    return result ? result.count : 0;
  }

  static async beginTransaction() {
    const connection = await db.promise().getConnection();
    await connection.beginTransaction();
    return connection;
  }

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

  static async rollback(connection) {
    await connection.rollback();
    connection.release();
  }

  static async transaction(callback) {
    const connection = await this.beginTransaction();
    try {
      const result = await callback(connection);
      await this.commit(connection);
      return result;
    } catch (err) {
      await this.rollback(connection);
      throw err;
    }
  }

  static getPool() {
    return db;
  }
}

module.exports = Database;
