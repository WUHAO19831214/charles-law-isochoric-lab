import assert from 'node:assert';

console.log('🧪 开始物理核心计算与数据处理自动化单元测试...');

// 1. OCR 字符清洗与数字提取测试
function normalizeOcrText(text) {
  return text
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[，,]/g, '.')
    .replace(/：/g, ':');
}

function extractPressureAndTemperature(text) {
  const clean = normalizeOcrText(text);
  let pressure = null;
  let temperature = null;

  // 1. 优先通过单位精确锁定
  const pUnitMatch = clean.match(/([+-]?(?:\d+\.\d+|\d+))\s*(?:kPa|kpa|KPa|Pa)\b/i);
  if (pUnitMatch) {
    const val = parseFloat(pUnitMatch[1]);
    if (!isNaN(val) && val > 10 && val < 500) {
      pressure = val;
    }
  }

  const tUnitMatch = clean.match(/([+-]?(?:\d+\.\d+|\d+))\s*(?:K|k|℃|°C|C)\b/);
  if (tUnitMatch) {
    const val = parseFloat(tUnitMatch[1]);
    if (!isNaN(val) && val > -50 && val < 600) {
      temperature = val;
    }
  }

  // 2. 关键字定位
  if (pressure === null) {
    const pKeyMatch = clean.match(/(?:压强|强|P|p)[:\s]*([+-]?(?:\d+\.\d+|\d+))/i);
    if (pKeyMatch) {
      const val = parseFloat(pKeyMatch[1]);
      if (!isNaN(val) && val > 10 && val < 500) pressure = val;
    }
  }

  if (temperature === null) {
    const tKeyMatch = clean.match(/(?:温度|度|T|t)[:\s]*([+-]?(?:\d+\.\d+|\d+))/i);
    if (tKeyMatch) {
      const val = parseFloat(tKeyMatch[1]);
      if (!isNaN(val) && val > -50 && val < 600) temperature = val;
    }
  }

  // 3. 冒号后浮点数定位
  if (temperature === null) {
    const colonMatches = [...clean.matchAll(/[:：]\s*([+-]?(?:\d+\.\d+|\d+))/g)];
    for (const m of colonMatches) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > -50 && val < 600 && val !== pressure) {
        temperature = val;
        break;
      }
    }
  }

  // 4. 容错候选
  if (pressure === null || temperature === null) {
    const allNums = (clean.match(/[+-]?(?:\d+\.\d+|\d+)/g) || [])
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0 && n < 600);

    const withDecimals = allNums.filter((n) => !Number.isInteger(n));
    const candidates = withDecimals.length >= 2 ? withDecimals : allNums;

    if (pressure === null && candidates.length > 0) {
      pressure = candidates[0];
    }
    if (temperature === null && candidates.length > 1) {
      const second = candidates.find((c) => c !== pressure) || candidates[1];
      temperature = second;
    }
  }

  return { pressure, temperature, rawText: text };
}

{
  console.log('1. 测试真实 DISLab 截图中双参提取 (针对 S188: / 45188: 干扰):');
  // 用户提供的两张实际报错截图中的 OCR 原文
  const res1 = extractPressureAndTemperature('103.2 kPa S188: 293.8 K R=,');
  assert.strictEqual(res1.pressure, 103.2);
  assert.strictEqual(res1.temperature, 293.8);

  const res2 = extractPressureAndTemperature('105.0 kPa 45188: 298.9 K R=,');
  assert.strictEqual(res2.pressure, 105.0);
  assert.strictEqual(res2.temperature, 298.9);

  const res3 = extractPressureAndTemperature('当前压强: 103.2 kPa 当前温度: 293.8 K');
  assert.strictEqual(res3.pressure, 103.2);
  assert.strictEqual(res3.temperature, 293.8);

  console.log('   ✅ 真实截图测试通过: 成功过滤中文字符混淆数字，精准抽取 103.2 kPa 与 293.8 K');
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

// 4. 测试摄氏度拟合与反向外推绝对零度
function calculateCelsiusFit(records) {
  const n = records.length;
  let sumt = 0, sumP = 0, sumt2 = 0, sumtP = 0, sumP2 = 0;
  for (const r of records) {
    sumt += r.celsius;
    sumP += r.pressure;
    sumt2 += r.celsius * r.celsius;
    sumtP += r.celsius * r.pressure;
    sumP2 += r.pressure * r.pressure;
  }
  const meant = sumt / n;
  const meanP = sumP / n;
  let sstt = 0, sstP = 0, ssPP = 0;
  for (const r of records) {
    const dt = r.celsius - meant;
    const dp = r.pressure - meanP;
    sstt += dt * dt;
    sstP += dt * dp;
    ssPP += dp * dp;
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
  return { slope, interceptP0, rSquared, absoluteZeroT0, valid: true };
}

{
  console.log('4. 测试摄氏度拟合与绝对零度外推:');
  const celsiusRecords = [
    { celsius: 20.0, pressure: 101.14 },
    { celsius: 40.0, pressure: 108.04 },
    { celsius: 60.0, pressure: 114.94 },
    { celsius: 80.0, pressure: 121.84 },
  ];
  const cFit = calculateCelsiusFit(celsiusRecords);
  assert.strictEqual(cFit.valid, true);
  assert(Math.abs(cFit.absoluteZeroT0 - (-273.15)) < 0.2, `外推绝对零度误差: ${cFit.absoluteZeroT0}`);
  console.log(`   ✅ 摄氏度拟合通过: 斜率 k=${cFit.slope.toFixed(4)}, p0=${cFit.interceptP0.toFixed(2)} kPa, 反向外推绝对零度 t0=${cFit.absoluteZeroT0.toFixed(2)} ℃ (误差 < 0.2℃)`);
}

// 5. 测试坐标轴刻度整洁算法
function calculateNiceStep(range, targetTicks = 6) {
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

{
  console.log('5. 测试自适应缩放刻度步长:');
  const step1 = calculateNiceStep(100, 5); // 20
  const step2 = calculateNiceStep(25, 5);  // 5
  const step3 = calculateNiceStep(350, 7); // 50
  assert.strictEqual(step1, 20);
  assert.strictEqual(step2, 5);
  assert.strictEqual(step3, 50);
  console.log(`   ✅ 刻度步长计算正确: 100/5 -> ${step1}, 25/5 -> ${step2}, 350/7 -> ${step3}`);
}


console.log('🎉 全部物理核心与数据算法单元测试验证通过！');
