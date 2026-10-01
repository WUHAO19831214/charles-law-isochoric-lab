import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Monitor,
  Crop,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Crosshair,
  Maximize2,
  Minimize2,
  HelpCircle,
} from 'lucide-react';
import { SensorReading, WorkbenchMode } from '../../types/physics';

interface RoiRect {
  x: number;      // 0..1
  y: number;      // 0..1
  width: number;  // 0..1
  height: number; // 0..1
}

interface RealtimeDataCardProps {
  reading: SensorReading;
  mode: WorkbenchMode;
  isSimulating: boolean;
  isCapturingScreen: boolean;
  screenStream: MediaStream | null;
  onToggleSimulate: () => void;
  onResetSimulate: () => void;
  onSetSimulateTemp: (tempK: number) => void;
  onStartScreenCapture: () => void;
  onStopScreenCapture: () => void;
  roi: RoiRect;
  onRoiChange: (roi: RoiRect) => void;
  latestRoiCanvas: HTMLCanvasElement | null;
  rawOcrText: string;
  showCelsiusConversion: boolean;
  onToggleCelsiusConversion: () => void;
}

export const RealtimeDataCard: React.FC<RealtimeDataCardProps> = ({
  reading,
  mode,
  isSimulating,
  isCapturingScreen,
  screenStream,
  onToggleSimulate,
  onResetSimulate,
  onSetSimulateTemp,
  onStartScreenCapture,
  onStopScreenCapture,
  roi,
  onRoiChange,
  latestRoiCanvas,
  rawOcrText,
  showCelsiusConversion,
  onToggleCelsiusConversion,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<RoiRect>(roi);
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoAspect, setVideoAspect] = useState<number>(16 / 9);

  // 同步外部 ROI
  useEffect(() => {
    setCurrentBox(roi);
  }, [roi]);

  // 绑定视频流
  useEffect(() => {
    if (videoRef.current && screenStream) {
      videoRef.current.srcObject = screenStream;
      videoRef.current.play().catch(() => {});
    }
  }, [screenStream, isCapturingScreen]);

  // 监听视频实际宽高比，使容器零黑边完全贴合视频，确保鼠标点击与像素 1:1 精确对应
  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
      const aspect = videoRef.current.videoWidth / videoRef.current.videoHeight;
      setVideoAspect(aspect);
    }
  };

  // 渲染裁切画面快照到小预览画布上
  useEffect(() => {
    if (previewCanvasRef.current && latestRoiCanvas) {
      const canvas = previewCanvasRef.current;
      canvas.width = latestRoiCanvas.width;
      canvas.height = latestRoiCanvas.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(latestRoiCanvas, 0, 0);
      }
    }
  }, [latestRoiCanvas]);

  // 精准计算视频实际渲染区域与鼠标相对位置（消除 letterbox 偏差）
  const getRelativeCoords = useCallback(
    (clientX: number, clientY: number) => {
      const video = videoRef.current;
      if (!video) return { x: 0, y: 0 };

      const rect = video.getBoundingClientRect();
      const vw = video.videoWidth || rect.width;
      const vh = video.videoHeight || rect.height;
      const videoRatio = vw / vh;
      const elementRatio = rect.width / rect.height;

      let renderW = rect.width;
      let renderH = rect.height;
      let offX = 0;
      let offY = 0;

      if (elementRatio > videoRatio) {
        renderW = rect.height * videoRatio;
        offX = (rect.width - renderW) / 2;
      } else {
        renderH = rect.width / videoRatio;
        offY = (rect.height - renderH) / 2;
      }

      const relX = clientX - rect.left - offX;
      const relY = clientY - rect.top - offY;

      const normX = Math.max(0, Math.min(1, relX / renderW));
      const normY = Math.max(0, Math.min(1, relY / renderH));

      return { x: normX, y: normY, renderW, renderH, offX, offY };
    },
    []
  );

  // 处理在映射窗口上直接拖拽框选 ROI
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const coords = getRelativeCoords(e.clientX, e.clientY);
    setIsDrawing(true);
    setStartPos({ x: coords.x, y: coords.y });
    setCurrentBox({ x: coords.x, y: coords.y, width: 0.05, height: 0.05 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPos) return;
    const coords = getRelativeCoords(e.clientX, e.clientY);

    const x = Math.min(startPos.x, coords.x);
    const y = Math.min(startPos.y, coords.y);
    const width = Math.max(0.04, Math.abs(coords.x - startPos.x));
    const height = Math.max(0.03, Math.abs(coords.y - startPos.y));

    setCurrentBox({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setStartPos(null);
      onRoiChange(currentBox);
    }
  };

  // 预设选区：DISLab 底部读数行 (充足余量确保当前压强与温度两边都不被裁剪)
  const applyDislabPreset = (e: React.MouseEvent) => {
    e.stopPropagation();
    const preset: RoiRect = {
      x: 0.01,
      y: 0.73,
      width: 0.70,
      height: 0.12,
    };
    setCurrentBox(preset);
    onRoiChange(preset);
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-blue-900/60 overflow-hidden shadow-lg flex flex-col">
      {/* 顶部标题栏，严格匹配附图深蓝主色调 */}
      <div className="bg-blue-600 px-4 py-2 flex items-center justify-between text-white font-bold text-sm tracking-wide">
        <div className="flex items-center space-x-2">
          <span>实时数据窗口</span>
          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-blue-700/80 border border-blue-400/40">
            {mode === 'demo' ? '模拟演示信号' : isCapturingScreen ? '窗口已映射 · 实时框选' : '屏幕 OCR 捕获'}
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-xs font-normal">
          <span
            className={`w-2 h-2 rounded-full ${
              reading.status === 'valid'
                ? 'bg-emerald-400 animate-pulse'
                : reading.status === 'detecting'
                ? 'bg-amber-400'
                : 'bg-slate-400'
            }`}
          />
          <span className="text-blue-100 text-[11px]">
            {reading.status === 'valid' ? '识别正常' : reading.statusMessage || '保持上一帧读数'}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* ================= 1. 窗口映射与直接框选工作区 ================= */}
        {mode === 'screen-sensor' && (
          <div className="space-y-2">
            {!isCapturingScreen ? (
              /* 未共享状态引导卡片 */
              <div
                onClick={onStartScreenCapture}
                className="group relative cursor-pointer border-2 border-dashed border-blue-500/60 hover:border-blue-400 bg-slate-950/70 hover:bg-slate-900/90 rounded-lg p-5 flex flex-col items-center justify-center text-center space-y-2 transition shadow-inner"
              >
                <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-blue-300">
                    点击共享/映射传感器软件窗口
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    支持朗威 DISLab、PASCO 等传感器软件，窗口将直接映射到此处
                  </div>
                </div>
                <div className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                  共享后可直接在此画面上用鼠标拖拽框选数字
                </div>
              </div>
            ) : (
              /* 窗口已映射视图：直接在映射视频上鼠标框选 */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1 font-medium text-emerald-400">
                    <Crosshair className="w-3.5 h-3.5" />
                    鼠标在画面上拖拽即可直接框选数字区域：
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={applyDislabPreset}
                      className="px-2 py-0.5 rounded bg-blue-900/80 hover:bg-blue-800 text-blue-200 border border-blue-700/80 text-[10px] transition"
                      title="快速应用 DISLab 底部读数行位置"
                    >
                      DISLab 预设
                    </button>
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                      title={isExpanded ? '收起窗口' : '放大视口'}
                    >
                      {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={onStopScreenCapture}
                      className="px-2 py-0.5 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700/80 text-[10px] transition"
                    >
                      停止共享
                    </button>
                  </div>
                </div>

                {/* 映射画面容器 + 交互式 ROI 框选层 */}
                <div
                  ref={containerRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  style={{ aspectRatio: isExpanded ? undefined : `${videoAspect}` }}
                  className={`relative w-full ${
                    isExpanded ? 'h-[280px]' : 'max-h-[220px]'
                  } bg-black rounded-lg overflow-hidden border-2 border-slate-700 select-none cursor-crosshair shadow-inner transition-all flex items-center justify-center`}
                >
                  {/* 映射的窗口实时视频 */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full h-full object-contain pointer-events-none"
                  />

                  {/* 交互式 ROI 选区矩形框 */}
                  <div
                    style={{
                      left: `${currentBox.x * 100}%`,
                      top: `${currentBox.y * 100}%`,
                      width: `${currentBox.width * 100}%`,
                      height: `${currentBox.height * 100}%`,
                    }}
                    className="absolute border-2 border-emerald-400 bg-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.6)] pointer-events-none transition-none"
                  >
                    {/* 标牌指示 */}
                    <div className="absolute -top-5 left-0 bg-emerald-600 text-white text-[9px] font-mono px-1.5 py-0.2 rounded shadow whitespace-nowrap">
                      识别区域 [压强 & 温度]
                    </div>
                    {/* 四角抓手视觉标示 */}
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-emerald-300 border border-emerald-700" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-300 border border-emerald-700" />
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-emerald-300 border border-emerald-700" />
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-emerald-300 border border-emerald-700" />
                  </div>

                  {/* 悬浮操作提示 */}
                  <div className="absolute bottom-1 right-1 bg-black/75 backdrop-blur text-[10px] text-slate-300 px-2 py-0.5 rounded pointer-events-none">
                    点击拖动可随时重新框选
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 2. 核心醒目读数与切片卡片 (严格对照附图) ================= */}
        <div className="space-y-2">
          {/* 附图白底核心读数框 */}
          <div className="bg-white rounded-lg p-3 border-2 border-slate-300 shadow-inner select-text">
            <div className="flex flex-wrap items-center justify-around gap-2 text-slate-900 font-serif">
              <div className="flex items-baseline space-x-1">
                <span className="text-sm font-semibold text-slate-700">当前压强:</span>
                <span className="text-2xl font-bold font-mono tracking-tight text-blue-950">
                  {reading.pressure.toFixed(1)}
                </span>
                <span className="text-sm font-bold text-slate-600">kPa</span>
              </div>

              <div className="w-[1px] h-6 bg-slate-300 hidden sm:block" />

              <div className="flex items-baseline space-x-1">
                <span className="text-sm font-semibold text-slate-700">当前温度:</span>
                <span className="text-2xl font-bold font-mono tracking-tight text-red-950">
                  {reading.temperature.toFixed(1)}
                </span>
                <span className="text-sm font-bold text-slate-600">K</span>
                {showCelsiusConversion && (
                  <span className="text-xs text-slate-500 font-mono ml-1">
                    ({reading.celsius.toFixed(1)}℃)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 实时 OCR 截取切片画面真实预览 (如用户原型图展示，直观所见即所得) */}
          {mode === 'screen-sensor' && isCapturingScreen && (
            <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">选区实际裁切画面 (实时送入 OCR):</span>
                <span className="font-mono text-emerald-400">
                  置信度: {(reading.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* 真实裁切图像直接展示 */}
              <div className="bg-white rounded p-1 border border-slate-700 flex items-center justify-center overflow-hidden">
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-9 w-auto max-w-full object-contain"
                />
              </div>

              {/* 识别文本回显 */}
              <div className="text-[11px] font-mono text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 truncate">
                {rawOcrText ? `OCR文本: "${rawOcrText}"` : '正在解析框选区域文字...'}
              </div>
            </div>
          )}
        </div>

        {/* 摄氏度换算开关与辅助标定 */}
        <div className="flex items-center justify-between text-xs px-1 text-slate-400">
          <label className="flex items-center space-x-2 cursor-pointer hover:text-slate-200">
            <input
              type="checkbox"
              checked={showCelsiusConversion}
              onChange={onToggleCelsiusConversion}
              className="rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span>自动换算摄氏度 (T = t + 273.15)</span>
          </label>
          {mode === 'demo' && (
            <span className="font-mono text-slate-400 text-[11px]">
              演示模式 · 查理定律平滑升温
            </span>
          )}
        </div>

        {/* ================= 3. 演示模拟模式控制区 ================= */}
        {mode === 'demo' && (
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">模拟加热实验控制:</span>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={onToggleSimulate}
                  className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition ${
                    isSimulating
                      ? 'bg-amber-600 text-white hover:bg-amber-500'
                      : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isSimulating ? '暂停加热' : '开始升温'}
                </button>
                <button
                  onClick={onResetSimulate}
                  className="px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 transition"
                  title="重置为 20℃ (293.15 K)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 快速温度预设档位 */}
            <div className="flex items-center space-x-1.5 pt-0.5">
              <span className="text-slate-400 text-[11px]">温度预设:</span>
              {[
                { label: '20℃', k: 293.15 },
                { label: '40℃', k: 313.15 },
                { label: '60℃', k: 333.15 },
                { label: '80℃', k: 353.15 },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => onSetSimulateTemp(item.k)}
                  className="px-1.5 py-0.5 rounded bg-slate-700/70 hover:bg-blue-600/60 text-slate-200 text-[11px] border border-slate-600 transition"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
