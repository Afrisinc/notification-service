export interface Kpi {
  value: string;
  delta: string;
  deltaUp: boolean;
}

export function buildCountKpi(current: number, prev: number, formatValue: (n: number) => string): Kpi {
  let pctChange = 0;
  if (prev > 0) {
    pctChange = ((current - prev) / prev) * 100;
  } else if (current > 0) {
    pctChange = 100;
  }

  return {
    value: formatValue(current),
    delta: `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% vs prev`,
    deltaUp: pctChange >= 0,
  };
}

export function buildRateKpi(current: number, prev: number): Kpi {
  const pointsChange = current - prev;
  return {
    value: `${current.toFixed(1)}%`,
    delta: `${pointsChange >= 0 ? '+' : ''}${pointsChange.toFixed(1)}% vs prev`,
    deltaUp: pointsChange >= 0,
  };
}
