import assert from 'node:assert';

console.log('🧪 开始物理核心计算与数据处理自动化单元测试...');

// 1. OCR 字符清洗与数字提取测试
function normalizeOcrText(text) {
  return text
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/[，,]/g, '.')
    .replace(/\s+/g, '')
    .replace(/[^0-9+\-.]/g, '');
}

function extractNumberFromText(text) {
  const DECIMAL_NUMBER = /[+-]?(?:(?:\d+\.\d*)|(?:\d*\.\d+)|(?:\d+))/g;
  const normalized = normalizeOcrText(text);
  const matches = normalized.match(DECIMAL_NUMBER);
  if (!matches || matches.length === 0) return null;

  const candidates = matches
    .map((candidate) => ({ text: candidate, value: Number(candidate) }))
    .filter((candidate) => Number.isFinite(candidate.value))
    .sort((left, right) => {
      const leftHasDecimal = left.text.includes('.') ? 1 : 0;
      const rightHasDecimal = right.text.includes('.') ? 1 : 0;
      const leftLength = left.text.replace(/[+-.]/g, '').length;
      const rightLength = right.text.replace(/[+-.]/g, '').length;
      return rightHasDecimal - leftHasDecimal || rightLength - leftLength;
    });

  const val = candidates[0]?.value;
  return val !== undefined && Number.isFinite(val) ? val : null;
}

{
  console.log('1. 测试 OCR 字符清洗与浮点数提取:');
  assert.strictEqual(normalizeOcrText('lO3.2 kPa'), '103.2');
  assert.strictEqual(normalizeOcrText('293，8 K'), '293.8');
  assert.strictEqual(normalizeOcrText('p = S8.4'), '58.4');

  assert.strictEqual(extractNumberFromText('当前压强: 103.2 kPa'), 103.2);
  assert.strictEqual(extractNumberFromText('当前温度: 293.8 K'), 293.8);
  assert.strictEqual(extractNumberFromText('Temp: 25.4 C'), 25.4);
  console.log('   ✅ OCR 纠错与数字提取测试通过');
}

// 2. 查理定律最小二乘线性拟合与过原点约束
function calculateLinearFit(records) {
  if (records.length < 2) return { valid: false };
  const n = records.length;
  let sumT = 0, sumP = 0, sumT2 = 0, sumTP = 0, sumP2 = 0;
  for (const r of records) {
    sumT += r.temperature;
    sumP += r.pressure;
    sumT2 += r.temperature * r.temperature;
    sumTP += r.temperature * r.pressure;
    sumP2 += r.pressure * r.pressure;
  }
  const meanT = sumT / n;
  const meanP = sumP / n;
  let ssTT = 0, ssTP = 0, ssPP = 0;
  for (const r of records) {
    const dt = r.temperature - meanT;
    const dp = r.pressure - meanP;
    ssTT += dt * dt;
    ssTP += dt * dp;
    ssPP += dp * dp;
  }
  const slope = ssTP / ssTT;
  const intercept = meanP - slope * meanT;
  let ssRes = 0;
  for (const r of records) {
    const pPred = slope * r.temperature + intercept;
    const diff = r.pressure - pPred;
    ssRes += diff * diff;
  }
  const rSquared = ssPP > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssPP)) : 1;
  const originSlope = sumT2 > 0 ? sumTP / sumT2 : 0;
  return { slope, intercept, rSquared, originSlope, valid: true };
}

{
  console.log('2. 测试线性拟合与查理定律验证:');
  const testRecords = [
    { temperature: 293.15, pressure: 101.14 },
    { temperature: 313.15, pressure: 108.04 },
    { temperature: 333.15, pressure: 114.94 },
    { temperature: 353.15, pressure: 121.84 },
  ];

  const fit = calculateLinearFit(testRecords);
  assert.strictEqual(fit.valid, true);
  assert(Math.abs(fit.slope - 0.345) < 0.005, `斜率误差: ${fit.slope}`);
  assert(fit.rSquared > 0.999, `R^2 应接近 1: ${fit.rSquared}`);
  assert(Math.abs(fit.originSlope - 0.345) < 0.005, `过原点斜率: ${fit.originSlope}`);
  console.log(`   ✅ 查理定律拟合通过: 斜率 k=${fit.slope.toFixed(4)}, R²=${fit.rSquared.toFixed(4)}`);
}

// 3. 麦克斯韦-玻尔兹曼物理采样与分布
const REFERENCE_TEMP = 300;
const BASE_SIGMA = 1.6;

function randomGaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function sampleMaxwellVelocity(temp) {
  const sigma = BASE_SIGMA * Math.sqrt(temp / REFERENCE_TEMP);
  return [randomGaussian() * sigma, randomGaussian() * sigma, randomGaussian() * sigma];
}

function getTheoreticalVrms(temp) {
  const sigma = BASE_SIGMA * Math.sqrt(temp / REFERENCE_TEMP);
  return Math.sqrt(3) * sigma;
}

{
  console.log('3. 测试麦克斯韦-玻尔兹曼速率分布与采样:');
  const temp = 300;
  const vRmsTheory = getTheoreticalVrms(temp);

  const N = 8000;
  let sumV2 = 0;
  for (let i = 0; i < N; i++) {
    const [vx, vy, vz] = sampleMaxwellVelocity(temp);
    sumV2 += vx * vx + vy * vy + vz * vz;
  }
  const sampleVrms = Math.sqrt(sumV2 / N);
  const relativeErr = Math.abs(sampleVrms - vRmsTheory) / vRmsTheory;
  assert(relativeErr < 0.04, `采样 v_rms 相对误差过大: ${relativeErr}`);
  console.log(`   ✅ 采样 v_rms=${sampleVrms.toFixed(3)}, 理论 v_rms=${vRmsTheory.toFixed(3)}, 误差 ${(relativeErr * 100).toFixed(2)}% (小于 4%)`);
}

console.log('🎉 全部物理核心与数据算法单元测试验证通过！');
