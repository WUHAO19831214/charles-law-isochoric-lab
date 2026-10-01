import { ExperimentRecord, LinearFitResult } from '../types/physics';

/**
 * 计算线性拟合参数与统计量 (热力学温度 T/K)
 * 同时提供自由截距拟合 (p = kT + b) 和查理定律过原点拟合 (p = k0 * T)
 */
export function calculateLinearFit(records: ExperimentRecord[]): LinearFitResult {
  if (records.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      originSlope: 0,
      valid: false,
      message: '需要至少 2 个有效数据点才能进行线性拟合',
    };
  }

  const n = records.length;
  let sumT = 0;
  let sumP = 0;
  let sumT2 = 0;
  let sumTP = 0;
  let sumP2 = 0;

  for (const r of records) {
    sumT += r.temperature;
    sumP += r.pressure;
    sumT2 += r.temperature * r.temperature;
    sumTP += r.temperature * r.pressure;
    sumP2 += r.pressure * r.pressure;
  }

  const meanT = sumT / n;
  const meanP = sumP / n;

  // 自由拟合
  let ssTT = 0;
  let ssTP = 0;
  let ssPP = 0;

  for (const r of records) {
    const dt = r.temperature - meanT;
    const dp = r.pressure - meanP;
    ssTT += dt * dt;
    ssTP += dt * dp;
    ssPP += dp * dp;
  }

  if (Math.abs(ssTT) < 1e-10) {
    return {
      slope: 0,
      intercept: meanP,
      rSquared: 0,
      originSlope: meanT > 0 ? meanP / meanT : 0,
      valid: false,
      message: '温度变化幅度不足，无法建立拟合曲线',
    };
  }

  const slope = ssTP / ssTT;
  const intercept = meanP - slope * meanT;

  // 计算 R^2 (决定系数)
  let ssRes = 0;
  for (const r of records) {
    const pPred = slope * r.temperature + intercept;
    const diff = r.pressure - pPred;
    ssRes += diff * diff;
  }

  const rSquared = ssPP > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssPP)) : 1;

  // 严格过原点拟合 (p = k0 * T)
  const originSlope = sumT2 > 0 ? sumTP / sumT2 : 0;

  return {
    slope,
    intercept,
    rSquared,
    originSlope,
    valid: true,
  };
}

export interface CelsiusFitResult {
  slope: number;          // 斜率 k (kPa / ℃)
  interceptP0: number;    // 截距 p0 (0 ℃ 时的气体压强 kPa)
  rSquared: number;       // 决定系数 R^2
  absoluteZeroT0: number; // 外推绝对零度 (℃)，理论为 -273.15 ℃
  valid: boolean;
  message?: string;
}

/**
 * 计算摄氏温度拟合参数 (p = k * t + p0)
 * 并计算反向延长线与横轴 (p = 0) 的交点：绝对零度 t0 = -p0 / k
 */
export function calculateCelsiusFit(records: ExperimentRecord[]): CelsiusFitResult {
  if (records.length < 2) {
    return {
      slope: 0,
      interceptP0: 0,
      rSquared: 0,
      absoluteZeroT0: -273.15,
      valid: false,
      message: '需要至少 2 个有效数据点才能进行摄氏度拟合',
    };
  }

  const n = records.length;
  let sumt = 0;
  let sumP = 0;
  let sumt2 = 0;
  let sumtP = 0;
  let sumP2 = 0;

  for (const r of records) {
    sumt += r.celsius;
    sumP += r.pressure;
    sumt2 += r.celsius * r.celsius;
    sumtP += r.celsius * r.pressure;
    sumP2 += r.pressure * r.pressure;
  }

  const meant = sumt / n;
  const meanP = sumP / n;

  let sstt = 0;
  let sstP = 0;
  let ssPP = 0;

  for (const r of records) {
    const dt = r.celsius - meant;
    const dp = r.pressure - meanP;
    sstt += dt * dt;
    sstP += dt * dp;
    ssPP += dp * dp;
  }

  if (Math.abs(sstt) < 1e-10) {
    return {
      slope: 0,
      interceptP0: meanP,
      rSquared: 0,
      absoluteZeroT0: -273.15,
      valid: false,
      message: '摄氏温度变化幅度不足',
    };
  }

  const slope = sstP / sstt;
  const interceptP0 = meanP - slope * meant;

  let ssRes = 0;
  for (const r of records) {
    const pPred = slope * r.celsius + interceptP0;
    const diff = r.pressure - pPred;
    ssRes += diff * diff;
  }

  const rSquared = ssPP > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssPP)) : 1;
  const absoluteZeroT0 = Math.abs(slope) > 1e-6 ? -interceptP0 / slope : -273.15;

  return {
    slope,
    interceptP0,
    rSquared,
    absoluteZeroT0,
    valid: true,
  };
}

/**
 * 格式化数值展示
 */
export function formatNum(num: number, digits = 2): string {
  if (!Number.isFinite(num)) return '--';
  return num.toFixed(digits);
}

/**
 * 计算人类视觉友好的整洁刻度步长 (1, 2, 5 进制)
 */
export function calculateNiceStep(range: number, targetTicks = 6): number {
  if (range <= 0) return 10;
  const rawStep = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;

  let niceStep = magnitude;
  if (residual > 5) {
    niceStep = 10 * magnitude;
  } else if (residual > 2) {
    niceStep = 5 * magnitude;
  } else if (residual > 1) {
    niceStep = 2 * magnitude;
  }
  return niceStep;
}
