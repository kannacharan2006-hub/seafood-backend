require('dotenv').config();
jest.setTimeout(30000);

beforeAll(() => {
  console.log('Starting integration tests...');
});

afterAll(() => {
  console.log('Tests completed!');
});
