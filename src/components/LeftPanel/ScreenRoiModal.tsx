import React, { useState } from 'react';
import { X, Check, RefreshCw } from 'lucide-react';
import { RoiBox } from '../../types/physics';

interface ScreenRoiModalProps {
  isOpen: boolean;
  onClose: () => void;
  roiPressure: RoiBox;
  roiTemperature: RoiBox;
  onSaveRoi: (pRoi: RoiBox, tRoi: RoiBox) => void;
  previewCanvas: HTMLCanvasElement | null;
}

export const ScreenRoiModal: React.FC<ScreenRoiModalProps> = ({
  isOpen,
  onClose,
  roiPressure,
  roiTemperature,
  onSaveRoi,
  previewCanvas,
}) => {
  const [pRoi, setPRoi] = useState<RoiBox>(roiPressure);
  const [tRoi, setTRoi] = useState<RoiBox>(roiTemperature);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-base flex items-center gap-2">
            传感器画面 OCR 识别选区 (ROI) 标定
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          请指定传感器软件界面中显示“压强”与“温度”数值的相对位置坐标（0 ~ 1 归一化比例）。
        </p>

        {/* 选区坐标微调 */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-800/80 rounded-lg border border-blue-900/50 space-y-2">
            <div className="font-semibold text-blue-400">压强识别框 (p):</div>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div>
                X (左边距):
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={pRoi.x}
                  onChange={(e) => setPRoi({ ...pRoi, x: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 mt-1 text-slate-200"
                />
              </div>
              <div>
                Y (顶边距):
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={pRoi.y}
                  onChange={(e) => setPRoi({ ...pRoi, y: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 mt-1 text-slate-200"
                />
              </div>
              <div>
                宽度:
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="1"
                  value={pRoi.width}
                  onChange={(e) => setPRoi({ ...pRoi, width: parseFloat(e.target.value) || 0.1 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 mt-1 text-slate-200"
                />
              </div>
              <div>
                高度:
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="1"
                  value={pRoi.height}
                  onChange={(e) => setPRoi({ ...pRoi, height: parseFloat(e.target.value) || 0.1 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 mt-1 text-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-lg border border-red-900/50 space-y-2">
            <div className="font-semibold text-red-400">温度识别框 (T):</div>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div>
                X (左边距):
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={tRoi.x}
                  onChange={(e) => setTRoi({ ...tRoi, x: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 mt-1 text-slate-200"
                />
              </div>
              <div>
                Y (顶边距):
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={tRoi.y}
                  onChange={(e) => setTRoi({ ...tRoi, y: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 mt-1 text-slate-200"
                />
              </div>
              <div>
                宽度:
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="1"
                  value={tRoi.width}
                  onChange={(e) => setTRoi({ ...tRoi, width: parseFloat(e.target.value) || 0.1 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 mt-1 text-slate-200"
                />
              </div>
              <div>
                高度:
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="1"
                  value={tRoi.height}
                  onChange={(e) => setTRoi({ ...tRoi, height: parseFloat(e.target.value) || 0.1 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 mt-1 text-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 预设按钮 */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400">常用预设:</span>
          <button
            onClick={() => {
              setPRoi({ id: 'pressure', name: '压强', x: 0.1, y: 0.15, width: 0.35, height: 0.2 });
              setTRoi({ id: 'temperature', name: '温度', x: 0.55, y: 0.15, width: 0.35, height: 0.2 });
            }}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300"
          >
            并排双表盘 (左 p 右 T)
          </button>
          <button
            onClick={() => {
              setPRoi({ id: 'pressure', name: '压强', x: 0.2, y: 0.1, width: 0.6, height: 0.2 });
              setTRoi({ id: 'temperature', name: '温度', x: 0.2, y: 0.5, width: 0.6, height: 0.2 });
            }}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300"
          >
            上下双数值 (上 p 下 T)
          </button>
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300"
          >
            取消
          </button>
          <button
            onClick={() => {
              onSaveRoi(pRoi, tRoi);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            保存选区配置
          </button>
        </div>
      </div>
    </div>
  );
};
