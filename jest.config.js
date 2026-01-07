module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  transformIgnorePatterns: [],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Set NODE_ENV to test for Jest
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
  // Run tests serially to avoid database race conditions
  maxWorkers: 1,
  // Force exit after tests complete (safety net for CI/CD)
  // This ensures Jest exits even if there are open handles
  forceExit: true,
  // Detect open handles (useful for debugging, but can slow tests)
  // Uncomment to debug hanging tests:
  // detectOpenHandles: true,
};
