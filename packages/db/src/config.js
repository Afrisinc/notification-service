"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbConfig = void 0;
const config_1 = require("@afrisinc-notify/config");
/**
 * Database configuration
 * Loads configuration from centralized config package
 */
const config = (0, config_1.getConfig)();
exports.dbConfig = {
    databaseUrl: config.DATABASE_URL,
    nodeEnv: config.NODE_ENV,
    logQueries: config.DATABASE_LOG_QUERIES === "true",
};
//# sourceMappingURL=config.js.map