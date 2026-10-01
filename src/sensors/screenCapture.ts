/**
 * 屏幕/窗口捕获驱动 (复用 physics-software-sensors 契约与机制)
 */
export interface CapturedRoiFrame {
  pressureCanvas: HTMLCanvasElement | null;
  temperatureCanvas: HTMLCanvasElement | null;
  fullCanvas: HTMLCanvasElement;
  timestamp: number;
}

export class ScreenCaptureManager {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isCapturing = false;

  public async startCapture(): Promise<boolean> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('当前浏览器不支持屏幕捕获 API (getDisplayMedia)');
    }

    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
          frameRate: { ideal: 15, max: 30 },
        },
        audio: false,
      });

      this.video = document.createElement('video');
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.srcObject = this.stream;
      await this.video.play();

      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.isCapturing = true;

      // 监听用户点击浏览器原生“停止共享”
      this.stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopCapture();
      });

      return true;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.warn('用户取消了屏幕共享授权');
      } else {
        console.error('屏幕捕获启动失败:', err);
      }
      this.stopCapture();
      return false;
    }
  }

  public stopCapture(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.isCapturing = false;
  }

  public get active(): boolean {
    return this.isCapturing && this.stream !== null && this.stream.active;
  }

  /**
   * 截取当前帧画面并裁切 ROI 区域
   */
  public captureFrame(
    pressureRoi: { x: number; y: number; width: number; height: number },
    temperatureRoi: { x: number; y: number; width: number; height: number }
  ): CapturedRoiFrame | null {
    if (!this.active || !this.video || !this.ctx || !this.canvas) return null;
    if (this.video.videoWidth === 0 || this.video.videoHeight === 0) return null;

    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    this.canvas.width = w;
    this.canvas.height = h;

    this.ctx.drawImage(this.video, 0, 0, w, h);

    // 裁切压强 ROI
    const pCanvas = document.createElement('canvas');
    pCanvas.width = Math.max(10, Math.floor(pressureRoi.width * w));
    pCanvas.height = Math.max(10, Math.floor(pressureRoi.height * h));
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      pCtx.drawImage(
        this.canvas,
        pressureRoi.x * w,
        pressureRoi.y * h,
        pressureRoi.width * w,
        pressureRoi.height * h,
        0,
        0,
        pCanvas.width,
        pCanvas.height
      );
    }

    // 裁切温度 ROI
    const tCanvas = document.createElement('canvas');
    tCanvas.width = Math.max(10, Math.floor(temperatureRoi.width * w));
    tCanvas.height = Math.max(10, Math.floor(temperatureRoi.height * h));
    const tCtx = tCanvas.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(
        this.canvas,
        temperatureRoi.x * w,
        temperatureRoi.y * h,
        temperatureRoi.width * w,
        temperatureRoi.height * h,
        0,
        0,
        tCanvas.width,
        tCanvas.height
      );
    }

    return {
      pressureCanvas: pCanvas,
      temperatureCanvas: tCanvas,
      fullCanvas: this.canvas,
      timestamp: Date.now(),
    };
  }
}
