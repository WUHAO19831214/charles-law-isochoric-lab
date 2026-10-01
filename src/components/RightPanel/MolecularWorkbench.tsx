import React, { useState } from 'react';
import { Box, Sparkles, Zap, ShieldAlert, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { TubeScene } from '../../simulation/TubeScene';
import { MolecularSimulationMetrics } from '../../simulation/molecularSystem';
import { MaxwellPlot } from './MaxwellPlot';
import { ReplayController } from './ReplayController';
import { ReplayState } from '../../types/physics';

interface MolecularWorkbenchProps {
  temperature: number; // 当前驱动温度
  volume: number;      // 容积 (mL)
  replayState: ReplayState;
  hasRecords: boolean;
  onToggleReplayActive: () => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onChangeSpeed: (speed: number) => void;
  onStep: (direction: number) => void;
}

export const MolecularWorkbench: React.FC<MolecularWorkbenchProps> = ({
  temperature,
  volume,
  replayState,
  hasRecords,
  onToggleReplayActive,
  onPlayPause,
  onSeek,
  onChangeSpeed,
  onStep,
}) => {
  const [metrics, setMetrics] = useState<MolecularSimulationMetrics | null>(null);
  const [showMaxwellPlot, setShowMaxwellPlot] = useState(true);

  return (
    <div className="bg-slate-900 rounded-xl border border-blue-900/60 overflow-hidden shadow-lg flex flex-col h-full min-h-[580px]">
      {/* 顶部标题栏，严格匹配附图长标题 */}
      <div className="bg-blue-600 px-4 py-2 flex items-center justify-between text-white font-bold text-sm tracking-wide">
        <div className="flex items-center space-x-2 leading-snug">
          <Box className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs md:text-sm">
            结合温度、体积的实验数据用虚拟可视化模拟气体分子运动微观解释
          </span>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col space-y-3">
        {/* 3D 试管微观视口 */}
        <div className="flex-1 min-h-[300px] relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
          <TubeScene
            temperature={temperature}
            onMetricsUpdate={setMetrics}
            speedScale={replayState.isActive ? replayState.speed : 1.0}
          />

          {/* 浮动微观量状态指示卡 */}
          <div className="absolute top-2.5 right-2.5 bg-slate-900/85 backdrop-blur-md p-2.5 rounded-lg border border-slate-700/80 text-xs space-y-1.5 shadow-xl font-mono text-slate-200">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">驱动温度 T:</span>
              <span className="font-bold text-red-400">{temperature.toFixed(1)} K</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">试管容积 V:</span>
              <span className="font-bold text-sky-400">{volume.toFixed(1)} mL (恒定)</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">方均根速率:</span>
              <span className="font-bold text-amber-400">
                {metrics?.vRmsMeasured ? `${metrics.vRmsMeasured.toFixed(2)} m/s` : '--'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">器壁碰撞率:</span>
              <span className="font-bold text-emerald-400">
                {metrics?.wallCollisionsPerSec ? `${metrics.wallCollisionsPerSec} 次/秒` : '--'}
              </span>
            </div>
          </div>

          {/* 等容密闭教学提示 */}
          <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur px-2.5 py-1 rounded border border-blue-900/60 text-[11px] text-blue-300 pointer-events-none flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>等容状态：试管密封塞固定 · 气体分子数 N = 260</span>
          </div>
        </div>

        {/* 麦克斯韦-玻尔兹曼速率分布 f(v) 教学展开区 */}
        <div className="bg-slate-950/90 rounded-lg border border-slate-800 p-2 space-y-1.5">
          <div
            onClick={() => setShowMaxwellPlot(!showMaxwellPlot)}
            className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-300 hover:text-white"
          >
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
              <span>麦克斯韦-玻尔兹曼速率分布 f(v) 与温度效应</span>
            </div>
            {showMaxwellPlot ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          {showMaxwellPlot && <MaxwellPlot temperature={temperature} />}
        </div>

        {/* 实验过程复盘回放控制条 */}
        <ReplayController
          replayState={replayState}
          hasRecords={hasRecords}
          onToggleReplayActive={onToggleReplayActive}
          onPlayPause={onPlayPause}
          onSeek={onSeek}
          onChangeSpeed={onChangeSpeed}
          onStep={onStep}
        />
      </div>
    </div>
  );
};
