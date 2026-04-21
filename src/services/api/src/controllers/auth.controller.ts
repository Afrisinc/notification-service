import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { ApiResponseHelper } from '../utils/api-response';
import { getErrorMessage } from '../utils/errorHandler';
import { getClientIP } from '../utils/securityRecorder';
import type { LoginUserRequest, SignupPayload } from '../../../../types/auth';

const service = new AuthService();

export async function registerUser(req: FastifyRequest, reply: FastifyReply) {
  try {
    const request = req.body as SignupPayload;
    const result = await service.register(request);
    return ApiResponseHelper.created(reply, 'User registered successfully', result);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function loginUser(req: FastifyRequest, reply: FastifyReply) {
  try {
    const ipAddress = getClientIP(req);
    const request = req.body as LoginUserRequest;
    const result = await service.login(request, ipAddress);
    return ApiResponseHelper.success(reply, 'Login successful', result);
  } catch (err: unknown) {
    return ApiResponseHelper.invalidCredentials(reply, getErrorMessage(err));
  }
}

export async function exchangeCodeForToken(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { code } = req.body as { code: string };

    if (!code) {
      return ApiResponseHelper.badRequest(reply, 'Authorization code is required');
    }

    const result = await service.exchangeCodeForToken(code);
    return ApiResponseHelper.success(reply, 'Token issued successfully', result);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function forgotPassword(req: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await service.forgotPassword(req.body);
    return ApiResponseHelper.success(reply, 'Reset password email sent successfully', result);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function resetPassword(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { token, newPassword } = req.body as {
      token: string;
      newPassword: string;
    };
    const result = await service.resetPassword({
      token,
      newPassword,
    });
    return ApiResponseHelper.success(reply, 'Password reset successfully', result);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function verifyEmail(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { token } = (req.query as { token?: string }) || {};
    const result = await service.verifyEmail(token);
    return ApiResponseHelper.success(reply, 'Email verified successfully', result);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function resendVerificationEmail(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = req.body as { email: string };
    if (!email) {
      return ApiResponseHelper.badRequest(reply, 'Email is required');
    }
    const result = await service.resendVerificationEmail(email);
    return ApiResponseHelper.success(reply, 'Verification email sent if account exists', result);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function verifyAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return ApiResponseHelper.unauthorized(reply, 'Authorization header is required');
    }

    // Handle both "Bearer token" and "token" formats
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    const result = await service.verify(token);
    return ApiResponseHelper.success(reply, 'Token is valid', result);
  } catch (err: unknown) {
    return ApiResponseHelper.unauthorized(reply, getErrorMessage(err));
  }
}

export async function getProfile(req: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return ApiResponseHelper.unauthorized(reply, 'User information not found in request');
    }

    const result = await service.getProfile(userId);
    return ApiResponseHelper.success(reply, 'Profile retrieved successfully', result);
  } catch (err: unknown) {
    return ApiResponseHelper.unauthorized(reply, getErrorMessage(err));
  }
}

export async function getOrganizationsByUserId(req: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return ApiResponseHelper.unauthorized(reply, 'User information not found in request');
    }

    const result = await service.getOrganizationsByUserId(userId);
    return ApiResponseHelper.success(reply, 'Organizations retrieved successfully', result);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function getUserApps(req: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return ApiResponseHelper.unauthorized(reply, 'User information not found in request');
    }

    const result = await service.getUserApps(userId);
    return ApiResponseHelper.success(reply, 'User apps retrieved successfully', result);
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}
