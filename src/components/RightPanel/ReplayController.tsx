import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Radio, History, SkipBack, SkipForward } from 'lucide-react';
import { ReplayState } from '../../types/physics';

interface ReplayControllerProps {
  replayState: ReplayState;
  hasRecords: boolean;
  onToggleReplayActive: () => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onChangeSpeed: (speed: number) => void;
  onStep: (direction: number) => void;
}

export const ReplayController: React.FC<ReplayControllerProps> = ({
  replayState,
  hasRecords,
  onToggleReplayActive,
  onPlayPause,
  onSeek,
  onChangeSpeed,
  onStep,
}) => {
  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleReplayActive}
            disabled={!hasRecords}
            className={`px-2.5 py-1 rounded font-semibold flex items-center gap-1.5 transition ${
              replayState.isActive
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40'
            }`}
          >
            {replayState.isActive ? <History className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
            {replayState.isActive ? '复盘回放中' : '开始复盘回放'}
          </button>
          <span className="text-[11px] text-slate-400">
            {replayState.isActive ? '读取表格历史数据' : '当前为实时同步状态'}
          </span>
        </div>

        {replayState.isActive && (
          <div className="flex items-center space-x-1">
            {[0.5, 1.0, 2.0].map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                  replayState.speed === s
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </div>

      {replayState.isActive && (
        <div className="space-y-1.5 pt-1">
          {/* 进度拖拽滑块 */}
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[11px] text-slate-300 min-w-[35px]">
              {formatTime(replayState.currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={Math.max(1, replayState.maxTime)}
              step="0.1"
              value={replayState.currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[11px] text-slate-400 min-w-[35px] text-right">
              {formatTime(replayState.maxTime)}
            </span>
          </div>

          {/* 回放播放控制按钮 */}
          <div className="flex items-center justify-center space-x-2 pt-0.5">
            <button
              onClick={() => onStep(-1)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="上一打点记录"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onPlayPause}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1 shadow"
            >
              {replayState.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {replayState.isPlaying ? '暂停' : '播放'}
            </button>
            <button
              onClick={() => onStep(1)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="下一打点记录"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
