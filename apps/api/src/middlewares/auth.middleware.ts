import { FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../config/logger";
import { ApiResponseHelper } from "../utils";

// Mock token validation - replace with actual JWT validation
const validTokens = new Set(["valid-service-token", "test-token"]);

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    logger.warn({ requestId: request.id }, "Missing authorization header");
    ApiResponseHelper.unauthorized(reply, "Missing authorization header");
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer") {
    logger.warn({ requestId: request.id }, "Invalid authorization scheme");
    ApiResponseHelper.unauthorized(reply, "Invalid authorization scheme");
    return;
  }

  if (!token || !validTokens.has(token)) {
    logger.warn({ requestId: request.id }, "Invalid or expired token");
    ApiResponseHelper.tokenInvalid(reply, "Invalid or expired token");
    return;
  }

  logger.debug({ requestId: request.id }, "Request authorized");
}
