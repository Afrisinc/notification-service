import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface HistogramValue {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
  labels: Record<string, string>;
}

class Counter {
  private values: Map<string, MetricValue> = new Map();

  constructor(
    public name: string,
    public help: string,
    public labelNames: string[] = []
  ) {}

  inc(labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.labelsToKey(labels);
    const current = this.values.get(key);
    if (current) {
      current.value += value;
      current.timestamp = Date.now();
    } else {
      this.values.set(key, { value, labels, timestamp: Date.now() });
    }
  }

  private labelsToKey(labels: Record<string, string>): string {
    return this.labelNames.map((name) => labels[name] || '').join('|');
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} counter\n`;

    for (const { value, labels } of this.values.values()) {
      const labelStr = this.formatLabels(labels);
      output += `${this.name}${labelStr} ${value}\n`;
    }

    return output;
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return pairs ? `{${pairs}}` : '';
  }

  reset(): void {
    this.values.clear();
  }
}

class Gauge {
  private values: Map<string, MetricValue> = new Map();

  constructor(
    public name: string,
    public help: string,
    public labelNames: string[] = []
  ) {}

  set(labels: Record<string, string>, value: number): void {
    const key = this.labelsToKey(labels);
    this.values.set(key, { value, labels, timestamp: Date.now() });
  }

  inc(labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.labelsToKey(labels);
    const current = this.values.get(key);
    const newValue = (current?.value || 0) + value;
    this.values.set(key, { value: newValue, labels, timestamp: Date.now() });
  }

  dec(labels: Record<string, string> = {}, value: number = 1): void {
    this.inc(labels, -value);
  }

  private labelsToKey(labels: Record<string, string>): string {
    return this.labelNames.map((name) => labels[name] || '').join('|');
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} gauge\n`;

    for (const { value, labels } of this.values.values()) {
      const labelStr = this.formatLabels(labels);
      output += `${this.name}${labelStr} ${value}\n`;
    }

    return output;
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return pairs ? `{${pairs}}` : '';
  }
}

class Histogram {
  private values: Map<string, HistogramValue> = new Map();
  private buckets: number[];

  constructor(
    public name: string,
    public help: string,
    public labelNames: string[] = [],
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(labels: Record<string, string>, value: number): void {
    const key = this.labelsToKey(labels);
    let histogram = this.values.get(key);

    if (!histogram) {
      histogram = {
        buckets: this.buckets.map((le) => ({ le, count: 0 })),
        sum: 0,
        count: 0,
        labels,
      };
      this.values.set(key, histogram);
    }

    histogram.sum += value;
    histogram.count += 1;

    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count += 1;
      }
    }
  }

  private labelsToKey(labels: Record<string, string>): string {
    return this.labelNames.map((name) => labels[name] || '').join('|');
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} histogram\n`;

    for (const histogram of this.values.values()) {
      const labelStr = this.formatLabels(histogram.labels);
      const baseLabelStr = labelStr ? labelStr.slice(0, -1) + ',' : '{';

      for (const bucket of histogram.buckets) {
        output += `${this.name}_bucket${baseLabelStr}le="${bucket.le}"} ${bucket.count}\n`;
      }
      output += `${this.name}_bucket${baseLabelStr}le="+Inf"} ${histogram.count}\n`;
      output += `${this.name}_sum${labelStr} ${histogram.sum}\n`;
      output += `${this.name}_count${labelStr} ${histogram.count}\n`;
    }

    return output;
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return pairs ? `{${pairs}}` : '';
  }
}

export const metrics = {
  httpRequestsTotal: new Counter('http_requests_total', 'Total number of HTTP requests', [
    'method',
    'route',
    'status_code',
  ]),

  httpRequestDuration: new Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'route'],
    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ),

  notificationsSent: new Counter('notifications_sent_total', 'Total notifications sent', ['channel', 'status']),

  notificationDuration: new Histogram(
    'notification_processing_duration_seconds',
    'Notification processing duration',
    ['channel'],
    [0.1, 0.5, 1, 2, 5, 10, 30]
  ),

  activeConnections: new Gauge('active_connections', 'Number of active connections', ['type']),

  queueSize: new Gauge('queue_size', 'Current queue size', ['queue']),

  rateLimitHits: new Counter('rate_limit_hits_total', 'Rate limit hits', ['endpoint']),

  circuitBreakerState: new Gauge('circuit_breaker_state', 'Circuit breaker state (0=closed, 1=open, 2=half-open)', [
    'name',
  ]),

  usageLimitExceeded: new Counter('usage_limit_exceeded_total', 'Usage limit exceeded events', ['metric', 'account']),

  dbQueryDuration: new Histogram(
    'db_query_duration_seconds',
    'Database query duration',
    ['operation'],
    [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
  ),

  externalApiCalls: new Counter('external_api_calls_total', 'External API calls', ['provider', 'status']),

  externalApiDuration: new Histogram(
    'external_api_duration_seconds',
    'External API call duration',
    ['provider'],
    [0.1, 0.5, 1, 2, 5, 10]
  ),
};

function collectAll(): string {
  const startTime = process.hrtime.bigint();
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  let output = '';

  output += `# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds\n`;
  output += `# TYPE process_cpu_user_seconds_total counter\n`;
  output += `process_cpu_user_seconds_total ${cpuUsage.user / 1e6}\n`;

  output += `# HELP process_cpu_system_seconds_total Total system CPU time spent in seconds\n`;
  output += `# TYPE process_cpu_system_seconds_total counter\n`;
  output += `process_cpu_system_seconds_total ${cpuUsage.system / 1e6}\n`;

  output += `# HELP process_resident_memory_bytes Resident memory size in bytes\n`;
  output += `# TYPE process_resident_memory_bytes gauge\n`;
  output += `process_resident_memory_bytes ${memUsage.rss}\n`;

  output += `# HELP process_heap_bytes Process heap size in bytes\n`;
  output += `# TYPE process_heap_bytes gauge\n`;
  output += `process_heap_bytes ${memUsage.heapUsed}\n`;

  output += `# HELP nodejs_eventloop_lag_seconds The event loop lag in seconds\n`;
  output += `# TYPE nodejs_eventloop_lag_seconds gauge\n`;
  const lag = Number(process.hrtime.bigint() - startTime) / 1e9;
  output += `nodejs_eventloop_lag_seconds ${lag}\n`;

  for (const metric of Object.values(metrics)) {
    output += metric.collect();
  }

  return output;
}

export async function registerMetricsPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    (request as any).startTime = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as any).startTime as bigint;
    if (startTime) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
      const route = request.routeOptions?.url || request.url;

      metrics.httpRequestsTotal.inc({
        method: request.method,
        route,
        status_code: reply.statusCode.toString(),
      });

      metrics.httpRequestDuration.observe({ method: request.method, route }, duration);
    }
  });

  fastify.get(
    '/metrics',
    {
      schema: {
        hide: true,
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Content-Type', 'text/plain; charset=utf-8');
      return collectAll();
    }
  );
}

export { Counter, Gauge, Histogram };
