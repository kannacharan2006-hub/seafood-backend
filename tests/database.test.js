const db = require('../config/db');

describe('Database Connection', () => {
  it('should connect to database', async () => {
    const connection = await db.promise().getConnection();
    expect(connection).toBeDefined();
    connection.release();
  });

  it('should execute simple query', async () => {
    const [rows] = await db.promise().query('SELECT 1 as result');
    expect(rows[0].result).toBe(1);
  });

  it('should get database version', async () => {
    const [rows] = await db.promise().query('SELECT VERSION() as version');
    expect(rows[0].version).toBeDefined();
  });
});

describe('Database Schema', () => {
  it('should have companies table', async () => {
    const [rows] = await db.promise().query('SHOW TABLES LIKE "companies"');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should have users table', async () => {
    const [rows] = await db.promise().query('SHOW TABLES LIKE "users"');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should have exports table', async () => {
    const [rows] = await db.promise().query('SHOW TABLES LIKE "exports"');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should have purchases table', async () => {
    const [rows] = await db.promise().query('SHOW TABLES LIKE "purchases"');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should have raw_stock table', async () => {
    const [rows] = await db.promise().query('SHOW TABLES LIKE "raw_stock"');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should have final_stock table', async () => {
    const [rows] = await db.promise().query('SHOW TABLES LIKE "final_stock"');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('Database Indexes', () => {
  it('should have indexes on users table', async () => {
    const [rows] = await db.promise().query(`
      SELECT COUNT(*) as count FROM information_schema.statistics 
      WHERE table_schema = DATABASE() 
      AND table_name = 'users'
    `);
    expect(rows[0].count).toBeGreaterThan(0);
  });
});
