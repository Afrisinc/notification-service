import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^@shared/common$': '<rootDir>/src/shared/common/src/index.ts',
    '^@shared/config$': '<rootDir>/src/shared/config/src/index.ts',
    '^@shared/db$': '<rootDir>/src/shared/db/src/index.ts',
    '^@shared/database$': '<rootDir>/src/shared/database/index.ts',
    '^@shared/redis$': '<rootDir>/src/shared/redis/index.ts',
    '^@shared/cache$': '<rootDir>/src/shared/cache/index.ts',
    '^@shared/platform-settings$': '<rootDir>/src/shared/platform-settings/index.ts',
    '^@shared/utils$': '<rootDir>/src/shared/utils/index.ts',
    '^@shared/utils/(.*)$': '<rootDir>/src/shared/utils/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
  },
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
};

export default config;
