export interface ExperimentRecord {
  id: string;
  index: number;
  time: number;          // 相对实验开始的时间 (s)
  timestamp: number;     // 绝对时间戳 (ms)
  pressure: number;      // 压强 p (kPa)
  temperature: number;   // 热力学温度 T (K)
  celsius: number;       // 摄氏温度 t (°C)
  volume: number;        // 容积 V (mL)
}

export interface LinearFitResult {
  slope: number;         // 最小二乘斜率 k (kPa / K)
  intercept: number;     // 截距 b (kPa)
  rSquared: number;      // 决定系数 R^2
  originSlope: number;   // 严格过原点拟合斜率 k0 (p = k0 * T)
  valid: boolean;
  message?: string;
}

export type SensorStatus = 'idle' | 'detecting' | 'valid' | 'holding' | 'disconnected' | 'error';

export interface SensorReading {
  pressure: number;      // 当前压强 (kPa)
  temperature: number;   // 当前热力学温度 (K)
  celsius: number;       // 当前摄氏温度 (°C)
  volume: number;        // 默认容积 (mL)
  status: SensorStatus;
  confidence: number;    // 置信度 (0 - 1)
  lastUpdated: number;   // 最近更新时间
  statusMessage?: string;
}

export interface RoiBox {
  id: 'pressure' | 'temperature';
  name: string;
  x: number;             // 归一化坐标 0..1
  y: number;
  width: number;
  height: number;
}

export interface ReplayState {
  isActive: boolean;
  isPlaying: boolean;
  currentTime: number;
  speed: number;         // 0.5, 1, 2, 4
  currentIndex: number;
  maxTime: number;
}

export type WorkbenchMode = 'demo' | 'screen-sensor';

export interface ParticleState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
}
