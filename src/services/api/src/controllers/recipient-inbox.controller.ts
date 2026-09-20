import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { ApiResponseHelper } from '../utils/api-response';
import { getErrorMessage } from '../utils/errorHandler';
import { inboxService } from '../services/inbox.service';

export async function listMyThreads(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = (request as any).recipient as { email: string };
    const { page, pageSize } = request.query as { page?: string; pageSize?: string };

    const result = await inboxService.listThreadsForRecipient(email, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });

    return ApiResponseHelper.successList(reply, 'Threads retrieved', result.threads, { total: result.total });
  } catch (error) {
    logger.error({ error }, 'Failed to list recipient threads');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve threads');
  }
}

export async function getMyThread(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = (request as any).recipient as { email: string };
    const { threadId } = request.params as { threadId: string };
    const thread = await inboxService.getThreadDetail(threadId, { kind: 'recipient', email });
    return ApiResponseHelper.success(reply, 'Thread retrieved', thread);
  } catch (error) {
    return ApiResponseHelper.notFound(reply, getErrorMessage(error));
  }
}

export async function replyToMyThread(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = (request as any).recipient as { email: string };
    const { threadId } = request.params as { threadId: string };
    const { body, html, cc } = request.body as { body: string; html?: string; cc?: string[] };

    const message = await inboxService.replyToThread(threadId, { kind: 'recipient', email }, { body, html, cc });
    return ApiResponseHelper.success(reply, 'Reply sent', message);
  } catch (error) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(error));
  }
}
