import { env } from '../config/env';
import { logger } from '../config/logger';

const FALLBACK_RATE = env.USDEXCHANGE_RATE ? Number.parseFloat(env.USDEXCHANGE_RATE) : 1450;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface CachedRate {
  rate: number;
  timestamp: number;
}

let cachedRate: CachedRate | null = null;

/**
 * Fetch current USD to RWF exchange rate from api.exchangerate.host
 * Falls back to hardcoded rate if API is unavailable
 */
export async function fetchUsdToRwfRate(): Promise<number> {
  try {
    // Check cache first
    if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION_MS) {
      logger.debug({ rate: cachedRate.rate }, 'Using cached exchange rate');
      return cachedRate.rate;
    }

    const response = await fetch('https://api.exchangerate.host/convert?from=USD&to=RWF', { timeout: 5000 } as any);
    const data = await response.json();

    if (data.result && typeof data.result === 'number') {
      const rate = Math.round(data.result);
      cachedRate = { rate, timestamp: Date.now() };
      logger.info({ rate }, 'Fetched USD to RWF exchange rate');
      return rate;
    }

    logger.warn('Invalid exchange rate response, using fallback');
    return FALLBACK_RATE;
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch exchange rate, using fallback');
    return FALLBACK_RATE;
  }
}

/**
 * Convert USD amount to RWF using current exchange rate
 * @param usdAmount Amount in USD
 * @returns Amount in RWF
 */
export async function convertUsdToRwf(usdAmount: number): Promise<number> {
  const rate = await fetchUsdToRwfRate();
  return Math.round(usdAmount * rate);
}

/**
 * Convert USD amount to RWF using provided rate
 * @param usdAmount Amount in USD
 * @param rate Exchange rate (RWF per USD)
 * @returns Amount in RWF
 */
export function convertUsdToRwfWithRate(usdAmount: number, rate: number): number {
  return Math.round(usdAmount * rate);
}
