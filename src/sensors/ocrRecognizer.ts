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
 * 能够完美过滤因中文字符被误识别为数字（如 "当前温度" 被误认为 S188: 或 45188:）的干扰
 */
export function extractPressureAndTemperature(text: string): ExtractedReading {
  const clean = normalizeOcrText(text);
  let pressure: number | null = null;
  let temperature: number | null = null;

  // 1. 优先通过单位精确锁定 (最高置信度)
  // 压强: 匹配 kPa / kpa / KPa / Pa 前面的数值
  const pUnitMatch = clean.match(/([+-]?(?:\d+\.\d+|\d+))\s*(?:kPa|kpa|KPa|Pa)\b/i);
  if (pUnitMatch) {
    const val = parseFloat(pUnitMatch[1]);
    if (!isNaN(val) && val > 10 && val < 500) {
      pressure = val;
    }
  }

  // 温度: 匹配 K / k / ℃ / °C / C 前面的数值 (过滤掉可能连着的单词)
  const tUnitMatch = clean.match(/([+-]?(?:\d+\.\d+|\d+))\s*(?:K|k|℃|°C|C)\b/);
  if (tUnitMatch) {
    const val = parseFloat(tUnitMatch[1]);
    if (!isNaN(val) && val > -50 && val < 600) {
      temperature = val;
    }
  }

  // 2. 如果未通过单位匹配到，尝试通过显式关键字定位
  if (pressure === null) {
    const pKeyMatch = clean.match(/(?:压强|强|P|p)[:\s]*([+-]?(?:\d+\.\d+|\d+))/i);
    if (pKeyMatch) {
      const val = parseFloat(pKeyMatch[1]);
      if (!isNaN(val) && val > 10 && val < 500) {
        pressure = val;
      }
    }
  }

  if (temperature === null) {
    const tKeyMatch = clean.match(/(?:温度|度|T|t)[:\s]*([+-]?(?:\d+\.\d+|\d+))/i);
    if (tKeyMatch) {
      const val = parseFloat(tKeyMatch[1]);
      if (!isNaN(val) && val > -50 && val < 600) {
        temperature = val;
      }
    }
  }

  // 3. 针对 ": 293.8" 这类跟在中文冒号或乱码标签后的浮点数
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

  // 4. 容错兜底: 提取所有合理的实数 (排除 > 600 的异常干扰数如 45188)
  if (pressure === null || temperature === null) {
    const allNums = (clean.match(/[+-]?(?:\d+\.\d+|\d+)/g) || [])
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0 && n < 600);

    // 优先带小数点的候选
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
