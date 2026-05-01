const db = require('./db');
const logger = require('./logger');

const ALLOWED_TABLES = [
  'users', 'companies', 'categories', 'items', 'variants',
  'vendors', 'customers', 'purchases', 'purchase_items',
  'exports', 'export_items', 'conversions', 'conversion_inputs', 'conversion_outputs',
  'raw_stock', 'final_stock', 'customer_payments', 'vendor_payments', 'refresh_tokens'
];

const ALLOWED_COLUMNS = {
  users: ['id', 'name', 'email', 'password_hash', 'phone', 'role', 'company_id', 'created_at'],
  companies: ['id', 'name', 'email', 'phone', 'address', 'created_at'],
  categories: ['id', 'name', 'company_id', 'created_at'],
  items: ['id', 'name', 'category_id', 'company_id', 'created_at'],
  variants: ['id', 'item_id', 'variant_name', 'company_id', 'created_at'],
  vendors: ['id', 'name', 'phone', 'address', 'company_id', 'created_at'],
  customers: ['id', 'name', 'phone', 'address', 'company_id', 'created_at'],
  purchases: ['id', 'vendor_id', 'date', 'total_amount', 'created_by', 'company_id', 'created_at', 'payment_status', 'payment_mode', 'payment_phone', 'payment_date', 'payment_reference', 'payment_notes', 'supplier_type'],
  purchase_items: ['id', 'purchase_id', 'variant_id', 'quantity', 'price_per_kg', 'total', 'company_id', 'created_at'],
  exports: ['id', 'customer_id', 'date', 'total_amount', 'created_by', 'company_id', 'created_at'],
  export_items: ['id', 'export_id', 'variant_id', 'quantity', 'price_per_kg', 'total', 'company_id', 'created_at'],
  conversions: ['id', 'date', 'notes', 'created_by', 'company_id', 'created_at', 'total_input', 'total_output', 'gain_loss'],
  conversion_inputs: ['id', 'conversion_id', 'variant_id', 'quantity', 'company_id', 'created_at'],
  conversion_outputs: ['id', 'conversion_id', 'variant_id', 'quantity', 'company_id', 'created_at'],
  raw_stock: ['id', 'variant_id', 'available_qty', 'company_id', 'created_at'],
  final_stock: ['id', 'variant_id', 'available_qty', 'company_id', 'created_at'],
  customer_payments: ['id', 'customer_id', 'amount', 'payment_mode', 'payment_reference', 'payment_date', 'company_id', 'created_at'],
  vendor_payments: ['id', 'vendor_id', 'amount', 'payment_mode', 'payment_reference', 'payment_date', 'company_id', 'created_at'],
  refresh_tokens: ['id', 'user_id', 'token_hash', 'expires_at', 'created_at']
};

const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateTable(table) {
  if (!ALLOWED_TABLES.includes(table)) {
    logger.warn(`Invalid table access attempt: ${table}`);
    throw new Error(`Invalid table name: ${table}`);
  }
  return true;
}

const _validateColumns = validateColumns;

function validateColumns(table, columns) {
  if (!ALLOWED_COLUMNS[table]) {
    logger.warn(`Unknown table in column validation: ${table}`);
    throw new Error(`Unknown table: ${table}`);
  }
  for (const col of columns) {
    if (!ALLOWED_COLUMNS[table].includes(col)) {
      logger.warn(`Invalid column '${col}' for table '${table}'`);
      throw new Error(`Invalid column '${col}' for table '${table}'`);
    }
  }
  return true;
}

function validateIdentifier(identifier) {
  if (!identifierRegex.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return true;
}

function validateWhereClause(table, where) {
  if (!where || where === '1=1') return;

  if (!ALLOWED_COLUMNS[table]) {
    throw new Error(`Unknown table: ${table}`);
  }

  const allowedColumns = ALLOWED_COLUMNS[table];

  const columnPattern = /(\w+)\s*[=<>!]/g;
  let match;
  while ((match = columnPattern.exec(where)) !== null) {
    const column = match[1];
    if (!allowedColumns.includes(column)) {
      logger.warn(`Invalid column '${column}' in WHERE clause for table '${table}'`);
      throw new Error(`Invalid column '${column}' in WHERE clause for table '${table}'`);
    }
  }

  const isPattern = /\w+\s*(IS NULL|IS NOT NULL)/gi;
  while ((match = isPattern.exec(where)) !== null) {
    const column = match[1].split(/\s+/)[0];
    if (!allowedColumns.includes(column)) {
      throw new Error(`Invalid column '${column}' in WHERE clause for table '${table}'`);
    }
  }
}

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
    validateTable(table);
    const keys = Object.keys(data);
    validateColumns(table, keys);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const [result] = await db.promise().query(query, values);
    return result;
  }

  static async update(table, data, where, whereParams = []) {
    validateTable(table);
    const keys = Object.keys(data);
    validateColumns(table, keys);
    validateWhereClause(table, where);
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), ...whereParams];
    const query = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
    const [result] = await db.promise().query(query, values);
    return result;
  }

  static async delete(table, where, params = []) {
    validateTable(table);
    validateWhereClause(table, where);
    const query = `DELETE FROM ${table} WHERE ${where}`;
    const [result] = await db.promise().query(query, params);
    return result;
  }

  static async count(table, where = '1=1', params = []) {
    validateTable(table);
    validateWhereClause(table, where);
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
