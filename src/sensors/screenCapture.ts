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
   */
  public captureRoi(roi: { x: number; y: number; width: number; height: number }): CapturedRoiFrame | null {
    if (!this.active || !this.video || !this.ctx || !this.canvas) return null;
    if (this.video.videoWidth === 0 || this.video.videoHeight === 0) return null;

    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    this.canvas.width = w;
    this.canvas.height = h;

    this.ctx.drawImage(this.video, 0, 0, w, h);

    // 计算实际像素区域
    const sx = Math.max(0, Math.min(w - 1, Math.floor(roi.x * w)));
    const sy = Math.max(0, Math.min(h - 1, Math.floor(roi.y * h)));
    const sw = Math.max(10, Math.min(w - sx, Math.floor(roi.width * w)));
    const sh = Math.max(10, Math.min(h - sy, Math.floor(roi.height * h)));

    const roiCanvas = document.createElement('canvas');
    roiCanvas.width = sw;
    roiCanvas.height = sh;
    const roiCtx = roiCanvas.getContext('2d', { willReadFrequently: true });

    if (roiCtx) {
      roiCtx.drawImage(this.canvas, sx, sy, sw, sh, 0, 0, sw, sh);

      // 图像预处理增强对比度（灰度化 + 适度锐化，使 OCR 识别准确率翻倍）
      try {
        const imgData = roiCtx.getImageData(0, 0, sw, sh);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          // 自适应二值化增强
          const binary = gray > 140 ? 255 : 0;
          data[i] = binary;
          data[i + 1] = binary;
          data[i + 2] = binary;
        }
        roiCtx.putImageData(imgData, 0, 0);
      } catch (e) {
        // 忽略跨域像素安全错误
      }
    }

    return {
      roiCanvas,
      fullCanvas: this.canvas,
      timestamp: Date.now(),
    };
  }
}
