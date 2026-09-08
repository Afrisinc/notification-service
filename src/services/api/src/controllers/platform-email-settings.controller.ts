import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { getPlatformEmailSettings, updatePlatformEmailSettings } from '@shared/platform-settings';
import { ApiResponseHelper } from '../utils/api-response';

export async function getPlatformEmailSettingsHandler(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const settings = await getPlatformEmailSettings();
    return ApiResponseHelper.success(reply, 'Platform email settings retrieved', {
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      supportEmail: settings.supportEmail,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get platform email settings');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve platform email settings');
  }
}

export async function updatePlatformEmailSettingsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { fromEmail, fromName, supportEmail } = request.body as {
      fromEmail: string;
      fromName: string;
      supportEmail?: string;
    };

    if (!fromEmail || !fromName) {
      return ApiResponseHelper.missingFields(reply, 'fromEmail and fromName are required');
    }

    const updated = await updatePlatformEmailSettings({ fromEmail, fromName, supportEmail });
    logger.info({ fromEmail, fromName }, 'Platform email settings updated');

    return ApiResponseHelper.success(reply, 'Platform email settings saved', {
      fromEmail: updated.fromEmail,
      fromName: updated.fromName,
      supportEmail: updated.supportEmail,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update platform email settings');
    return ApiResponseHelper.internalError(reply, 'Failed to save platform email settings');
  }
}
