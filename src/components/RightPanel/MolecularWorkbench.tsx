import React, { useState } from 'react';
import { Box, Sparkles, Activity, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { TubeScene } from '../../simulation/TubeScene';
import { MolecularSimulationMetrics } from '../../simulation/molecularSystem';
import { ClaudeMolecularScene } from '../../simulation/claudeModel/ClaudeMolecularScene';
import { MaxwellPlot } from './MaxwellPlot';
import { ReplayController } from './ReplayController';
import { ReplayState } from '../../types/physics';

export type SimulationStyle = 'default' | 'claude';

interface MolecularWorkbenchProps {
  temperature: number; // 当前驱动温度 (K)
  pressure?: number;   // 当前驱动压强 (kPa)
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
  pressure = 101.3,
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
  const [simStyle, setSimStyle] = useState<SimulationStyle>(() => {
    return (localStorage.getItem('gas_simulation_style') as SimulationStyle) || 'default';
  });
  const [syncClaude, setSyncClaude] = useState(true);

  const handleStyleChange = (style: SimulationStyle) => {
    setSimStyle(style);
    try {
      localStorage.setItem('gas_simulation_style', style);
    } catch {
      // ignore storage failure
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-blue-900/60 overflow-hidden shadow-lg flex flex-col h-full min-h-[580px]">
      {/* 顶部标题栏与模式切换器 */}
      <div className="bg-blue-600 px-3 py-2 flex flex-wrap items-center justify-between text-white font-bold text-sm tracking-wide gap-2">
        <div className="flex items-center space-x-2 leading-snug">
          <Box className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs md:text-sm">
            气体分子运动的微观解释
          </span>
        </div>

        {/* 仿真模式切换选项卡：模式1(默认动能温区) vs 模式2(Claude碰撞闪光) */}
        <div className="flex items-center bg-blue-900/80 p-0.5 rounded-lg border border-blue-400/30 text-xs font-normal">
          <button
            type="button"
            title="模式一：三色温区粒子着色与刻度试管（原版默认）"
            onClick={() => handleStyleChange('default')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              simStyle === 'default'
                ? 'bg-white text-blue-900 font-bold shadow-sm'
                : 'text-blue-100 hover:text-white hover:bg-blue-700/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>动能温区模式 (默认)</span>
          </button>
          <button
            type="button"
            title="模式二：圆底试管与器壁撞击微闪光特效（Claude版）"
            onClick={() => handleStyleChange('claude')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              simStyle === 'claude'
                ? 'bg-white text-blue-900 font-bold shadow-sm'
                : 'text-blue-100 hover:text-white hover:bg-blue-700/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>碰撞闪光模式 (Claude)</span>
          </button>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col space-y-3">
        {/* 3D 试管微观视口 */}
        <div className="flex-1 min-h-[300px] relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
          {simStyle === 'default' ? (
            /* ================= 模式一：默认 Antigravity 动能温区版 ================= */
            <>
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
            </>
          ) : (
            /* ================= 模式二：Claude 碰撞闪光版 ================= */
            <ClaudeMolecularScene
              temperature={temperature}
              pressure={pressure}
              volume={volume}
              speedScale={replayState.isActive ? replayState.speed : 1.0}
              syncOn={syncClaude}
              onToggleSync={() => setSyncClaude(!syncClaude)}
            />
          )}
        </div>

        {/* 仅在默认模式下展开麦克斯韦分布图（Claude模式内部已有极简HUD） */}
        {simStyle === 'default' && (
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
        )}

        {/* 实验过程复盘回放控制条（两套微观模式均可联动回放） */}
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
