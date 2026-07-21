export interface CheckResult {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}
