import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { RealtimeDataCard } from './components/LeftPanel/RealtimeDataCard';
import { DataTable } from './components/LeftPanel/DataTable';
import { PTChart } from './components/LeftPanel/PTChart';
import { CameraFeed } from './components/CenterPanel/CameraFeed';
import { MolecularWorkbench } from './components/RightPanel/MolecularWorkbench';
import { HelpModal } from './components/HelpModal';

import {
  ExperimentRecord,
  SensorReading,
  WorkbenchMode,
  ReplayState,
} from './types/physics';
import { MockDataGenerator } from './sensors/mockDataGenerator';
import { ScreenCaptureManager } from './sensors/screenCapture';
import { OcrRecognizerService } from './sensors/ocrRecognizer';
import { CameraStreamManager } from './sensors/cameraManager';
import { exportToCSV } from './utils/exportData';

export const App: React.FC = () => {
  // 1. 工作模式
  const [mode, setMode] = useState<WorkbenchMode>('screen-sensor');
  const [showHelp, setShowHelp] = useState(false);
  const [showCelsiusConversion, setShowCelsiusConversion] = useState(true);

  // 2. 实时感知数据
  const [reading, setReading] = useState<SensorReading>({
    pressure: 103.2,
    temperature: 293.8,
    celsius: 20.65,
    volume: 50.0,
    status: 'valid',
    confidence: 0.95,
    lastUpdated: Date.now(),
    statusMessage: '就绪',
  });

  // 3. 服务实例与屏幕映射状态
  const mockGenRef = useRef<MockDataGenerator | null>(null);
  const screenCapRef = useRef<ScreenCaptureManager>(new ScreenCaptureManager());
  const ocrServiceRef = useRef<OcrRecognizerService>(new OcrRecognizerService());
  const cameraManagerRef = useRef<CameraStreamManager>(new CameraStreamManager());

  const [isSimulating, setIsSimulating] = useState(false);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [latestRoiCanvas, setLatestRoiCanvas] = useState<HTMLCanvasElement | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');

  // 映射窗口上的单一统一识别选区 (默认预设在 DISLab 下半部读数区域)
  const [roi, setRoi] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0.02,
    y: 0.72,
    width: 0.60,
    height: 0.10,
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

  // 初始化模拟发生器与 OCR
  useEffect(() => {
    const gen = new MockDataGenerator((newReading) => {
      setReading({
        ...newReading,
        volume: defaultVolume,
      });
    });
    mockGenRef.current = gen;

    // 监听屏幕共享结束
    screenCapRef.current.setOnEnded(() => {
      setIsCapturingScreen(false);
      setScreenStream(null);
    });

    return () => {
      gen.stop();
      screenCapRef.current.stopCapture();
      ocrServiceRef.current.terminate();
      cameraManagerRef.current.stopStream();
    };
  }, [defaultVolume]);

  // 模式切换时响应
  const handleModeChange = (newMode: WorkbenchMode) => {
    setMode(newMode);
    if (newMode === 'demo') {
      if (isCapturingScreen) {
        screenCapRef.current.stopCapture();
        setIsCapturingScreen(false);
        setScreenStream(null);
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

  // 启动屏幕捕获并直接映射
  const handleStartScreenCapture = async () => {
    try {
      const stream = await screenCapRef.current.startCapture();
      if (stream) {
        setScreenStream(stream);
        setIsCapturingScreen(true);
        setMode('screen-sensor');
        await ocrServiceRef.current.init();
      }
    } catch (err) {
      console.error('启动窗口共享失败:', err);
    }
  };

  const handleStopScreenCapture = () => {
    screenCapRef.current.stopCapture();
    setIsCapturingScreen(false);
    setScreenStream(null);
  };

  // 定时执行 OCR 识别循环 (从用户直接框选的映射区域切取)
  useEffect(() => {
    if (!isCapturingScreen || mode !== 'screen-sensor') return;

    let isBusy = false;
    const intervalId = window.setInterval(async () => {
      if (isBusy) return;
      isBusy = true;

      try {
        const frame = screenCapRef.current.captureRoi(roi);
        if (!frame || !frame.roiCanvas) {
          isBusy = false;
          return;
        }

        setLatestRoiCanvas(frame.roiCanvas);

        const result = await ocrServiceRef.current.recognizeRoi(frame.roiCanvas);
        if (result.rawText) {
          setRawOcrText(result.rawText);
        }

        setReading((prev) => {
          let pVal = result.pressure !== null ? result.pressure : prev.pressure;
          let tVal = result.temperature !== null ? result.temperature : prev.temperature;

          // 摄氏度 / 开尔文处理
          let celsius = tVal;
          let kelvin = tVal;
          if (showCelsiusConversion) {
            if (tVal < 180) {
              celsius = tVal;
              kelvin = tVal + 273.15;
            } else {
              kelvin = tVal;
              celsius = tVal - 273.15;
            }
          }

          const hasValidData = result.pressure !== null || result.temperature !== null;
          return {
            pressure: Number(pVal.toFixed(1)),
            temperature: Number(kelvin.toFixed(1)),
            celsius: Number(celsius.toFixed(1)),
            volume: defaultVolume,
            status: hasValidData ? 'valid' : 'holding',
            confidence: result.confidence || 0.9,
            lastUpdated: Date.now(),
            statusMessage: hasValidData ? 'OCR 识别正常' : '保持上一帧读数',
          };
        });
      } catch (err) {
        console.error('OCR 定时轮询异常:', err);
      } finally {
        isBusy = false;
      }
    }, 800);

    return () => clearInterval(intervalId);
  }, [isCapturingScreen, mode, roi, showCelsiusConversion, defaultVolume]);

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
      handleAddRecord();
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
    setReplayState((prev) => ({ ...prev, currentTime: time }));
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

      {/* 主界面三列响应式工作区 */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1920px] mx-auto w-full">
        {/* ================= 模块 A：左侧——数据感知与图表分析 (占 4 列) ================= */}
        <section className="lg:col-span-4 flex flex-col space-y-4">
          {/* 1. 实时数据窗口 (包含直接映射窗口与鼠标拖拽框选) */}
          <RealtimeDataCard
            reading={reading}
            mode={mode}
            isSimulating={isSimulating}
            isCapturingScreen={isCapturingScreen}
            screenStream={screenStream}
            onToggleSimulate={handleToggleSimulate}
            onResetSimulate={handleResetSimulate}
            onSetSimulateTemp={handleSetSimulateTemp}
            onStartScreenCapture={handleStartScreenCapture}
            onStopScreenCapture={handleStopScreenCapture}
            roi={roi}
            onRoiChange={setRoi}
            latestRoiCanvas={latestRoiCanvas}
            rawOcrText={rawOcrText}
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

      {/* 教学原理与使用说明模态弹窗 */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};
