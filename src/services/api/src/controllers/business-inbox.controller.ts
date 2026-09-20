import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { ApiResponseHelper } from '../utils/api-response';
import { getErrorMessage } from '../utils/errorHandler';
import { inboxService } from '../services/inbox.service';

export async function listOrgThreads(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = request.params as { orgId: string };
    const { page, pageSize } = request.query as { page?: string; pageSize?: string };

    const result = await inboxService.listThreadsForOrg(orgId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });

    return ApiResponseHelper.successList(reply, 'Threads retrieved', result.threads, { total: result.total });
  } catch (error) {
    logger.error({ error }, 'Failed to list organization threads');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve threads');
  }
}

export async function getOrgThread(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, threadId } = request.params as { orgId: string; threadId: string };
    const thread = await inboxService.getThreadDetail(threadId, { kind: 'org', orgId });
    return ApiResponseHelper.success(reply, 'Thread retrieved', thread);
  } catch (error) {
    return ApiResponseHelper.notFound(reply, getErrorMessage(error));
  }
}

export async function composeOrgThread(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = request.params as { orgId: string };
    const userId = (request as any).user?.id as string;
    const { senderId, to, cc, subject, body, html } = request.body as {
      senderId: string;
      to: string;
      cc?: string[];
      subject: string;
      body: string;
      html?: string;
    };

    const thread = await inboxService.composeThread({ orgId, userId, senderId, to, cc, subject, body, html });
    return ApiResponseHelper.created(reply, 'Email sent', thread);
  } catch (error) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(error));
  }
}

export async function replyToOrgThread(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, threadId } = request.params as { orgId: string; threadId: string };
    const { body, html, cc } = request.body as { body: string; html?: string; cc?: string[] };

    const message = await inboxService.replyToThread(threadId, { kind: 'org', orgId }, { body, html, cc });
    return ApiResponseHelper.success(reply, 'Reply sent', message);
  } catch (error) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(error));
  }
}
