import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Play, Square, Trash2, Download, AlertTriangle } from 'lucide-react';
import { ExperimentRecord } from '../../types/physics';

interface DataTableProps {
  records: ExperimentRecord[];
  onAddRecord: () => void;
  onClearRecords: () => void;
  onDeleteRecord: (id: string) => void;
  onExportCsv: () => void;
  defaultVolume: number;
  onDefaultVolumeChange: (vol: number) => void;
  isContinuousRecording: boolean;
  onToggleContinuousRecording: () => void;
  samplingInterval: number; // 秒
  onSamplingIntervalChange: (interval: number) => void;
  highlightRecordId?: string | null;
}

export const DataTable: React.FC<DataTableProps> = ({
  records,
  onAddRecord,
  onClearRecords,
  onDeleteRecord,
  onExportCsv,
  defaultVolume,
  onDefaultVolumeChange,
  isContinuousRecording,
  onToggleContinuousRecording,
  samplingInterval,
  onSamplingIntervalChange,
  highlightRecordId,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // 记录追加时自动滚动内部表格到底部 (不影响全局页面滚动条)
  useEffect(() => {
    if (!highlightRecordId && tableContainerRef.current) {
      tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
    }
  }, [records.length, highlightRecordId]);

  return (
    <div className="bg-slate-900 rounded-xl border border-blue-900/60 overflow-hidden shadow-lg flex flex-col flex-1 min-h-[300px]">
      {/* 顶部操作控制条 */}
      <div className="p-3 bg-slate-950/60 border-b border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* 容积配置 */}
          <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700">
            <span className="text-slate-300 font-medium">默认容积 V:</span>
            <input
              type="number"
              step="1"
              min="1"
              value={defaultVolume}
              onChange={(e) => onDefaultVolumeChange(parseFloat(e.target.value) || 50)}
              className="w-14 bg-slate-900 border border-slate-700 text-slate-100 rounded px-1.5 py-0.5 text-center font-mono focus:outline-none focus:border-blue-500"
            />
            <span className="text-slate-400">mL</span>
          </div>

          {/* 采样频率 */}
          <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700">
            <span className="text-slate-300 font-medium">连续频率:</span>
            <select
              value={samplingInterval}
              onChange={(e) => onSamplingIntervalChange(parseFloat(e.target.value))}
              disabled={isContinuousRecording}
              className="bg-slate-900 border border-slate-700 text-slate-100 rounded px-1.5 py-0.5 text-xs focus:outline-none"
            >
              <option value={0.5}>0.5 秒/次</option>
              <option value={1.0}>1.0 秒/次</option>
              <option value={2.0}>2.0 秒/次</option>
            </select>
          </div>
        </div>

        {/* 核心操作按钮组 */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <button
            onClick={onAddRecord}
            className="flex-1 min-w-[80px] py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            单次打点/记录
          </button>

          <button
            onClick={onToggleContinuousRecording}
            className={`flex-1 min-w-[90px] py-1.5 px-2 font-semibold rounded-lg shadow flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
              isContinuousRecording
                ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isContinuousRecording ? (
              <>
                <Square className="w-3.5 h-3.5" />
                停止记录
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                开始连续记录
              </>
            )}
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={records.length === 0}
            className="py-1.5 px-2.5 bg-slate-800 hover:bg-rose-900/60 disabled:opacity-40 text-slate-300 hover:text-rose-200 rounded-lg border border-slate-700 transition flex items-center gap-1"
            title="清空记录表"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空
          </button>

          <button
            onClick={onExportCsv}
            disabled={records.length === 0}
            className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1"
            title="导出 CSV 表格文件"
          >
            <Download className="w-3.5 h-3.5" />
            导出
          </button>
        </div>
      </div>

      {/* 清空二次确认模态提示 */}
      {showClearConfirm && (
        <div className="bg-rose-950/90 border-b border-rose-800 p-2 text-xs flex items-center justify-between text-rose-200">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>确认清空当前全部 {records.length} 条实验数据？</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClearRecords();
                setShowClearConfirm(false);
              }}
              className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold hover:bg-rose-500"
            >
              确定
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 数据表格主体 - 严格对照附图表头：时间 (s) | 压强 (kPa) | 热力学温度 (K) | 体积 (ml) */}
      <div ref={tableContainerRef} className="flex-1 overflow-y-auto max-h-[260px] scrollbar-thin scrollbar-thumb-slate-700">
        <table className="w-full text-center border-collapse">
          <thead className="sticky top-0 bg-blue-700 text-white text-xs font-bold shadow-md z-10 select-none">
            <tr>
              <th className="py-2 px-1 border-r border-blue-600/70 w-1/4">时间 (s)</th>
              <th className="py-2 px-1 border-r border-blue-600/70 w-1/4">压强 (kPa)</th>
              <th className="py-2 px-1 border-r border-blue-600/70 w-1/4">热力学温度 (K)</th>
              <th className="py-2 px-1 w-1/4">体积 (ml)</th>
            </tr>
          </thead>
          <tbody className="text-xs font-mono divide-y divide-slate-800">
            {records.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-slate-500 italic font-sans">
                  暂无打点数据，请点击上方“单次打点”或“连续记录”
                </td>
              </tr>
            ) : (
              records.map((r, idx) => {
                const isHighlighted = r.id === highlightRecordId;
                const isLatest = idx === records.length - 1;
                return (
                  <tr
                    key={r.id}
                    className={`transition-colors group ${
                      isHighlighted
                        ? 'bg-blue-600/40 text-blue-200 font-bold border-l-4 border-blue-400'
                        : isLatest
                        ? 'bg-blue-950/40 text-slate-200'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <td className="py-2 px-1 border-r border-slate-800/60 flex items-center justify-center gap-1">
                      <span>{r.time.toFixed(1)}</span>
                      <button
                        onClick={() => onDeleteRecord(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition ml-1"
                        title="删除此行"
                      >
                        ×
                      </button>
                    </td>
                    <td className="py-2 px-1 border-r border-slate-800/60 font-semibold text-blue-300">
                      {r.pressure.toFixed(1)}
                    </td>
                    <td className="py-2 px-1 border-r border-slate-800/60 font-semibold text-red-300">
                      {r.temperature.toFixed(1)}
                    </td>
                    <td className="py-2 px-1 text-slate-400">
                      {(r.volume || defaultVolume).toFixed(1)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 底部记录统计栏 */}
      <div className="bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800">
        <span>当前共记录: {records.length} 组有效点</span>
        {records.length >= 2 && (
          <span className="text-emerald-400">
            ΔT = {(records[records.length - 1].temperature - records[0].temperature).toFixed(1)} K
          </span>
        )}
      </div>
    </div>
  );
};
