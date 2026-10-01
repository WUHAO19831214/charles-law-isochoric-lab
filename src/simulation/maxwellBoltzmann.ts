/**
 * 麦克斯韦-玻尔兹曼 (Maxwell-Boltzmann) 速率分布计算引擎
 * 严格基于统计物理热力学原理：
 * 3D 独立正态分布分量 -> 合速度模长严格服从麦克斯韦速率分布
 */

// 物理参考常数 (以可视仿真实用单位标定)
const REFERENCE_TEMP = 300; // 参考基准温度 (K)
const BASE_SIGMA = 1.6;     // 基准速度分量标准差 (units/s)

/**
 * 利用 Box-Muller 变换生成标准正态分布随机数 N(0, 1)
 */
function randomGaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * 根据温度 T 采样一个三维速度矢量 (vx, vy, vz)
 * 其速率 |v| 严格服从麦克斯韦-玻尔兹曼分布
 */
export function sampleMaxwellVelocity(temperature: number): [number, number, number] {
  const safeT = Math.max(1, temperature);
  // σ ∝ sqrt(T)
  const sigma = BASE_SIGMA * Math.sqrt(safeT / REFERENCE_TEMP);

  const vx = randomGaussian() * sigma;
  const vy = randomGaussian() * sigma;
  const vz = randomGaussian() * sigma;

  return [vx, vy, vz];
}

/**
 * 理论方均根速率 (Root-mean-square speed: v_rms = sqrt(3) * sigma ∝ sqrt(T))
 */
export function getTheoreticalVrms(temperature: number): number {
  const safeT = Math.max(1, temperature);
  const sigma = BASE_SIGMA * Math.sqrt(safeT / REFERENCE_TEMP);
  return Math.sqrt(3) * sigma;
}

/**
 * 理论最概然速率 (Most probable speed: v_p = sqrt(2) * sigma)
 */
export function getTheoreticalVp(temperature: number): number {
  const safeT = Math.max(1, temperature);
  const sigma = BASE_SIGMA * Math.sqrt(safeT / REFERENCE_TEMP);
  return Math.sqrt(2) * sigma;
}

/**
 * 理论平均速率 (Mean speed: v_avg = sqrt(8 / pi) * sigma)
 */
export function getTheoreticalVavg(temperature: number): number {
  const safeT = Math.max(1, temperature);
  const sigma = BASE_SIGMA * Math.sqrt(safeT / REFERENCE_TEMP);
  return Math.sqrt(8 / Math.PI) * sigma;
}

/**
 * 计算麦克斯韦概率密度函数 f(v) 的理论值
 * f(v) = 4π * (1 / (2π σ^2))^(3/2) * v^2 * exp(-v^2 / (2 σ^2))
 */
export function maxwellPdf(v: number, temperature: number): number {
  if (v <= 0) return 0;
  const safeT = Math.max(1, temperature);
  const sigma = BASE_SIGMA * Math.sqrt(safeT / REFERENCE_TEMP);
  const sigma2 = sigma * sigma;
  const factor = Math.sqrt(2 / Math.PI) / (sigma2 * sigma);
  return factor * v * v * Math.exp(-(v * v) / (2 * sigma2));
}

/**
 * 生成麦克斯韦理论分布曲线点 (供图表展示教学)
 */
export function generateMaxwellCurve(temperature: number, maxV = 10, steps = 50): { v: number; p: number }[] {
  const points: { v: number; p: number }[] = [];
  const dv = maxV / steps;
  for (let i = 0; i <= steps; i++) {
    const v = i * dv;
    const p = maxwellPdf(v, temperature);
    points.push({ v: Number(v.toFixed(2)), p: Number(p.toFixed(4)) });
  }
  return points;
}
