/**
 * 屏幕/窗口捕获驱动 (复用 physics-software-sensors 契约与机制)
 */
export interface CapturedRoiFrame {
  roiCanvas: HTMLCanvasElement | null;
  fullCanvas: HTMLCanvasElement | null;
  timestamp: number;
}

export class ScreenCaptureManager {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isCapturing = false;
  private onEndedCallback: (() => void) | null = null;

  public setOnEnded(cb: () => void): void {
    this.onEndedCallback = cb;
  }

  public async startCapture(): Promise<MediaStream | null> {
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
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
      });

      return this.stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.warn('用户取消了屏幕共享授权');
      } else {
        console.error('屏幕捕获启动失败:', err);
      }
      this.stopCapture();
      return null;
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

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public getVideo(): HTMLVideoElement | null {
    return this.video;
  }

  /**
   * 截取当前帧画面并裁切指定归一化 ROI (x, y, width, height 在 0..1)
   * 优化：双立方平滑 2.5x 放大 + 边缘安全外扩，绝不生硬剪裁破坏笔画
   */
  public captureRoi(roi: { x: number; y: number; width: number; height: number }): CapturedRoiFrame | null {
    if (!this.active || !this.video || !this.ctx || !this.canvas) return null;
    if (this.video.videoWidth === 0 || this.video.videoHeight === 0) return null;

    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    this.canvas.width = vw;
    this.canvas.height = vh;

    this.ctx.drawImage(this.video, 0, 0, vw, vh);

    // 计算实际像素选区并加入边缘保护 padding
    const paddingX = Math.round(vw * 0.005);
    const paddingY = Math.round(vh * 0.005);

    const sx = Math.max(0, Math.floor(roi.x * vw) - paddingX);
    const sy = Math.max(0, Math.floor(roi.y * vh) - paddingY);
    const sw = Math.min(vw - sx, Math.floor(roi.width * vw) + paddingX * 2);
    const sh = Math.min(vh - sy, Math.floor(roi.height * vh) + paddingY * 2);

    if (sw <= 10 || sh <= 10) return null;

    // 缩放到 OCR 最佳字高 (字高 40~60px 为佳，通常缩放 2~3 倍)
    const scale = Math.max(1.8, Math.min(3.5, 120 / Math.max(20, sh)));
    const targetW = Math.round(sw * scale);
    const targetH = Math.round(sh * scale);

    const roiCanvas = document.createElement('canvas');
    roiCanvas.width = targetW;
    roiCanvas.height = targetH;
    const roiCtx = roiCanvas.getContext('2d', { willReadFrequently: true });

    if (roiCtx) {
      roiCtx.imageSmoothingEnabled = true;
      roiCtx.imageSmoothingQuality = 'high';
      roiCtx.drawImage(this.canvas, sx, sy, sw, sh, 0, 0, targetW, targetH);
    }

    return {
      roiCanvas,
      fullCanvas: this.canvas,
      timestamp: Date.now(),
    };
  }
}
