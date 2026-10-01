import { createWorker } from 'tesseract.js';

/**
 * 字符预清洗与字符混淆纠错
 * 继承自 physics-software-sensors/packages/typescript/src/ocr/number.ts
 */
export function normalizeOcrText(text: string): string {
  return text
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[，,]/g, '.')
    .replace(/：/g, ':');
}

export interface ExtractedReading {
  pressure: number | null;
  temperature: number | null;
  rawText: string;
}

/**
 * 从 OCR 原始识别文本中提取压强与温度
 * 针对如 "当前压强: 103.2 kPa 当前温度: 293.8 K" 等常见传感器格式专项优化
 * 增加词边界 \b 与物理量范围校验 (压强 50~300 kPa, 温度 200~450 K 或 -20~150 ℃)，彻底根除把杂散字母识别出的伪数字填入问题
 */
export function extractPressureAndTemperature(text: string): ExtractedReading {
  const clean = normalizeOcrText(text);
  let pressure: number | null = null;
  let temperature: number | null = null;

  // 1. 压强匹配：优先寻找紧挨 kPa/Pa 的数值，且必须处于合理物理气压区间 (50 ~ 300 kPa)
  const pMatches = [...clean.matchAll(/\b([+-]?(?:\d+\.\d+|\d+))\s*(?:kPa|kpa|KPa|Pa)\b/gi)];
  for (const m of pMatches) {
    const val = parseFloat(m[1]);
    if (!isNaN(val) && val >= 50 && val <= 300) {
      pressure = val;
      break;
    }
  }

  // 2. 温度匹配：优先寻找紧挨 K / ℃ / °C 的数值，且处于合理物理温度区间 (开尔文 200~450 或 摄氏度 -20~150)
  const tMatches = [...clean.matchAll(/\b([+-]?(?:\d+\.\d+|\d+))\s*(?:K|k|℃|°C)\b/g)];
  for (const m of tMatches) {
    const val = parseFloat(m[1]);
    if (!isNaN(val) && ((val >= 200 && val <= 450) || (val >= -20 && val <= 150))) {
      temperature = val;
      break;
    }
  }

  // 3. 中文冒号后关键字定位 (例如 "压强: 105.0", "温度: 298.9")
  if (pressure === null) {
    const pKey = clean.match(/(?:压强|强|P)[:\s]*\b([+-]?(?:\d+\.\d+|\d+))\b/i);
    if (pKey) {
      const val = parseFloat(pKey[1]);
      if (!isNaN(val) && val >= 50 && val <= 300) {
        pressure = val;
      }
    }
  }

  if (temperature === null) {
    const tKey = clean.match(/(?:温度|度|T)[:\s]*\b([+-]?(?:\d+\.\d+|\d+))\b/i);
    if (tKey) {
      const val = parseFloat(tKey[1]);
      if (!isNaN(val) && ((val >= 200 && val <= 450) || (val >= -20 && val <= 150))) {
        temperature = val;
      }
    }
  }

  // 4. 词边界独立浮点数兜底 (严格要求独立词边界 \b，绝不取 HE1SE 或 45188 等嵌入字母中的数字)
  if (pressure === null || temperature === null) {
    const standaloneNums = (clean.match(/\b[+-]?(?:\d+\.\d+|\d+)\b/g) || [])
      .map(Number)
      .filter((n) => !isNaN(n));

    // 压强优先在 50~200 kPa 范围内寻找
    if (pressure === null) {
      const pCandidate = standaloneNums.find((n) => n >= 50 && n <= 200 && n !== temperature);
      if (pCandidate !== undefined) {
        pressure = pCandidate;
      }
    }

    // 温度在 200~450 K 或 -20~150 ℃ 范围内寻找
    if (temperature === null) {
      const tCandidate = standaloneNums.find(
        (n) => n !== pressure && ((n >= 200 && n <= 450) || (n >= -20 && n <= 150))
      );
      if (tCandidate !== undefined) {
        temperature = tCandidate;
      }
    }
  }

  return { pressure, temperature, rawText: text };
}

export class OcrRecognizerService {
  private worker: any = null;
  private isInitializing = false;
  private isReady = false;

  public async init(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    try {
      this.worker = await createWorker('eng');
      await this.worker.setParameters({
        tessedit_pageseg_mode: '6', // 假设单一均匀文本块
      });
      this.isReady = true;
      this.isInitializing = false;
      return true;
    } catch (err) {
      console.warn('Tesseract OCR Worker 初始化失败，将切换至轻量正则解析模式:', err);
      this.isInitializing = false;
      return false;
    }
  }

  public async recognizeRoi(canvas: HTMLCanvasElement): Promise<{
    pressure: number | null;
    temperature: number | null;
    rawText: string;
    confidence: number;
  }> {
    if (!this.isReady || !this.worker) {
      return { pressure: null, temperature: null, rawText: '', confidence: 0 };
    }

    try {
      const res = await this.worker.recognize(canvas);
      const rawText = (res.data.text || '').trim();
      const extracted = extractPressureAndTemperature(rawText);

      return {
        pressure: extracted.pressure,
        temperature: extracted.temperature,
        rawText,
        confidence: (res.data.confidence || 85) / 100,
      };
    } catch (err) {
      console.error('OCR 识别执行失败:', err);
      return { pressure: null, temperature: null, rawText: '', confidence: 0 };
    }
  }

  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}
