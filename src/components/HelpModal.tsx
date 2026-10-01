import React from 'react';
import { X, BookOpen, Atom, Activity } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-lg text-white">
              “气体的等容变化（查理定律）” 实验原理与操作指南
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 宏观规律 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-blue-300 flex items-center gap-1.5">
            <Activity className="w-4 h-4" />
            一、宏观物理规律：查理定律 (Charles's Law)
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed indent-6">
            一定质量的某种气体，在<strong>体积保持不变（等容）</strong>的条件下，其压强 $p$ 与热力学温度 $T$ 成正比：
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center font-mono text-sm text-sky-300 font-bold">
            p / T = C (常数) &nbsp;&nbsp; 或 &nbsp;&nbsp; p = k · T
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            • <strong>绝对零度外推：</strong>在 p - T 图像中，各等容线均为过坐标原点 (T = 0 K, p = 0 kPa) 的直线。如果在摄氏温标 p - t 图像中，直线向左反向延长将交于横轴的 -273.15 ℃ 处。
          </p>
        </div>

        {/* 微观机制 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
            <Atom className="w-4 h-4" />
            二、微观分子动理论解释与麦克斯韦分布
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed indent-6">
            根据气体分子动理论，温度是气体分子<strong>热运动平均动能的唯一量度</strong>（Ē_k = 3/2 · k_B · T）。分子速率服从<strong>麦克斯韦-玻尔兹曼速率分布</strong>，方均根速率满足 v_rms = √(3 k_B T / m) ∝ √T。
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            • <strong>压强增大的微观本质：</strong>当试管内气体等容升温时，分子密度保持恒定，而分子热运动加剧。这导致<strong>① 单位时间内撞击单位器壁面积的分子次数增加</strong>；<strong>② 每次碰撞分子给器壁的平均冲量增大</strong>。两重因素共同使宏观气体压强随温度成正比升高。
          </p>
        </div>

        {/* 软件工作流指南 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-emerald-300">
            三、教学工作台操作流程
          </h4>
          <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>
              <strong>选择模式：</strong>未连接硬件时可直接使用右上角的“演示模拟模式”一键开启水浴加热实验；连接物理传感器时切换至“传感器屏幕识别”。
            </li>
            <li>
              <strong>开启摄像头：</strong>在中间区域选择外接实验台摄像头，推流实景水浴加热装置。
            </li>
            <li>
              <strong>采样与打点：</strong>在左侧表格点击“单次打点”或设置频率“开始连续记录”，实验过程中可随时点击“线性拟合”观察动态生成的 $p = kT$ 关系曲线及相关系数 $R^2$。
            </li>
            <li>
              <strong>微观 3D 联动与复盘：</strong>右侧试管将随温度实时改变分子剧烈程度。实验结束后点击“开始复盘回放”，可拖动进度条完整重现实验全过程。
            </li>
          </ol>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white"
          >
            了解并返回工作台
          </button>
        </div>
      </div>
    </div>
  );
};
