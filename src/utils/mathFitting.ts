import { ExperimentRecord, LinearFitResult } from '../types/physics';

/**
 * 计算线性拟合参数与统计量
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

/**
 * 格式化数值展示
 */
export function formatNum(num: number, digits = 2): string {
  if (!Number.isFinite(num)) return '--';
  return num.toFixed(digits);
}
