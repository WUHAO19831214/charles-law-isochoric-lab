import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { RealtimeDataCard } from './components/LeftPanel/RealtimeDataCard';
import { DataTable } from './components/LeftPanel/DataTable';
import { PTChart } from './components/LeftPanel/PTChart';
import { CameraFeed } from './components/CenterPanel/CameraFeed';
import { MolecularWorkbench } from './components/RightPanel/MolecularWorkbench';
import { ScreenRoiModal } from './components/LeftPanel/ScreenRoiModal';
import { HelpModal } from './components/HelpModal';

import {
  ExperimentRecord,
  SensorReading,
  WorkbenchMode,
  RoiBox,
  ReplayState,
} from './types/physics';
import { MockDataGenerator } from './sensors/mockDataGenerator';
import { ScreenCaptureManager } from './sensors/screenCapture';
import { OcrRecognizerService } from './sensors/ocrRecognizer';
import { CameraStreamManager } from './sensors/cameraManager';
import { exportToCSV } from './utils/exportData';

export const App: React.FC = () => {
  // 1. 工作模式
  const [mode, setMode] = useState<WorkbenchMode>('demo');
  const [showHelp, setShowHelp] = useState(false);
  const [showCelsiusConversion, setShowCelsiusConversion] = useState(true);

  // 2. 实时感知数据
  const [reading, setReading] = useState<SensorReading>({
    pressure: 101.32,
    temperature: 293.15,
    celsius: 20.0,
    volume: 50.0,
    status: 'valid',
    confidence: 0.98,
    lastUpdated: Date.now(),
  });

  // 3. 服务实例保持
  const mockGenRef = useRef<MockDataGenerator | null>(null);
  const screenCapRef = useRef<ScreenCaptureManager>(new ScreenCaptureManager());
  const ocrServiceRef = useRef<OcrRecognizerService>(new OcrRecognizerService());
  const cameraManagerRef = useRef<CameraStreamManager>(new CameraStreamManager());

  const [isSimulating, setIsSimulating] = useState(false);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [isRoiModalOpen, setIsRoiModalOpen] = useState(false);

  // ROI 选区预设 (压强左，温度右)
  const [pRoi, setPRoi] = useState<RoiBox>({
    id: 'pressure',
    name: '压强 ROI',
    x: 0.05,
    y: 0.2,
    width: 0.42,
    height: 0.45,
  });
  const [tRoi, setTRoi] = useState<RoiBox>({
    id: 'temperature',
    name: '温度 ROI',
    x: 0.52,
    y: 0.2,
    width: 0.42,
    height: 0.45,
  });

  // 4. 表格记录管理
  const [defaultVolume, setDefaultVolume] = useState(50.0);
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [isContinuousRecording, setIsContinuousRecording] = useState(false);
  const [samplingInterval, setSamplingInterval] = useState(1.0);
  const experimentStartTimeRef = useRef<number | null>(null);

  // 5. 复盘回放系统状态
  const [replayState, setReplayState] = useState<ReplayState>({
    isActive: false,
    isPlaying: false,
    currentTime: 0,
    speed: 1.0,
    currentIndex: 0,
    maxTime: 0,
  });

  // 初始化模拟信号发生器
  useEffect(() => {
    const gen = new MockDataGenerator((newReading) => {
      setReading({
        ...newReading,
        volume: defaultVolume,
      });
    });
    mockGenRef.current = gen;

    // 默认演示模式自启动模拟发生器提供基础读数
    const initial = gen.generateCurrentReading();
    setReading({ ...initial, volume: defaultVolume });

    return () => {
      gen.stop();
      screenCapRef.current.stopCapture();
      ocrServiceRef.current.terminate();
      cameraManagerRef.current.stopStream();
    };
  }, []);

  // 模式切换时响应
  const handleModeChange = (newMode: WorkbenchMode) => {
    setMode(newMode);
    if (newMode === 'demo') {
      if (isCapturingScreen) {
        screenCapRef.current.stopCapture();
        setIsCapturingScreen(false);
      }
    } else {
      if (isSimulating) {
        mockGenRef.current?.stop();
        setIsSimulating(false);
      }
    }
  };

  // 模拟发生器控制
  const handleToggleSimulate = () => {
    if (isSimulating) {
      mockGenRef.current?.stop();
      setIsSimulating(false);
    } else {
      mockGenRef.current?.start();
      setIsSimulating(true);
    }
  };

  const handleResetSimulate = () => {
    mockGenRef.current?.reset(293.15);
  };

  const handleSetSimulateTemp = (tempK: number) => {
    mockGenRef.current?.setManualTemperature(tempK);
  };

  // 屏幕捕获与 OCR 循环
  const handleStartScreenCapture = async () => {
    const ok = await screenCapRef.current.startCapture();
    if (ok) {
      setIsCapturingScreen(true);
      await ocrServiceRef.current.init();
    }
  };

  const handleStopScreenCapture = () => {
    screenCapRef.current.stopCapture();
    setIsCapturingScreen(false);
  };

  // 定时执行 OCR 识别
  useEffect(() => {
    if (!isCapturingScreen || mode !== 'screen-sensor') return;

    const intervalId = window.setInterval(async () => {
      const frame = screenCapRef.current.captureFrame(pRoi, tRoi);
      if (!frame || !frame.pressureCanvas || !frame.temperatureCanvas) return;

      const pResult = await ocrServiceRef.current.recognizeNumber(frame.pressureCanvas);
      const tResult = await ocrServiceRef.current.recognizeNumber(frame.temperatureCanvas);

      setReading((prev) => {
        let pVal = pResult.value !== null ? pResult.value : prev.pressure;
        let tVal = tResult.value !== null ? tResult.value : prev.temperature;

        // 如果识别到的数值小于 150，通常为摄氏度，根据设置自动换算
        let celsius = tVal;
        let kelvin = tVal;
        if (showCelsiusConversion) {
          if (tVal < 200) {
            celsius = tVal;
            kelvin = tVal + 273.15;
          } else {
            kelvin = tVal;
            celsius = tVal - 273.15;
          }
        }

        const valid = pResult.value !== null && tResult.value !== null;
        return {
          pressure: Number(pVal.toFixed(2)),
          temperature: Number(kelvin.toFixed(2)),
          celsius: Number(celsius.toFixed(2)),
          volume: defaultVolume,
          status: valid ? 'valid' : 'holding',
          confidence: Math.min(pResult.confidence, tResult.confidence) || 0.85,
          lastUpdated: Date.now(),
          statusMessage: valid ? 'OCR 识别正常' : '数值保持中',
        };
      });
    }, 1200);

    return () => clearInterval(intervalId);
  }, [isCapturingScreen, mode, pRoi, tRoi, showCelsiusConversion, defaultVolume]);

  // 单次记录打点
  const handleAddRecord = useCallback(() => {
    const now = Date.now();
    if (!experimentStartTimeRef.current) {
      experimentStartTimeRef.current = now;
    }
    const relTime = (now - experimentStartTimeRef.current) / 1000;

    const newRecord: ExperimentRecord = {
      id: `rec-${now}-${Math.random().toString(36).slice(2, 6)}`,
      index: records.length + 1,
      time: Number(relTime.toFixed(1)),
      timestamp: now,
      pressure: reading.pressure,
      temperature: reading.temperature,
      celsius: reading.celsius,
      volume: defaultVolume,
    };

    setRecords((prev) => [...prev, newRecord]);
  }, [records.length, reading, defaultVolume]);

  // 连续记录定时器
  useEffect(() => {
    if (!isContinuousRecording) return;
    const intervalMs = samplingInterval * 1000;
    const timer = setInterval(() => {
      handleAddRecord();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isContinuousRecording, samplingInterval, handleAddRecord]);

  const handleToggleContinuousRecording = () => {
    if (!isContinuousRecording && records.length === 0) {
      experimentStartTimeRef.current = Date.now();
      handleAddRecord(); // 立即记录第一个初始点
    }
    setIsContinuousRecording(!isContinuousRecording);
  };

  const handleClearRecords = () => {
    setRecords([]);
    experimentStartTimeRef.current = null;
    setIsContinuousRecording(false);
    setReplayState((prev) => ({
      ...prev,
      isActive: false,
      isPlaying: false,
      currentTime: 0,
      maxTime: 0,
      currentIndex: 0,
    }));
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleExportCsv = () => {
    exportToCSV(records, defaultVolume);
  };

  // 复盘回放系统驱动
  const handleToggleReplayActive = () => {
    if (records.length === 0) return;
    const maxT = records[records.length - 1].time;
    setReplayState((prev) => ({
      ...prev,
      isActive: !prev.isActive,
      isPlaying: !prev.isActive,
      currentTime: 0,
      maxTime: maxT,
      currentIndex: 0,
    }));
  };

  const handlePlayPause = () => {
    setReplayState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const handleSeek = (time: number) => {
    setReplayState((prev) => ({
      ...prev,
      currentTime: time,
    }));
  };

  const handleChangeSpeed = (speed: number) => {
    setReplayState((prev) => ({ ...prev, speed }));
  };

  const handleStep = (dir: number) => {
    if (records.length === 0) return;
    const newIdx = Math.max(0, Math.min(records.length - 1, replayState.currentIndex + dir));
    const targetTime = records[newIdx].time;
    setReplayState((prev) => ({
      ...prev,
      currentIndex: newIdx,
      currentTime: targetTime,
    }));
  };

  // 回放时钟步进循环
  useEffect(() => {
    if (!replayState.isActive || !replayState.isPlaying || records.length === 0) return;

    let lastTick = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const dt = ((now - lastTick) / 1000) * replayState.speed;
      lastTick = now;

      setReplayState((prev) => {
        const nextTime = prev.currentTime + dt;
        if (nextTime >= prev.maxTime) {
          return {
            ...prev,
            currentTime: prev.maxTime,
            isPlaying: false,
          };
        }

        // 计算当前对应的记录行
        let idx = 0;
        for (let i = 0; i < records.length; i++) {
          if (records[i].time <= nextTime) {
            idx = i;
          } else {
            break;
          }
        }

        return {
          ...prev,
          currentTime: nextTime,
          currentIndex: idx,
        };
      });
    }, 50);

    return () => clearInterval(interval);
  }, [replayState.isActive, replayState.isPlaying, replayState.speed, records]);

  // 获取当前用于驱动 3D 试管与指示器的温度与高亮记录
  const activeReplayRecord = replayState.isActive && records.length > 0
    ? records[replayState.currentIndex]
    : null;

  const currentDrivenTemperature = replayState.isActive && activeReplayRecord
    ? activeReplayRecord.temperature
    : reading.temperature;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* 顶部标题栏 */}
      <Header
        mode={mode}
        onModeChange={handleModeChange}
        onOpenHelp={() => setShowHelp(true)}
      />

      {/* 主界面：严格对标用户附图的三列响应式工作区 */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1920px] mx-auto w-full">
        {/* ================= 模块 A：左侧——数据感知与图表分析 (占 4 列) ================= */}
        <section className="lg:col-span-4 flex flex-col space-y-4">
          {/* 1. 实时数据窗口 */}
          <RealtimeDataCard
            reading={reading}
            mode={mode}
            isSimulating={isSimulating}
            isCapturingScreen={isCapturingScreen}
            onToggleSimulate={handleToggleSimulate}
            onResetSimulate={handleResetSimulate}
            onSetSimulateTemp={handleSetSimulateTemp}
            onStartScreenCapture={handleStartScreenCapture}
            onStopScreenCapture={handleStopScreenCapture}
            onOpenRoiModal={() => setIsRoiModalOpen(true)}
            showCelsiusConversion={showCelsiusConversion}
            onToggleCelsiusConversion={() => setShowCelsiusConversion(!showCelsiusConversion)}
          />

          {/* 2. 数据表格控制与记录 */}
          <DataTable
            records={records}
            onAddRecord={handleAddRecord}
            onClearRecords={handleClearRecords}
            onDeleteRecord={handleDeleteRecord}
            onExportCsv={handleExportCsv}
            defaultVolume={defaultVolume}
            onDefaultVolumeChange={setDefaultVolume}
            isContinuousRecording={isContinuousRecording}
            onToggleContinuousRecording={handleToggleContinuousRecording}
            samplingInterval={samplingInterval}
            onSamplingIntervalChange={setSamplingInterval}
            highlightRecordId={activeReplayRecord?.id}
          />

          {/* 3. p - T 图像绘制区 */}
          <PTChart
            records={records}
            activeReplayTime={replayState.isActive ? replayState.currentTime : null}
          />
        </section>

        {/* ================= 模块 B：中间——实景实验摄像头捕获 (占 4 列) ================= */}
        <section className="lg:col-span-4 flex flex-col">
          <CameraFeed cameraManager={cameraManagerRef.current} />
        </section>

        {/* ================= 模块 C：右侧——试管微观气体分子 3D 可视化 (占 4 列) ================= */}
        <section className="lg:col-span-4 flex flex-col">
          <MolecularWorkbench
            temperature={currentDrivenTemperature}
            volume={defaultVolume}
            replayState={replayState}
            hasRecords={records.length > 0}
            onToggleReplayActive={handleToggleReplayActive}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onChangeSpeed={handleChangeSpeed}
            onStep={handleStep}
          />
        </section>
      </main>

      {/* 识别选区 ROI 设置弹窗 */}
      <ScreenRoiModal
        isOpen={isRoiModalOpen}
        onClose={() => setIsRoiModalOpen(false)}
        roiPressure={pRoi}
        roiTemperature={tRoi}
        onSaveRoi={(p, t) => {
          setPRoi(p);
          setTRoi(t);
        }}
        previewCanvas={null}
      />

      {/* 教学原理与使用说明模态弹窗 */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};
