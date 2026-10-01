import React from 'react';
import { Activity, Maximize, Minimize, HelpCircle, Layers, Sliders } from 'lucide-react';
import { WorkbenchMode } from '../types/physics';

interface HeaderProps {
  mode: WorkbenchMode;
  onModeChange: (mode: WorkbenchMode) => void;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({ mode, onModeChange, onOpenHelp }) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between select-none shadow-md">
      {/* 标题 */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-bold text-lg">
          V
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-wide text-white flex items-center gap-2">
            气体的等容变化
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/80 font-normal">
              查理定律 · 数字化教学工作台
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            宏观数据感知 · 实景实验推流 · 麦克斯韦-玻尔兹曼微观 3D 可视化
          </p>
        </div>
      </div>

      {/* 状态与控制项 */}
      <div className="flex items-center space-x-4">
        {/* 工作模式切换 */}
        <div className="bg-slate-800/90 p-1 rounded-lg border border-slate-700/80 flex items-center space-x-1 text-xs">
          <button
            onClick={() => onModeChange('demo')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              mode === 'demo'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 inline mr-1" />
            演示模拟模式
          </button>
          <button
            onClick={() => onModeChange('screen-sensor')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              mode === 'screen-sensor'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 inline mr-1" />
            传感器屏幕识别
          </button>
        </div>

        {/* 教学帮助 */}
        <button
          onClick={onOpenHelp}
          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors title='实验原理与说明'"
          title="实验原理与说明"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* 全屏按钮 */}
        <button
          onClick={toggleFullscreen}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title={isFullscreen ? '退出全屏' : '大屏全屏模式'}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};
