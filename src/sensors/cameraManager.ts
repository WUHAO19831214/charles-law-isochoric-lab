/**
 * WebRTC 摄像头流媒体管理器
 */
export interface VideoDeviceInfo {
  deviceId: string;
  label: string;
}

export class CameraStreamManager {
  private currentStream: MediaStream | null = null;
  private currentDeviceId: string | null = null;

  public async getAvailableCameras(): Promise<VideoDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      // 触发初始权限以便获取设备 label
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');

      return videoDevices.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `摄像头设备 ${index + 1}`,
      }));
    } catch (err) {
      console.warn('获取摄像头列表失败:', err);
      return [];
    }
  }

  public async startStream(deviceId?: string): Promise<MediaStream | null> {
    this.stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器环境不支持摄像头视频输入 (getUserMedia)');
    }

    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    };

    try {
      this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentDeviceId = deviceId || null;
      return this.currentStream;
    } catch (err) {
      console.error('摄像头启动失败:', err);
      return null;
    }
  }

  public stopStream(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => track.stop());
      this.currentStream = null;
    }
    this.currentDeviceId = null;
  }

  public get stream(): MediaStream | null {
    return this.currentStream;
  }

  public get deviceId(): string | null {
    return this.currentDeviceId;
  }
}
