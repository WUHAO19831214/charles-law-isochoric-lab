import React, { useRef, useEffect, useState, useMemo } from 'react';
import { TrendingUp, CircleDot, Eye, Info } from 'lucide-react';
import { ExperimentRecord, LinearFitResult } from '../../types/physics';
import { calculateLinearFit } from '../../utils/mathFitting';

interface PTChartProps {
  records: ExperimentRecord[];
  activeReplayTime?: number | null; // 回放时刻过滤
}

export const PTChart: React.FC<PTChartProps> = ({ records, activeReplayTime }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showScatter, setShowScatter] = useState(true);
  const [showFitLine, setShowFitLine] = useState(true);
  const [originConstrained, setOriginConstrained] = useState(true); // 查理定律严格正比 p = kT (过原点)

  // 如果处于回放状态，仅展示 <= activeReplayTime 的点
  const displayRecords = useMemo(() => {
    if (activeReplayTime === null || activeReplayTime === undefined) {
      return records;
    }
    return records.filter((r) => r.time <= activeReplayTime);
  }, [records, activeReplayTime]);

  // 拟合计算
  const fitResult: LinearFitResult = useMemo(() => {
    return calculateLinearFit(displayRecords);
  }, [displayRecords]);

  // Canvas 绘制
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

    // 坐标轴边距
    const padLeft = 45;
    const padRight = 25;
    const padTop = 20;
    const padBottom = 35;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // 物理坐标范围: T ∈ [0, 450] K, p ∈ [0, 160] kPa
    const minT = 0;
    const maxT = 450;
    const minP = 0;
    const maxP = 160;

    const toX = (t: number) => padLeft + ((t - minT) / (maxT - minT)) * plotW;
    const toY = (p: number) => padTop + plotH - ((p - minP) / (maxP - minP)) * plotH;

    // 1. 绘制物理网格线 (仿高中物理教材坐标纸)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // T 轴细网格 (每 25 K 一格，每 50 K 主线)
    for (let t = 0; t <= maxT; t += 25) {
      const x = toX(t);
      ctx.beginPath();
      ctx.strokeStyle = t % 50 === 0 ? '#334155' : '#1e293b';
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();

      if (t % 50 === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${t}`, x, padTop + plotH + 15);
      }
    }

    // p 轴细网格 (每 25 kPa 一格，每 50 kPa 主线)
    for (let p = 0; p <= maxP; p += 25) {
      const y = toY(p);
      ctx.beginPath();
      ctx.strokeStyle = p % 50 === 0 ? '#334155' : '#1e293b';
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      if (p % 50 === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${p}`, padLeft - 6, y + 3);
      }
    }

    // 2. 坐标主轴与箭头
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;

    // X 轴 (T/K)
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + plotH);
    ctx.lineTo(padLeft + plotW + 15, padTop + plotH);
    ctx.stroke();
    // X 轴箭头
    ctx.beginPath();
    ctx.moveTo(padLeft + plotW + 15, padTop + plotH);
    ctx.lineTo(padLeft + plotW + 8, padTop + plotH - 4);
    ctx.lineTo(padLeft + plotW + 8, padTop + plotH + 4);
    ctx.fillStyle = '#64748b';
    ctx.fill();

    // Y 轴 (p/kPa)
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + plotH);
    ctx.lineTo(padLeft, padTop - 10);
    ctx.stroke();
    // Y 轴箭头
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop - 10);
    ctx.lineTo(padLeft - 4, padTop - 3);
    ctx.lineTo(padLeft + 4, padTop - 3);
    ctx.fill();

    // 轴标题
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('p (kPa)', padLeft + 6, padTop - 2);
    ctx.textAlign = 'right';
    ctx.fillText('T (K)', padLeft + plotW + 18, padTop + plotH + 28);

    // 原点 O 标识
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 11px serif';
    ctx.textAlign = 'right';
    ctx.fillText('O', padLeft - 6, padTop + plotH + 14);

    // 3. 拟合直线绘制 (查理定律外推至绝对零度虚线)
    if (showFitLine && fitResult.valid) {
      const slope = originConstrained ? fitResult.originSlope : fitResult.slope;
      const intercept = originConstrained ? 0 : fitResult.intercept;

      // 实线部分 (当前数据覆盖区间 [minT_data, maxT_data + 20])
      const tMin = displayRecords.length > 0 ? Math.min(...displayRecords.map((r) => r.temperature)) : 290;
      const tMax = displayRecords.length > 0 ? Math.max(...displayRecords.map((r) => r.temperature)) : 360;

      const pAt0 = intercept;
      const pAtMin = slope * tMin + intercept;
      const pAtMax = slope * (maxT * 0.95) + intercept;

      // 虚线外推段 (从 T = 0 K 延伸到实测起始温区)
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(pAt0));
      ctx.lineTo(toX(tMin), toY(pAtMin));
      ctx.stroke();
      ctx.restore();

      // 实线测量拟合段
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(toX(tMin), toY(pAtMin));
      ctx.lineTo(toX(maxT * 0.95), toY(pAtMax));
      ctx.stroke();

      // 拟合线端点提示: 绝对零度 0 K 处交点
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(toX(0), toY(pAt0), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. 数据散点绘制 (Scatter Points)
    if (showScatter) {
      for (let i = 0; i < displayRecords.length; i++) {
        const r = displayRecords[i];
        const x = toX(r.temperature);
        const y = toY(r.pressure);

        // 散点外发光光晕
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        // 实体核心数据点
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }, [displayRecords, showScatter, showFitLine, originConstrained, fitResult]);

  return (
    <div className="bg-slate-900 rounded-xl border border-blue-900/60 overflow-hidden shadow-lg flex flex-col p-3 space-y-2.5">
      {/* 标题与交互开关 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div>
          <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            图 11-21 气体压强 p 与热力学温度 T 的关系
          </h4>
          <p className="text-[10px] text-slate-400 font-serif">
            等容过程查理定律探究 (横轴已外推至绝对零度 0 K)
          </p>
        </div>

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

      {/* Canvas 图像绘制区 */}
      <div className="relative w-full h-[180px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* 拟合结果分析卡片 */}
      <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/80 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            查理定律拟合结论:
          </span>
          <label className="text-[11px] text-slate-400 flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={originConstrained}
              onChange={(e) => setOriginConstrained(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-blue-600 w-3 h-3"
            />
            约束过原点 (p = kT)
          </label>
        </div>

        {fitResult.valid ? (
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-700/60">
              <span className="text-slate-400">拟合公式: </span>
              <span className="text-sky-300 font-bold">
                {originConstrained
                  ? `p = ${fitResult.originSlope.toFixed(4)} · T`
                  : `p = ${fitResult.slope.toFixed(3)}T ${
                      fitResult.intercept >= 0 ? '+' : ''
                    }${fitResult.intercept.toFixed(2)}`}
              </span>
            </div>
            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-slate-400">相关度 R²: </span>
                <span className="text-emerald-400 font-bold">
                  {fitResult.rSquared.toFixed(4)}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400/90 font-sans font-semibold">
                强正相关 (p ∝ T)
              </span>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 italic py-1 text-center font-sans text-[11px]">
            {fitResult.message || '请打点记录至少 2 组数据以自动生成最佳拟合公式'}
          </div>
        )}
      </div>
    </div>
  );
};
