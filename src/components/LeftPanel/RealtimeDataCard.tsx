import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Monitor, Crop, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { SensorReading, WorkbenchMode } from '../../types/physics';

interface RealtimeDataCardProps {
  reading: SensorReading;
  mode: WorkbenchMode;
  isSimulating: boolean;
  isCapturingScreen: boolean;
  onToggleSimulate: () => void;
  onResetSimulate: () => void;
  onSetSimulateTemp: (tempK: number) => void;
  onStartScreenCapture: () => void;
  onStopScreenCapture: () => void;
  onOpenRoiModal: () => void;
  showCelsiusConversion: boolean;
  onToggleCelsiusConversion: () => void;
}

export const RealtimeDataCard: React.FC<RealtimeDataCardProps> = ({
  reading,
  mode,
  isSimulating,
  isCapturingScreen,
  onToggleSimulate,
  onResetSimulate,
  onSetSimulateTemp,
  onStartScreenCapture,
  onStopScreenCapture,
  onOpenRoiModal,
  showCelsiusConversion,
  onToggleCelsiusConversion,
}) => {
  return (
    <div className="bg-slate-900 rounded-xl border border-blue-900/60 overflow-hidden shadow-lg flex flex-col">
      {/* 顶部标题栏，严格契合附图深蓝主色调 */}
      <div className="bg-blue-600 px-4 py-2 flex items-center justify-between text-white font-bold text-sm tracking-wide">
        <div className="flex items-center space-x-2">
          <span>实时数据窗口</span>
          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-blue-700/80 border border-blue-400/40">
            {mode === 'demo' ? '模拟信号源' : '屏幕 OCR 捕获'}
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
            {reading.status === 'valid' ? '信号正常' : reading.statusMessage || '就绪'}
          </span>
        </div>
      </div>

      <div className="p-3.5 space-y-3">
        {/* 核心醒目读数区 - 仿附图纯白/高对比度展示框 */}
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
          <span className="font-mono text-slate-400 text-[11px]">
            置信度: {(reading.confidence * 100).toFixed(0)}%
          </span>
        </div>

        {/* 模式专属控制器 */}
        {mode === 'demo' ? (
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
        ) : (
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/80 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              {!isCapturingScreen ? (
                <button
                  onClick={onStartScreenCapture}
                  className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-1.5 transition shadow"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  共享/选择传感器软件窗口
                </button>
              ) : (
                <button
                  onClick={onStopScreenCapture}
                  className="flex-1 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center justify-center gap-1.5 transition"
                >
                  停止屏幕捕获
                </button>
              )}
              <button
                onClick={onOpenRoiModal}
                disabled={!isCapturingScreen}
                className="px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 font-medium flex items-center gap-1 transition"
                title="框选压强与温度数字区域"
              >
                <Crop className="w-3.5 h-3.5" />
                选区标定
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
