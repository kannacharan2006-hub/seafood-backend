module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'routes/*.js',
    'services/*.js',
    'middleware/*.js',
    'config/*.js',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  setupFilesAfterEnv: ['./tests/setup.js'],
  moduleNameMapper: {
    '^(\.\./)+config/db$': '<rootDir>/__mocks__/config/db.js',
    '^(\.\./)+config/database$': '<rootDir>/__mocks__/config/database.js'
  }
};
