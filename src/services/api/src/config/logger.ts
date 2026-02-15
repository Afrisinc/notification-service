import pino from "pino";
import { getConfig } from "@shared/config";

const config = getConfig();

const pinoConfig =
  config.NODE_ENV === "production"
    ? {
        level: config.LOG_LEVEL,
      }
    : {
        level: config.LOG_LEVEL,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      };

export const logger = pino(pinoConfig);
