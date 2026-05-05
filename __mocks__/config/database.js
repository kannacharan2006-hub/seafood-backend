const ALLOWED_TABLES = [
  'users', 'companies', 'categories', 'items', 'variants',
  'vendors', 'customers', 'purchases', 'purchase_items',
  'exports', 'export_items', 'conversions', 'conversion_inputs', 'conversion_outputs',
  'raw_stock', 'final_stock', 'customer_payments', 'vendor_payments', 'refresh_tokens'
];

const ALLOWED_COLUMNS = {
  users: ['id', 'name', 'email', 'password_hash', 'phone', 'role', 'company_id', 'created_at'],
  companies: ['id', 'name', 'email', 'phone', 'address', 'created_at'],
};

const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateTable(table) {
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  return true;
}

function validateColumns(table, columns) {
  if (!ALLOWED_COLUMNS[table]) {
    throw new Error(`Unknown table: ${table}`);
  }
  for (const col of columns) {
    if (!ALLOWED_COLUMNS[table].includes(col)) {
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
      throw new Error(`Invalid column '${column}' in WHERE clause for table '${table}'`);
    }
  }
}

const Database = {
  query: jest.fn().mockResolvedValue([]),
  execute: jest.fn().mockResolvedValue([]),
  getOne: jest.fn().mockResolvedValue(null),
  getAll: jest.fn().mockResolvedValue([]),
  insert: jest.fn().mockImplementation((table, data) => {
    try {
      validateTable(table);
      if (data) validateColumns(table, Object.keys(data));
      return Promise.resolve({ insertId: 1, affectedRows: 1 });
    } catch (error) {
      return Promise.reject(error);
    }
  }),
  update: jest.fn().mockImplementation((table) => {
    validateTable(table);
    return Promise.resolve({ affectedRows: 1 });
  }),
  delete: jest.fn().mockResolvedValue({ affectedRows: 1 }),
  count: jest.fn().mockResolvedValue(0),
  beginTransaction: jest.fn().mockResolvedValue({
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
    query: jest.fn().mockResolvedValue([[]])
  }),
  commit: jest.fn().mockResolvedValue(),
  rollback: jest.fn().mockResolvedValue(),
  transaction: jest.fn().mockImplementation(async (callback) => {
    const mockConnection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([[]])
    };
    return await callback(mockConnection);
  }),
  getPool: jest.fn().mockReturnValue({})
};

Database.validateTable = validateTable;
Database.validateColumns = validateColumns;
Database.validateIdentifier = validateIdentifier;
Database.validateWhereClause = validateWhereClause;

module.exports = Database;
