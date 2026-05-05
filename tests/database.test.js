const Database = require('../config/database');

jest.mock('../config/db', () => ({
  query: jest.fn((query, params, callback) => {
    if (callback) callback(null, []);
    return { promise: () => require('../config/db') };
  }),
  promise: () => ({
    query: jest.fn().mockResolvedValue([[]]),
    getConnection: jest.fn().mockResolvedValue({
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([[]])
    })
  }),
  getConnection: jest.fn().mockResolvedValue({
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
    query: jest.fn().mockResolvedValue([[]])
  })
}));

describe('Database Module - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Table Validation', () => {
    it('should allow valid table names', () => {
      expect(() => Database.validateTable('users')).not.toThrow();
      expect(() => Database.validateTable('companies')).not.toThrow();
      expect(() => Database.validateTable('purchases')).not.toThrow();
    });

    it('should reject invalid table names', () => {
      expect(() => Database.validateTable('invalid_table')).toThrow('Invalid table name: invalid_table');
      expect(() => Database.validateTable('DROP TABLE users')).toThrow();
    });
  });

  describe('Column Validation', () => {
    it('should allow valid columns for users table', () => {
      expect(() => Database.validateColumns('users', ['id', 'name', 'email'])).not.toThrow();
    });

    it('should reject invalid columns for users table', () => {
      expect(() => Database.validateColumns('users', ['invalid_column'])).toThrow();
    });
  });

  describe('Identifier Validation', () => {
    it('should validate correct identifiers', () => {
      expect(() => Database.validateIdentifier('valid_column')).not.toThrow();
      expect(() => Database.validateIdentifier('_private')).not.toThrow();
    });

    it('should reject invalid identifiers', () => {
      expect(() => Database.validateIdentifier('123invalid')).toThrow();
      expect(() => Database.validateIdentifier('col;DROP TABLE')).toThrow();
    });
  });

  describe('Where Clause Validation', () => {
    it('should allow valid WHERE clauses', () => {
      expect(() => Database.validateWhereClause('users', "id = 1")).not.toThrow();
      expect(() => Database.validateWhereClause('users', "email = 'test@test.com'")).not.toThrow();
      expect(() => Database.validateWhereClause('users', "id IS NULL")).not.toThrow();
    });

    it('should reject invalid WHERE clauses', () => {
      expect(() => Database.validateWhereClause('users', "invalid_col = 1")).toThrow();
    });
  });

  describe('Query Methods', () => {
    it('should execute insert with validation', async () => {
      const result = await Database.insert('users', {
        name: 'Test User',
        email: 'test@test.com',
        password_hash: 'hash',
        role: 'EMPLOYEE',
        company_id: 1
      });
      expect(result).toBeDefined();
    });

    it('should reject insert with invalid table', async () => {
      await expect(Database.insert('invalid_table', { data: 'test' })).rejects.toThrow();
    });

    it('should execute update with validation', async () => {
      const result = await Database.update('users', { name: 'Updated' }, 'id = ?', [1]);
      expect(result).toBeDefined();
    });

    it('should execute count query', async () => {
      const count = await Database.count('users');
      expect(typeof count).toBe('number');
    });
  });
});
