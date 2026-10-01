import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  CircleDot,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Focus,
  Globe,
} from 'lucide-react';
import { ExperimentRecord, LinearFitResult } from '../../types/physics';
import {
  calculateLinearFit,
  calculateCelsiusFit,
  CelsiusFitResult,
  calculateNiceStep,
} from '../../utils/mathFitting';

interface PTChartProps {
  records: ExperimentRecord[];
  activeReplayTime?: number | null; // 回放时刻过滤
}

type TempMode = 'kelvin' | 'celsius';

interface ViewBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const PTChart: React.FC<PTChartProps> = ({ records, activeReplayTime }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. 图像模式切换: p-T (热力学温度 K) vs p-t (摄氏温度 ℃)
  const [tempMode, setTempMode] = useState<TempMode>('kelvin');
  const [showScatter, setShowScatter] = useState(true);
  const [showFitLine, setShowFitLine] = useState(true);
  const [originConstrained, setOriginConstrained] = useState(true); // p-T 模式下约束过原点

  // 2. 交互式坐标视区范围 (支持自由缩放与平移)
  const defaultKelvinBounds: ViewBounds = { minX: 0, maxX: 450, minY: 0, maxY: 160 };
  const defaultCelsiusBounds: ViewBounds = { minX: -300, maxX: 120, minY: 0, maxY: 160 };

  const [viewBounds, setViewBounds] = useState<ViewBounds>(defaultKelvinBounds);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; bounds: ViewBounds } | null>(null);

  // 如果处于回放状态，仅展示 <= activeReplayTime 的点
  const displayRecords = useMemo(() => {
    if (activeReplayTime === null || activeReplayTime === undefined) {
      return records;
    }
    return records.filter((r) => r.time <= activeReplayTime);
  }, [records, activeReplayTime]);

  // 拟合计算 (开尔文与摄氏度双模型)
  const kelvinFitResult: LinearFitResult = useMemo(() => {
    return calculateLinearFit(displayRecords);
  }, [displayRecords]);

  const celsiusFitResult: CelsiusFitResult = useMemo(() => {
    return calculateCelsiusFit(displayRecords);
  }, [displayRecords]);

  // 切换温标时重置默认视区
  const handleToggleTempMode = (mode: TempMode) => {
    setTempMode(mode);
    if (mode === 'kelvin') {
      setViewBounds(defaultKelvinBounds);
    } else {
      setViewBounds(defaultCelsiusBounds);
    }
  };

  // 快捷视区：数据自动聚焦 (把坐标起点调整到数据附近，放大观察局部细节)
  const handleAutoFocusData = useCallback(() => {
    if (displayRecords.length === 0) return;

    const xVals = displayRecords.map((r) => (tempMode === 'kelvin' ? r.temperature : r.celsius));
    const yVals = displayRecords.map((r) => r.pressure);

    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals);
    const maxY = Math.max(...yVals);

    const spanX = Math.max(15, maxX - minX);
    const spanY = Math.max(10, maxY - minY);

    const padX = spanX * 0.25;
    const padY = spanY * 0.25;

    setViewBounds({
      minX: Math.floor(minX - padX),
      maxX: Math.ceil(maxX + padX),
      minY: Math.max(0, Math.floor(minY - padY)),
      maxY: Math.ceil(maxY + padY),
    });
  }, [displayRecords, tempMode]);

  // 快捷视区：全景理论外推 (展示延伸至绝对零度 0 K 或 -273.15 ℃)
  const handleGlobalExtrapolation = () => {
    if (tempMode === 'kelvin') {
      setViewBounds(defaultKelvinBounds);
    } else {
      setViewBounds(defaultCelsiusBounds);
    }
  };

  // 按钮缩放 (以当前视区中心进行缩放)
  const handleZoom = (factor: number) => {
    setViewBounds((prev) => {
      const centerX = (prev.minX + prev.maxX) / 2;
      const centerY = (prev.minY + prev.maxY) / 2;
      const spanX = (prev.maxX - prev.minX) * factor;
      const spanY = (prev.maxY - prev.minY) * factor;

      return {
        minX: centerX - spanX / 2,
        maxX: centerX + spanX / 2,
        minY: Math.max(tempMode === 'celsius' ? -50 : 0, centerY - spanY / 2),
        maxY: centerY + spanY / 2,
      };
    });
  };

  // 鼠标滚轮在 Canvas 上无级缩放 (以鼠标指针处物理坐标为中心)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padLeft = 45;
    const padRight = 25;
    const padTop = 20;
    const padBottom = 35;
    const plotW = rect.width - padLeft - padRight;
    const plotH = rect.height - padTop - padBottom;

    if (mouseX < padLeft || mouseX > rect.width - padRight || mouseY < padTop || mouseY > rect.height - padBottom) {
      return;
    }

    const relX = (mouseX - padLeft) / plotW;
    const relY = (rect.height - padBottom - mouseY) / plotH;

    const curPhysX = viewBounds.minX + relX * (viewBounds.maxX - viewBounds.minX);
    const curPhysY = viewBounds.minY + relY * (viewBounds.maxY - viewBounds.minY);

    const zoomFactor = e.deltaY < 0 ? 0.88 : 1.14; // 滚轮上滑放大，下滑缩小

    const newSpanX = (viewBounds.maxX - viewBounds.minX) * zoomFactor;
    const newSpanY = (viewBounds.maxY - viewBounds.minY) * zoomFactor;

    setViewBounds({
      minX: curPhysX - relX * newSpanX,
      maxX: curPhysX + (1 - relX) * newSpanX,
      minY: curPhysY - relY * newSpanY,
      maxY: curPhysY + (1 - relY) * newSpanY,
    });
  };

  // 鼠标拖拽平移坐标系 (Pan)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      bounds: { ...viewBounds },
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning || !panStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const plotW = rect.width - 70;
    const plotH = rect.height - 55;

    const dxPix = e.clientX - panStart.x;
    const dyPix = e.clientY - panStart.y;

    const dxPhys = (dxPix / plotW) * (panStart.bounds.maxX - panStart.bounds.minX);
    const dyPhys = (dyPix / plotH) * (panStart.bounds.maxY - panStart.bounds.minY);

    setViewBounds({
      minX: panStart.bounds.minX - dxPhys,
      maxX: panStart.bounds.maxX - dxPhys,
      minY: panStart.bounds.minY + dyPhys,
      maxY: panStart.bounds.maxY + dyPhys,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setPanStart(null);
  };

  // Canvas 绘制引擎
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // 清屏与背景
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // 坐标边距
    const padLeft = 45;
    const padRight = 25;
    const padTop = 22;
    const padBottom = 35;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const { minX, maxX, minY, maxY } = viewBounds;

    const toX = (valX: number) => padLeft + ((valX - minX) / (maxX - minX)) * plotW;
    const toY = (valY: number) => padTop + plotH - ((valY - minY) / (maxY - minY)) * plotH;

    // 1. 动态自适应整洁网格刻度 (1, 2, 5 进位)
    const stepX = calculateNiceStep(maxX - minX, 6);
    const stepY = calculateNiceStep(maxY - minY, 5);

    const firstTickX = Math.ceil(minX / stepX) * stepX;
    const firstTickY = Math.ceil(minY / stepY) * stepY;

    // X 轴网格线与刻度
    ctx.lineWidth = 1;
    for (let xVal = firstTickX; xVal <= maxX; xVal += stepX) {
      const cx = toX(xVal);
      if (cx < padLeft || cx > padLeft + plotW) continue;

      ctx.beginPath();
      ctx.strokeStyle = xVal === 0 ? '#475569' : '#1e293b';
      ctx.moveTo(cx, padTop);
      ctx.lineTo(cx, padTop + plotH);
      ctx.stroke();

      ctx.fillStyle = xVal === 0 ? '#e2e8f0' : '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const labelStr = Math.abs(xVal) < 1e-4 ? '0' : Number(xVal.toFixed(1)).toString();
      ctx.fillText(labelStr, cx, padTop + plotH + 15);
    }

    // Y 轴网格线与刻度
    for (let yVal = firstTickY; yVal <= maxY; yVal += stepY) {
      const cy = toY(yVal);
      if (cy < padTop || cy > padTop + plotH) continue;

      ctx.beginPath();
      ctx.strokeStyle = yVal === 0 ? '#475569' : '#1e293b';
      ctx.moveTo(padLeft, cy);
      ctx.lineTo(padLeft + plotW, cy);
      ctx.stroke();

      ctx.fillStyle = yVal === 0 ? '#e2e8f0' : '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      const labelStr = Math.abs(yVal) < 1e-4 ? '0' : Number(yVal.toFixed(1)).toString();
      ctx.fillText(labelStr, padLeft - 6, cy + 3);
    }

    // 2. 坐标主轴 (根据 minX/minY 是否包含 0 决定主轴绘制位置)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;

    // X 轴基线 (如果 0 在视区内则绘制在 0 处，否则贴底边)
    const baseAxisY = minY <= 0 && maxY >= 0 ? toY(0) : padTop + plotH;
    ctx.beginPath();
    ctx.moveTo(padLeft, baseAxisY);
    ctx.lineTo(padLeft + plotW + 15, baseAxisY);
    ctx.stroke();

    // X 轴箭头
    ctx.beginPath();
    ctx.moveTo(padLeft + plotW + 15, baseAxisY);
    ctx.lineTo(padLeft + plotW + 8, baseAxisY - 4);
    ctx.lineTo(padLeft + plotW + 8, baseAxisY + 4);
    ctx.fillStyle = '#64748b';
    ctx.fill();

    // Y 轴基线 (如果 0 在视区内则绘制在 0 处，否则贴左边)
    const baseAxisX = minX <= 0 && maxX >= 0 ? toX(0) : padLeft;
    ctx.beginPath();
    ctx.moveTo(baseAxisX, padTop + plotH);
    ctx.lineTo(baseAxisX, padTop - 12);
    ctx.stroke();

    // Y 轴箭头
    ctx.beginPath();
    ctx.moveTo(baseAxisX, padTop - 12);
    ctx.lineTo(baseAxisX - 4, padTop - 5);
    ctx.lineTo(baseAxisX + 4, padTop - 5);
    ctx.fillStyle = '#64748b';
    ctx.fill();

    // 轴标题
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('p (kPa)', padLeft + 6, padTop - 5);
    ctx.textAlign = 'right';
    ctx.fillText(
      tempMode === 'kelvin' ? 'T (K)' : 't (℃)',
      padLeft + plotW + 18,
      baseAxisY + (baseAxisY >= padTop + plotH - 5 ? 28 : -8)
    );

    // 原点 O 标识
    if (minX <= 0 && maxX >= 0 && minY <= 0 && maxY >= 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'italic 11px serif';
      ctx.textAlign = 'right';
      ctx.fillText('O', toX(0) - 5, toY(0) + 14);
    }

    // 3. 拟合直线绘制 (支持开尔文过原点外推与摄氏度 -273.15 ℃ 外推)
    if (showFitLine && (tempMode === 'kelvin' ? kelvinFitResult.valid : celsiusFitResult.valid)) {
      if (tempMode === 'kelvin') {
        // =============== 热力学温度模式 (p = k * T) ===============
        const slope = originConstrained ? kelvinFitResult.originSlope : kelvinFitResult.slope;
        const intercept = originConstrained ? 0 : kelvinFitResult.intercept;

        const tMinData = displayRecords.length > 0 ? Math.min(...displayRecords.map((r) => r.temperature)) : 293;
        const tMaxData = displayRecords.length > 0 ? Math.max(...displayRecords.map((r) => r.temperature)) : 353;

        // 虚线外推段 (从 T = 0 K 延伸至实测起点)
        if (minX <= tMinData) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(toX(0), toY(intercept));
          ctx.lineTo(toX(tMinData), toY(slope * tMinData + intercept));
          ctx.stroke();
          ctx.restore();

          // 绝对零度原点提示圆圈
          if (toX(0) >= padLeft && toX(0) <= padLeft + plotW) {
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(toX(0), toY(intercept), 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 实线实测段
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(toX(tMinData), toY(slope * tMinData + intercept));
        ctx.lineTo(toX(Math.max(tMaxData, maxX * 0.95)), toY(slope * Math.max(tMaxData, maxX * 0.95) + intercept));
        ctx.stroke();
      } else {
        // =============== 摄氏温度模式 (p = k * t + p0) ===============
        const slope = celsiusFitResult.slope;
        const p0 = celsiusFitResult.interceptP0;
        const t0 = celsiusFitResult.absoluteZeroT0; // -273.15 ℃

        const tMinData = displayRecords.length > 0 ? Math.min(...displayRecords.map((r) => r.celsius)) : 20;
        const tMaxData = displayRecords.length > 0 ? Math.max(...displayRecords.map((r) => r.celsius)) : 80;

        // 虚线外推段 (从 t0 = -273.15 ℃ 反向延长至实测数据起点)
        if (minX <= tMinData) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(toX(t0), toY(0));
          ctx.lineTo(toX(tMinData), toY(slope * tMinData + p0));
          ctx.stroke();
          ctx.restore();

          // 核心教学知识点：反向延长线与横轴交点突出标注 (-273.15 ℃)
          if (toX(t0) >= padLeft - 10 && toX(t0) <= padLeft + plotW) {
            const zx = toX(t0);
            const zy = toY(0);

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(zx, zy, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // 标注绝对零度文字
            ctx.fillStyle = '#fca5a5';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('-273.15℃', zx, zy - 8);
          }
        }

        // 实线实测段
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(toX(tMinData), toY(slope * tMinData + p0));
        ctx.lineTo(toX(Math.max(tMaxData, maxX * 0.95)), toY(slope * Math.max(tMaxData, maxX * 0.95) + p0));
        ctx.stroke();
      }
    }

    // 4. 数据散点绘制 (Scatter Points)
    if (showScatter) {
      for (let i = 0; i < displayRecords.length; i++) {
        const r = displayRecords[i];
        const valX = tempMode === 'kelvin' ? r.temperature : r.celsius;
        const valY = r.pressure;

        const x = toX(valX);
        const y = toY(valY);

        if (x < padLeft - 10 || x > padLeft + plotW + 10 || y < padTop - 10 || y > padTop + plotH + 10) {
          continue; // 裁剪超出视区点
        }

        // 散点外发光光晕
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 6.5, 0, Math.PI * 2);
        ctx.fill();

        // 实体核心数据点
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(x, y, 3.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }, [
    displayRecords,
    tempMode,
    viewBounds,
    showScatter,
    showFitLine,
    originConstrained,
    kelvinFitResult,
    celsiusFitResult,
  ]);

  return (
    <div className="bg-slate-900 rounded-xl border border-blue-900/60 overflow-hidden shadow-lg flex flex-col p-3 space-y-2.5">
      {/* 顶部标题栏与功能转换开关 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              {tempMode === 'kelvin'
                ? '图 11-21 气体压强 p 与热力学温度 T 的关系'
                : '气体压强 p 与摄氏温度 t 的关系 (查理定律)'}
            </h4>
          </div>
          <p className="text-[10px] text-slate-400 font-serif">
            {tempMode === 'kelvin'
              ? '等容过程 · 直线过原点 (0 K, 0 kPa) 正比关系'
              : '等容过程 · 直线反向延长交于横轴绝对零度 (-273.15 ℃)'}
          </p>
        </div>

        {/* p-T 与 p-t 模式转化按钮 */}
        <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-700/80 flex items-center space-x-0.5 text-xs">
          <button
            onClick={() => handleToggleTempMode('kelvin')}
            className={`px-2 py-1 rounded font-medium transition ${
              tempMode === 'kelvin'
                ? 'bg-blue-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            p - T 图像 (K)
          </button>
          <button
            onClick={() => handleToggleTempMode('celsius')}
            className={`px-2 py-1 rounded font-medium transition ${
              tempMode === 'celsius'
                ? 'bg-emerald-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            p - t 图像 (℃)
          </button>
        </div>
      </div>

      {/* 交互视区缩放控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* 缩放与聚焦预设 */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleAutoFocusData}
            disabled={displayRecords.length === 0}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-blue-300 font-medium rounded border border-slate-700 flex items-center gap-1 text-[11px] transition"
            title="将坐标起点与范围自适应调整到数据附近，放大细节"
          >
            <Focus className="w-3.5 h-3.5 text-blue-400" />
            数据聚焦
          </button>

          <button
            onClick={handleGlobalExtrapolation}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium rounded border border-slate-700 flex items-center gap-1 text-[11px] transition"
            title="恢复全局理论外推全景，展示绝对零度"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            全景外推
          </button>

          <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

          {/* 放大/缩小按钮 */}
          <button
            onClick={() => handleZoom(0.8)}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            title="放大视区"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(1.25)}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            title="缩小视区"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleGlobalExtrapolation}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            title="重置缩放"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 散点与拟合控制 */}
        <div className="flex items-center space-x-1 text-xs">
          <button
            onClick={() => setShowScatter(!showScatter)}
            className={`px-2 py-1 rounded border text-[11px] font-medium transition ${
              showScatter
                ? 'bg-blue-600/80 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <CircleDot className="w-3 h-3 inline mr-1" />
            数据点
          </button>
          <button
            onClick={() => setShowFitLine(!showFitLine)}
            className={`px-2 py-1 rounded border text-[11px] font-medium transition ${
              showFitLine
                ? 'bg-sky-600/80 border-sky-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <TrendingUp className="w-3 h-3 inline mr-1" />
            线性拟合
          </button>
        </div>
      </div>

      {/* Canvas 图像绘制区 (支持滚轮缩放与鼠标拖拽平移) */}
      <div className="relative w-full h-[195px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 shadow-inner group">
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full h-full block ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        />

        {/* 视区范围浮动提示 */}
        <div className="absolute top-1.5 right-2 bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-slate-800 pointer-events-none">
          {tempMode === 'kelvin' ? 'T' : 't'}: [{viewBounds.minX.toFixed(0)} ~ {viewBounds.maxX.toFixed(0)}] · p: [
          {viewBounds.minY.toFixed(0)} ~ {viewBounds.maxY.toFixed(0)}]
        </div>

        {/* 操作提示小浮层 */}
        <div className="absolute bottom-1 right-2 text-[10px] text-slate-500 pointer-events-none opacity-60 group-hover:opacity-100 transition">
          滚轮缩放 · 拖拽平移
        </div>
      </div>

      {/* 拟合结果分析卡片 */}
      <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/80 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            {tempMode === 'kelvin' ? '查理定律热力学拟合结论:' : '查理定律摄氏度拟合结论:'}
          </span>
          {tempMode === 'kelvin' ? (
            <label className="text-[11px] text-slate-400 flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={originConstrained}
                onChange={(e) => setOriginConstrained(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-blue-600 w-3 h-3"
              />
              约束过原点 (p = kT)
            </label>
          ) : (
            <span className="text-[11px] text-amber-400 font-mono">
              外推绝对零度: {celsiusFitResult.valid ? `${celsiusFitResult.absoluteZeroT0.toFixed(2)} ℃` : '-273.15 ℃'}
            </span>
          )}
        </div>

        {/* 拟合公式与 R^2 展示 */}
        {tempMode === 'kelvin' ? (
          kelvinFitResult.valid ? (
            <div className="grid grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-700/60">
                <span className="text-slate-400">拟合公式: </span>
                <span className="text-sky-300 font-bold">
                  {originConstrained
                    ? `p = ${kelvinFitResult.originSlope.toFixed(4)} · T`
                    : `p = ${kelvinFitResult.slope.toFixed(3)}T ${
                        kelvinFitResult.intercept >= 0 ? '+' : ''
                      }${kelvinFitResult.intercept.toFixed(2)}`}
                </span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="text-slate-400">R²: </span>
                  <span className="text-emerald-400 font-bold">
                    {kelvinFitResult.rSquared.toFixed(4)}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400/90 font-sans font-semibold">
                  正比关系 (p ∝ T)
                </span>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 italic py-1 text-center font-sans text-[11px]">
              {kelvinFitResult.message || '请打点记录至少 2 组数据以自动生成最佳拟合公式'}
            </div>
          )
        ) : (
          celsiusFitResult.valid ? (
            <div className="grid grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-700/60 truncate">
                <span className="text-slate-400">拟合公式: </span>
                <span className="text-emerald-300 font-bold">
                  {`p = ${celsiusFitResult.slope.toFixed(3)}t + ${celsiusFitResult.interceptP0.toFixed(2)}`}
                </span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="text-slate-400">R²: </span>
                  <span className="text-emerald-400 font-bold">
                    {celsiusFitResult.rSquared.toFixed(4)}
                  </span>
                </div>
                <span className="text-[10px] text-amber-300 font-sans font-semibold">
                  交于 -273.15℃
                </span>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 italic py-1 text-center font-sans text-[11px]">
              {celsiusFitResult.message || '请打点记录至少 2 组数据以自动生成摄氏度拟合公式'}
            </div>
          )
        )}
      </div>
    </div>
  );
};
