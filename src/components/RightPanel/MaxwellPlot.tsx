import React, { useRef, useEffect } from 'react';
import { generateMaxwellCurve, getTheoreticalVrms, getTheoreticalVp, getTheoreticalVavg } from '../../simulation/maxwellBoltzmann';

interface MaxwellPlotProps {
  temperature: number;
}

export const MaxwellPlot: React.FC<MaxwellPlotProps> = ({ temperature }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // 清屏
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 30;
    const padRight = 15;
    const padTop = 15;
    const padBottom = 25;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const maxV = 8.0;
    const maxP = 0.65;

    const toX = (v: number) => padLeft + (v / maxV) * plotW;
    const toY = (p: number) => padTop + plotH - (p / maxP) * plotH;

    // 坐标轴
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.lineTo(padLeft + plotW, padTop + plotH);
    ctx.stroke();

    // 绘制 f(v) 理论曲线
    const curvePoints = generateMaxwellCurve(temperature, maxV, 60);

    ctx.beginPath();
    for (let i = 0; i < curvePoints.length; i++) {
      const pt = curvePoints[i];
      const x = toX(pt.v);
      const y = toY(pt.p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // 曲线渐变填充
    ctx.lineTo(toX(maxV), toY(0));
    ctx.lineTo(toX(0), toY(0));
    ctx.closePath();

    const gradient = ctx.createLinearGradient(padLeft, padTop, padLeft + plotW, padTop);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.35)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 曲线描边
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 标注方均根速率 v_rms 竖虚线
    const vRms = getTheoreticalVrms(temperature);
    const xRms = toX(vRms);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xRms, padTop);
    ctx.lineTo(xRms, padTop + plotH);
    ctx.stroke();
    ctx.restore();

    // 标注文字
    ctx.fillStyle = '#f59e0b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`v_rms=${vRms.toFixed(1)}`, Math.min(plotW + padLeft - 20, Math.max(padLeft + 25, xRms)), padTop + 10);

    // X 轴文字
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('速率 v', padLeft + plotW, padTop + plotH + 16);
    ctx.textAlign = 'left';
    ctx.fillText('f(v)', 6, padTop + 8);
  }, [temperature]);

  return (
    <div className="w-full h-24 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 relative">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-1 right-2 text-[10px] text-slate-400 font-mono">
        麦克斯韦速率分布 f(v)
      </div>
    </div>
  );
};
