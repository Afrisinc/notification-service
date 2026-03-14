// Database module exports
export { prismaWrite, prismaRead, verifyDbConnections, closeDbConnections } from './config/prisma';
export { dbConfig } from './config/config';

// Alias for backward compatibility
export { prismaWrite as db } from './config/prisma';
