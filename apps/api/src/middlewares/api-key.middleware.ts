import { FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../config/logger";
import { apiKeyService } from "../services/api-key.service";
import { ApiResponseHelper } from "../utils";

/**
 * Validate API key and set tenant context
 * API key should be in Authorization header as: Bearer sk_xxxxx
 */
export async function apiKeyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    logger.warn(
      { requestId: request.id },
      "Missing authorization header for API key",
    );
    ApiResponseHelper.unauthorized(reply, "Missing authorization header");
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer") {
    logger.warn({ requestId: request.id }, "Invalid authorization scheme");
    ApiResponseHelper.unauthorized(reply, "Invalid authorization scheme");
    return;
  }

  if (!token || !token.startsWith("sk_")) {
    logger.warn({ requestId: request.id }, "Invalid API key format");
    ApiResponseHelper.tokenInvalid(reply, "Invalid API key format");
    return;
  }

  try {
    const validation = await apiKeyService.validateApiKey(token);

    if (!validation) {
      logger.warn({ requestId: request.id }, "Invalid or revoked API key");
      ApiResponseHelper.tokenInvalid(reply, "Invalid or revoked API key");
      return;
    }

    // Set tenant context from API key
    request.headers["x-tenant-id"] = validation.tenantId;
    request.headers["x-api-key-id"] = validation.keyId;

    logger.debug(
      { requestId: request.id, tenantId: validation.tenantId },
      "API key validated",
    );
  } catch (error) {
    logger.error(
      {
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error),
      },
      "API key validation failed",
    );
    ApiResponseHelper.tokenInvalid(reply, "API key validation failed");
  }
}
