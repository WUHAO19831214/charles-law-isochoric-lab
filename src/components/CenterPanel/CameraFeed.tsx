import React, { useState, useEffect, useRef } from 'react';
import { Camera, FlipHorizontal, Maximize2, Video, VideoOff, RefreshCw, Eye } from 'lucide-react';
import { CameraStreamManager, VideoDeviceInfo } from '../../sensors/cameraManager';

interface CameraFeedProps {
  cameraManager: CameraStreamManager;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ cameraManager }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [devices, setDevices] = useState<VideoDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 初始化获取可用摄像头列表
  const refreshDevices = async () => {
    try {
      const list = await cameraManager.getAvailableCameras();
      setDevices(list);
      if (list.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(list[0].deviceId);
      }
    } catch (err) {
      console.warn('获取摄像头设备列表失败:', err);
    }
  };

  useEffect(() => {
    refreshDevices();
  }, []);

  // 启动/停止摄像头推流
  const toggleStream = async () => {
    if (isStreaming) {
      cameraManager.stopStream();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsStreaming(false);
    } else {
      setErrorMsg(null);
      try {
        const stream = await cameraManager.startStream(selectedDeviceId || undefined);
        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsStreaming(true);
          refreshDevices(); // 获得权限后重新获取设备 label
        } else {
          setErrorMsg('无法启动视频流，请检查设备连接或权限。');
        }
      } catch (err: any) {
        setErrorMsg('摄像头访问被拒绝或占用');
      }
    }
  };

  // 设备切换
  const handleDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const devId = e.target.value;
    setSelectedDeviceId(devId);
    if (isStreaming) {
      cameraManager.stopStream();
      const stream = await cameraManager.startStream(devId);
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    }
  };

  // 全屏切换
  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="bg-slate-900 rounded-xl border border-blue-900/60 overflow-hidden shadow-lg flex flex-col h-full min-h-[480px]"
    >
      {/* 顶部标题栏，严格匹配附图 */}
      <div className="bg-blue-600 px-4 py-2 flex items-center justify-between text-white font-bold text-sm tracking-wide">
        <div className="flex items-center space-x-2">
          <Camera className="w-4 h-4" />
          <span>摄像头捕获</span>
        </div>
        <div className="flex items-center space-x-2 text-xs font-normal">
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-1 rounded transition ${
              isMirrored ? 'bg-blue-800 text-white' : 'text-blue-200 hover:text-white'
            }`}
            title="水平镜像翻转"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={handleFullscreen}
            className="p-1 text-blue-200 hover:text-white rounded transition"
            title="全屏特写实验台"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 设备选择与操作栏 */}
      <div className="p-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 flex-1">
          <select
            value={selectedDeviceId}
            onChange={handleDeviceChange}
            className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 truncate"
          >
            {devices.length === 0 ? (
              <option value="">未检测到可用外接摄像头</option>
            ) : (
              devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))
            )}
          </select>
          <button
            onClick={refreshDevices}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded border border-slate-700"
            title="刷新设备列表"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={toggleStream}
          className={`px-3 py-1 rounded font-semibold flex items-center gap-1.5 transition ${
            isStreaming
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {isStreaming ? (
            <>
              <VideoOff className="w-3.5 h-3.5" />
              关闭视频
            </>
          ) : (
            <>
              <Video className="w-3.5 h-3.5" />
              开启推流
            </>
          )}
        </button>
      </div>

      {/* 视频显示与实景实验装置画面 */}
      <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden p-2">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain rounded-lg transition-transform ${
            isMirrored ? 'scale-x-[-1]' : ''
          } ${isStreaming ? 'block' : 'hidden'}`}
        />

        {/* 缺省实景装置高保真实物图示 (无摄像头或未推流时展示，完全复刻附图真实实验装置) */}
        {!isStreaming && (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center space-y-3">
            <div className="relative max-w-[280px] w-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900/90 p-3">
              {/* 模拟实物装置 SVG 矢量示意图 */}
              <svg viewBox="0 0 300 360" className="w-full h-auto drop-shadow-lg">
                {/* 铁架台底座与立柱 */}
                <rect x="180" y="320" width="100" height="15" rx="3" fill="#475569" />
                <rect x="220" y="30" width="10" height="295" rx="2" fill="#64748b" />

                {/* 实验加热底座与套筒 (橙黄色底座 + 黑色套筒，如附图所示) */}
                <rect x="80" y="270" width="90" height="35" rx="6" fill="#f59e0b" />
                <rect x="88" y="275" width="20" height="10" rx="2" fill="#1e293b" />
                <circle x="125" y="287" r="4" fill="#ef4444" />
                <rect x="75" y="195" width="100" height="78" rx="4" fill="#1e293b" />

                {/* 试管与内部空气柱 */}
                <rect x="115" y="100" width="20" height="110" rx="10" fill="#e2e8f0" opacity="0.4" />
                <rect x="113" y="90" width="24" height="16" rx="4" fill="#334155" />

                {/* 传感器固定夹持器 */}
                <rect x="135" y="105" width="90" height="8" rx="2" fill="#94a3b8" />
                <rect x="135" y="70" width="90" height="8" rx="2" fill="#94a3b8" />

                {/* 朗威/双通道传感器探头模块 (蓝色半透明模块，如附图所示) */}
                <rect x="110" y="45" width="30" height="42" rx="4" fill="#1e40af" opacity="0.85" />
                <rect x="145" y="45" width="30" height="42" rx="4" fill="#1e40af" opacity="0.85" />

                {/* 传感器探头连接引线 */}
                <path d="M 125 87 L 125 190" stroke="#0284c7" strokeWidth="2.5" strokeDasharray="3 3" fill="none" />
                <path d="M 125 45 Q 100 20 60 40" stroke="#0f172a" strokeWidth="2.5" fill="none" />
                <path d="M 160 45 Q 185 20 230 40" stroke="#0f172a" strokeWidth="2.5" fill="none" />
              </svg>

              <div className="mt-2 text-xs font-semibold text-slate-300">
                实景实验台：密封试管水浴加热装置
              </div>
              <div className="text-[10px] text-slate-500">
                压强传感器 + 热力学温度传感器接入
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-400">
                已就绪。点击上方“开启推流”可实时投影 USB 摄像头。
              </p>
              {errorMsg && <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>}
            </div>
          </div>
        )}

        {/* 画面水印指示 */}
        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded border border-slate-800 text-[11px] text-slate-400 pointer-events-none flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>实景工作区 · 等容实验装置</span>
        </div>
      </div>
    </div>
  );
};
