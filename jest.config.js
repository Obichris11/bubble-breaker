module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  testMatch: [
    '<rootDir>/src/**/*.(test|spec).ts'
  ],
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.module.ts',
    '!src/app/**/index.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.test.ts'
  ],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@components/(.*)$': '<rootDir>/src/app/components/$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!.*\\.mjs$)'
  ],
  testEnvironment: 'jsdom'
};