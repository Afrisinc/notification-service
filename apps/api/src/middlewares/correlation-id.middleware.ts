import { FastifyRequest, FastifyReply } from "fastify";

export async function correlationIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const correlationId = request.headers["x-correlation-id"] || request.id;

  // Fastify's built-in requestId is sufficient for correlation
  // If x-correlation-id header is provided, use it (for distributed tracing)
  if (request.headers["x-correlation-id"]) {
    reply.header("x-correlation-id", request.headers["x-correlation-id"]);
  }

  reply.header("x-request-id", request.id);
}
