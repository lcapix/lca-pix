// Test setup — loaded before each test file
// Do not connect to the DB here; tests inject their own connections or mocks.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
