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
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/[，,]/g, '.')
    .replace(/\s+/g, '')
    .replace(/[^0-9+\-.]/g, '');
}

/**
 * 从 OCR 原始识别文本中提取最可信的数字浮点值
 */
export function extractNumberFromText(text: string): number | null {
  const normalized = normalizeOcrText(text);
  const matches = normalized.match(DECIMAL_NUMBER);
  if (!matches || matches.length === 0) return null;

  const candidates = matches
    .map((candidate) => ({ text: candidate, value: Number(candidate) }))
    .filter((candidate) => Number.isFinite(candidate.value))
    .sort((left, right) => {
      // 优先选带小数点的数值，其次选长度合理的数值
      const leftHasDecimal = left.text.includes('.') ? 1 : 0;
      const rightHasDecimal = right.text.includes('.') ? 1 : 0;
      const leftLength = left.text.replace(/[+-.]/g, '').length;
      const rightLength = right.text.replace(/[+-.]/g, '').length;
      return rightHasDecimal - leftHasDecimal || rightLength - leftLength;
    });

  const val = candidates[0]?.value;
  return val !== undefined && Number.isFinite(val) ? val : null;
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
      // 设置白名单与数字识别模式
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789.+-kPakPKC ',
        tessedit_pageseg_mode: '7', // 单行文本识别
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

  public async recognizeNumber(canvas: HTMLCanvasElement): Promise<{ value: number | null; raw: string; confidence: number }> {
    if (!this.isReady || !this.worker) {
      return { value: null, raw: '', confidence: 0 };
    }

    try {
      const res = await this.worker.recognize(canvas);
      const rawText = res.data.text.trim();
      const num = extractNumberFromText(rawText);
      return {
        value: num,
        raw: rawText,
        confidence: (res.data.confidence || 80) / 100,
      };
    } catch (err) {
      console.error('OCR 识别执行失败:', err);
      return { value: null, raw: '', confidence: 0 };
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
