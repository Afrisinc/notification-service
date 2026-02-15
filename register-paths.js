const path = require('path');

// Register path mappings for @shared/* aliases in compiled code
require('tsconfig-paths').register({
  baseUrl: __dirname,
  paths: {
    '@shared/*': ['dist/shared/*'],
    '@shared/common': ['dist/shared/common/src'],
    '@shared/config': ['dist/shared/config/src'],
    '@shared/db': ['dist/shared/db/src'],
    '@services/*': ['dist/services/*']
  }
});
