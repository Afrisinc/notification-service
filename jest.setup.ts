// Jest setup file for global configurations
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/notification_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-secret-key';
process.env.EMAIL_PROVIDER = 'smtp';
process.env.SMTP_HOST = 'smtp.test.local';
process.env.SMTP_PORT = '587';
