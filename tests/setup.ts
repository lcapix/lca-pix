process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';

// Only load DOM matchers when running in jsdom (component tests)
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}
