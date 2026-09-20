import type { FastifyReply, FastifyRequest } from 'fastify';
import { recipientAuthService } from '../services/recipient-auth.service';
import { ApiResponseHelper } from '../utils/api-response';
import { getErrorMessage } from '../utils/errorHandler';
import { getClientIP } from '../utils/securityRecorder';

export async function requestAccess(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = req.body as { email: string };
    const result = await recipientAuthService.requestAccess(email);
    return ApiResponseHelper.success(reply, result.message);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function setPassword(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { token, password } = req.body as { token: string; password: string };
    const result = await recipientAuthService.setPassword(token, password);
    return ApiResponseHelper.success(reply, result.message);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function login(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const ipAddress = getClientIP(req);
    const result = await recipientAuthService.login(email, password, ipAddress);
    return ApiResponseHelper.success(reply, 'Login successful', result);
  } catch (err: unknown) {
    return ApiResponseHelper.invalidCredentials(reply, getErrorMessage(err));
  }
}

export async function forgotPassword(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = req.body as { email: string };
    const result = await recipientAuthService.forgotPassword(email);
    return ApiResponseHelper.success(reply, result.message);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function resetPassword(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { token, password } = req.body as { token: string; password: string };
    const result = await recipientAuthService.resetPassword(token, password);
    return ApiResponseHelper.success(reply, result.message);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}
