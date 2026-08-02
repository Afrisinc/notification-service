import { env } from '../config/env';
import { logger } from '../config/logger';

const FALLBACK_RATE = env.USDEXCHANGE_RATE ? Number.parseFloat(env.USDEXCHANGE_RATE) : 1450;
const CACHE_DURATION_MS = 60 * 60 * 1000;

export interface ExchangeRateData {
  rate: number;
  baseCode: string;
  targetCode: string;
  timestamp: number;
}

interface CachedRateData {
  data: ExchangeRateData;
  cacheTime: number;
}

let cachedRate: CachedRateData | null = null;

export async function fetchUsdToRwfRateWithMetadata(): Promise<ExchangeRateData> {
  try {
    if (cachedRate && Date.now() - cachedRate.cacheTime < CACHE_DURATION_MS) {
      logger.debug({ rate: cachedRate.data.rate }, 'Using cached exchange rate');
      return cachedRate.data;
    }

    const apiKey = env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
      logger.debug('EXCHANGE_RATE_API_KEY not configured, using fallback rate');
      return {
        rate: FALLBACK_RATE,
        baseCode: 'USD',
        targetCode: 'RWF',
        timestamp: Date.now(),
      };
    }

    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/RWF`;
    const response = await fetch(url, { timeout: 5000 } as any);
    const data = await response.json();

    if (data.result === 'success' && data.conversion_rate) {
      const rate = Math.round(data.conversion_rate);
      const rateData: ExchangeRateData = {
        rate,
        baseCode: data.base_code || 'USD',
        targetCode: data.target_code || 'RWF',
        timestamp: data.time_last_update_unix ? data.time_last_update_unix * 1000 : Date.now(),
      };
      cachedRate = { data: rateData, cacheTime: Date.now() };
      logger.info(
        { rate, baseCode: rateData.baseCode, targetCode: rateData.targetCode },
        'Fetched exchange rate from API'
      );
      return rateData;
    }

    logger.warn({ error: data.error }, 'Invalid exchange rate response, using fallback');
    return {
      rate: FALLBACK_RATE,
      baseCode: 'USD',
      targetCode: 'RWF',
      timestamp: Date.now(),
    };
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch exchange rate from API, using fallback');
    return {
      rate: FALLBACK_RATE,
      baseCode: 'USD',
      targetCode: 'RWF',
      timestamp: Date.now(),
    };
  }
}

export async function fetchUsdToRwfRate(): Promise<number> {
  const rateData = await fetchUsdToRwfRateWithMetadata();
  return rateData.rate;
}

export async function convertUsdToRwf(usdAmount: number): Promise<{ amountRWF: number; rateData: ExchangeRateData }> {
  const rateData = await fetchUsdToRwfRateWithMetadata();
  const amountRWF = Math.round(usdAmount * rateData.rate);
  return { amountRWF, rateData };
}

export function convertUsdToRwfWithRate(usdAmount: number, rate: number): number {
  return Math.round(usdAmount * rate);
}
