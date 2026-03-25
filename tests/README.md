# Seafood ERP - Integration Tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests with watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.js           # Jest configuration and global setup
├── auth.test.js      # Authentication routes tests
├── crud.test.js      # CRUD operations tests
├── validation.test.js # Input validation tests
└── database.test.js  # Database connection and schema tests
```

## Test Coverage

### Auth Tests
- Login with invalid credentials
- Login validation
- Forgot password flow
- Password reset flow
- Company registration validation

### CRUD Tests
- Purchase creation validation
- Export creation validation
- Pagination functionality

### Validation Tests
- Email format validation
- Password strength validation
- OTP format validation

### Database Tests
- Connection test
- Schema verification
- Index verification

## Notes

- Tests require a running MySQL database
- Set up `.env` with test database credentials
- Tests are non-destructive (read operations)
- Some tests may be skipped if database is not available
