import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/apps', '<rootDir>/packages', '<rootDir>/__tests__'],
  testMatch: ['**/src/**/*.test.ts', '**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'apps/**/src/**/*.ts',
    'packages/**/src/**/*.ts',
    '!**/*.test.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^@afrisinc-notify/common$': '<rootDir>/packages/common/src/index.ts',
    '^@afrisinc-notify/config$': '<rootDir>/packages/config/src/index.ts',
    '^@afrisinc-notify/db$': '<rootDir>/packages/db/src/index.ts',
  },
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default config;
