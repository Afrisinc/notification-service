import { getConfig, resetConfig } from "./index";

describe("Config", () => {
  beforeEach(() => {
    resetConfig();
    // Set up test environment variables
    process.env.NODE_ENV = "test";
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_PORT = "587";
    process.env.REDIS_URL = "redis://localhost:6379";
  });

  afterEach(() => {
    resetConfig();
    delete process.env.NODE_ENV;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.REDIS_URL;
  });

  describe("getConfig", () => {
    it("should return configuration object", () => {
      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.EMAIL_PROVIDER).toBe("smtp");
      expect(config.SMTP_HOST).toBe("smtp.test.com");
      expect(config.SMTP_PORT).toBe(587);
    });

    it("should cache configuration", () => {
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toBe(config2);
    });

    it("should parse environment variables correctly", () => {
      const config = getConfig();
      expect(config.NODE_ENV).toBe("test");
      expect(config.REDIS_URL).toBe("redis://localhost:6379");
    });

    it("should use default values for optional variables", () => {
      const config = getConfig();
      expect(config.LOG_LEVEL).toBe("info");
    });
  });

  describe("resetConfig", () => {
    it("should reset cached configuration", () => {
      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();
      expect(config1).not.toBe(config2);
    });
  });

  describe("Email Configuration", () => {
    it("should support SMTP configuration", () => {
      process.env.EMAIL_PROVIDER = "smtp";
      resetConfig();
      const config = getConfig();
      expect(config.EMAIL_PROVIDER).toBe("smtp");
    });

    it("should support SendGrid configuration", () => {
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "sg-key-123";
      resetConfig();
      const config = getConfig();
      expect(config.EMAIL_PROVIDER).toBe("sendgrid");
    });

    it("should validate email provider", () => {
      process.env.EMAIL_PROVIDER = "invalid";
      resetConfig();
      expect(() => getConfig()).toThrow();
    });
  });

  describe("Redis Configuration", () => {
    it("should use default Redis URL if not provided", () => {
      delete process.env.REDIS_URL;
      resetConfig();
      const config = getConfig();
      expect(config.REDIS_URL).toBe("redis://localhost:6379");
    });

    it("should use custom Redis URL if provided", () => {
      process.env.REDIS_URL = "redis://custom-host:6380";
      resetConfig();
      const config = getConfig();
      expect(config.REDIS_URL).toBe("redis://custom-host:6380");
    });
  });
});
