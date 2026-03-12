import { PrismaClient } from '@prisma/client';
import { dbConfig } from './config';

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Prisma clients for separate read and write connections
 */
export const prismaWrite = new PrismaClient({
  datasources: {
    db: {
      url: dbConfig.writeDBConnString, // primary / master DB
    },
  },
});

export const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: dbConfig.readDBConnString, // replica / read-only DB
    },
  },
});

/**
 * Verify both DB connections independently
 */
export const verifyDbConnections = async (): Promise<boolean> => {
  try {
    await prismaWrite.$connect();
    console.log('Write DB connection established successfully on', NODE_ENV);

    await prismaRead.$connect();
    console.log('Read DB connection established successfully on', NODE_ENV);
    return true;
  } catch (err) {
    console.error('Unable to connect to one or more databases:', err);
    return false;
  }
};

/**
 * Graceful shutdown (close both connections)
 */
export const closeDbConnections = async () => {
  try {
    await Promise.all([prismaWrite.$disconnect(), prismaRead.$disconnect()]);
    console.log('Database connections closed cleanly.');
  } catch (err) {
    console.error('Error during DB disconnection:', err);
  }
};
