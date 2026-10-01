import { SensorReading } from '../types/physics';

/**
 * 教学实验高保真模拟发生器
 * 模拟等容加热水浴升温过程，完全遵循查理定律与真实传感器测量噪声
 */
export class MockDataGenerator {
  private isRunning = false;
  private intervalId: number | null = null;
  private baseT = 293.15; // 初始室温 20 ℃ (293.15 K)
  private currentT = 293.15;
  private p0 = 101.32;    // 初始标准压强 (kPa)
  private heatingRate = 0.6; // 升温速率 K/s
  private onUpdateCallback: ((reading: SensorReading) => void) | null = null;

  constructor(onUpdate?: (reading: SensorReading) => void) {
    if (onUpdate) this.onUpdateCallback = onUpdate;
  }

  public setCallback(cb: (reading: SensorReading) => void): void {
    this.onUpdateCallback = cb;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalId = window.setInterval(() => {
      // 升温至 375 K (约 102 ℃) 后保持微幅热平衡扰动
      if (this.currentT < 375) {
        this.currentT += this.heatingRate * (0.8 + Math.random() * 0.4);
      } else {
        this.currentT += (Math.random() - 0.5) * 0.1;
      }

      const reading = this.generateCurrentReading();
      if (this.onUpdateCallback) {
        this.onUpdateCallback(reading);
      }
    }, 1000);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  public reset(initialTempK = 293.15): void {
    this.currentT = initialTempK;
    const reading = this.generateCurrentReading();
    if (this.onUpdateCallback) {
      this.onUpdateCallback(reading);
    }
  }

  public setManualTemperature(tempK: number): void {
    this.currentT = Math.max(100, Math.min(600, tempK));
    const reading = this.generateCurrentReading();
    if (this.onUpdateCallback) {
      this.onUpdateCallback(reading);
    }
  }

  public generateCurrentReading(): SensorReading {
    // 查理定律: p / T = p0 / T0 => p = p0 * (T / T0) + 高斯传感器噪声
    const noise = (Math.random() - 0.5) * 0.25;
    const p = this.p0 * (this.currentT / this.baseT) + noise;
    const celsius = this.currentT - 273.15;

    return {
      pressure: Number(p.toFixed(2)),
      temperature: Number(this.currentT.toFixed(2)),
      celsius: Number(celsius.toFixed(2)),
      volume: 50.0,
      status: 'valid',
      confidence: 0.98,
      lastUpdated: Date.now(),
      statusMessage: '模拟信号发生器正常',
    };
  }

  public get running(): boolean {
    return this.isRunning;
  }

  public get currentTemp(): number {
    return this.currentT;
  }
}
