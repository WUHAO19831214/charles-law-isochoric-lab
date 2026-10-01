import { createWorker } from 'tesseract.js';

const DECIMAL_NUMBER = /[+-]?(?:(?:\d+\.\d*)|(?:\d*\.\d+)|(?:\d+))/g;

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
 */
export function extractPressureAndTemperature(text: string): ExtractedReading {
  const clean = normalizeOcrText(text);
  let pressure: number | null = null;
  let temperature: number | null = null;

  // 1. 尝试显式关键字匹配
  const pMatch = clean.match(/(?:压强|强|P|p)[:\s]*([+-]?(?:\d+\.\d+|\d+))\s*(?:kPa|kpa)?/i);
  if (pMatch && pMatch[1]) {
    const val = parseFloat(pMatch[1]);
    if (!isNaN(val)) pressure = val;
  }

  const tMatch = clean.match(/(?:温度|度|T|t)[:\s]*([+-]?(?:\d+\.\d+|\d+))\s*(?:K|k|℃|°C)?/i);
  if (tMatch && tMatch[1]) {
    const val = parseFloat(tMatch[1]);
    if (!isNaN(val)) temperature = val;
  }

  // 2. 如果未匹配到关键字，则按浮点数序列提取
  const nums = clean.match(DECIMAL_NUMBER);
  if (nums && nums.length > 0) {
    const floatList = nums
      .map((n) => parseFloat(n))
      .filter((n) => !isNaN(n) && Math.abs(n) > 0.001);

    if (floatList.length >= 2) {
      if (pressure === null) pressure = floatList[0];
      if (temperature === null) temperature = floatList[1];
    } else if (floatList.length === 1) {
      if (pressure === null && temperature === null) {
        // 单个数值根据通常物理范围判断
        if (floatList[0] > 180) {
          temperature = floatList[0];
        } else {
          pressure = floatList[0];
        }
      } else if (pressure === null) {
        pressure = floatList[0];
      } else if (temperature === null) {
        temperature = floatList[0];
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
      // 设置宽松的识别模式，避免因中文丢弃数字和符号
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
