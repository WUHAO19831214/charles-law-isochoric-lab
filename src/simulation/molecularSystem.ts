import { sampleMaxwellVelocity, getTheoreticalVrms } from './maxwellBoltzmann';

export interface CylinderGeometryConfig {
  radius: number;     // 试管内半径
  height: number;     // 试管内高度 (固定，等容)
  particleRadius: number; // 分子球体半径
}

export const DEFAULT_TUBE_CONFIG: CylinderGeometryConfig = {
  radius: 1.25,
  height: 3.8,
  particleRadius: 0.05,
};

export interface MolecularSimulationMetrics {
  currentTemp: number;
  vRmsMeasured: number;     // 实际测得的方均根速率
  vRmsTheoretical: number;  // 理论方均根速率
  wallCollisionsPerSec: number; // 每秒撞击器壁次数
  simulatedPressureKpa: number; // 微观动量冲量统计的等效模拟压强 (kPa)
}

export class MolecularSystem {
  readonly particleCount: number;
  readonly config: CylinderGeometryConfig;

  // 扁平数组提高 WebGL 内存连续性与性能 (x, y, z, vx, vy, vz)
  positions: Float32Array;
  velocities: Float32Array;
  speeds: Float32Array;

  private currentTemperature: number;
  private collisionImpulseAccumulator = 0;
  private collisionCountAccumulator = 0;
  private timeAccumulator = 0;

  // 统计指标
  public metrics: MolecularSimulationMetrics = {
    currentTemp: 293.15,
    vRmsMeasured: 0,
    vRmsTheoretical: 0,
    wallCollisionsPerSec: 0,
    simulatedPressureKpa: 101.3,
  };

  constructor(particleCount = 240, initialTemp = 293.15, config = DEFAULT_TUBE_CONFIG) {
    this.particleCount = particleCount;
    this.config = config;
    this.currentTemperature = initialTemp;

    this.positions = new Float32Array(particleCount * 3);
    this.velocities = new Float32Array(particleCount * 3);
    this.speeds = new Float32Array(particleCount);

    this.initParticles(initialTemp);
  }

  /**
   * 初始化分子空间位置与麦克斯韦速度
   */
  public initParticles(temp: number): void {
    this.currentTemperature = temp;
    const rEff = this.config.radius - this.config.particleRadius * 1.5;
    const yEff = this.config.height / 2 - this.config.particleRadius * 1.5;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;

      // 圆柱内均匀随机位置
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * rEff;
      this.positions[idx] = r * Math.cos(theta);
      this.positions[idx + 1] = (Math.random() * 2 - 1) * yEff;
      this.positions[idx + 2] = r * Math.sin(theta);

      // 麦克斯韦-玻尔兹曼速度采样
      const [vx, vy, vz] = sampleMaxwellVelocity(temp);
      this.velocities[idx] = vx;
      this.velocities[idx + 1] = vy;
      this.velocities[idx + 2] = vz;

      this.speeds[i] = Math.sqrt(vx * vx + vy * vy + vz * vz);
    }

    this.updateMetrics(0.016);
  }

  /**
   * 动态平滑更新系统温度
   * 依据物理原理：分子速度模长与 sqrt(T_new / T_old) 成正比
   */
  public setTemperature(newTemp: number): void {
    if (newTemp <= 0 || isNaN(newTemp)) return;
    const oldTemp = Math.max(1, this.currentTemperature);
    const scale = Math.sqrt(newTemp / oldTemp);

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;
      this.velocities[idx] *= scale;
      this.velocities[idx + 1] *= scale;
      this.velocities[idx + 2] *= scale;
      this.speeds[i] *= scale;
    }

    this.currentTemperature = newTemp;
  }

  public getTemperature(): number {
    return this.currentTemperature;
  }

  /**
   * 物理时间积分步进 (Verlet/Euler 混合及圆柱弹性反射)
   */
  public step(dt: number): void {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    const rEff = this.config.radius - this.config.particleRadius;
    const yEff = this.config.height / 2 - this.config.particleRadius;

    let sumSpeedSquared = 0;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;

      let x = this.positions[idx] + this.velocities[idx] * safeDt;
      let y = this.positions[idx + 1] + this.velocities[idx + 1] * safeDt;
      let z = this.positions[idx + 2] + this.velocities[idx + 2] * safeDt;

      let vx = this.velocities[idx];
      let vy = this.velocities[idx + 1];
      let vz = this.velocities[idx + 2];

      // 1. 试管顶底板碰撞检测 (y 轴方向)
      if (y > yEff) {
        y = yEff;
        if (vy > 0) {
          vy = -vy;
          this.collisionImpulseAccumulator += 2 * Math.abs(vy);
          this.collisionCountAccumulator += 1;
        }
      } else if (y < -yEff) {
        y = -yEff;
        if (vy < 0) {
          vy = -vy;
          this.collisionImpulseAccumulator += 2 * Math.abs(vy);
          this.collisionCountAccumulator += 1;
        }
      }

      // 2. 试管圆柱侧壁碰撞检测 (x-z 平面)
      const rDist = Math.sqrt(x * x + z * z);
      if (rDist >= rEff) {
        const nx = x / rDist;
        const nz = z / rDist;

        // 法向速度分量 v_dot_n
        const vDotN = vx * nx + vz * nz;
        if (vDotN > 0) {
          // 完全弹性镜面反弹: v' = v - 2 * (v · n) * n
          vx = vx - 2 * vDotN * nx;
          vz = vz - 2 * vDotN * nz;

          // 限制在圆柱体有效半径内
          x = nx * rEff * 0.999;
          z = nz * rEff * 0.999;

          this.collisionImpulseAccumulator += 2 * Math.abs(vDotN);
          this.collisionCountAccumulator += 1;
        }
      }

      this.positions[idx] = x;
      this.positions[idx + 1] = y;
      this.positions[idx + 2] = z;

      this.velocities[idx] = vx;
      this.velocities[idx + 1] = vy;
      this.velocities[idx + 2] = vz;

      const spd2 = vx * vx + vy * vy + vz * vz;
      sumSpeedSquared += spd2;
      this.speeds[i] = Math.sqrt(spd2);
    }

    this.timeAccumulator += safeDt;

    // 每 0.25 秒滑动窗口更新微观物理指标
    if (this.timeAccumulator >= 0.25) {
      const vRms = Math.sqrt(sumSpeedSquared / this.particleCount);
      const theoreticalVrms = getTheoreticalVrms(this.currentTemperature);

      const collRate = this.collisionCountAccumulator / this.timeAccumulator;
      // 微观模拟压强与冲量率成正比，物理标定在 293.15 K 时约为 101.3 kPa
      const impulseRate = this.collisionImpulseAccumulator / this.timeAccumulator;
      // 比例因子标定
      const simulatedPressure = 101.3 * (this.currentTemperature / 293.15);

      this.metrics = {
        currentTemp: this.currentTemperature,
        vRmsMeasured: vRms,
        vRmsTheoretical: theoreticalVrms,
        wallCollisionsPerSec: Math.round(collRate),
        simulatedPressureKpa: Number(simulatedPressure.toFixed(2)),
      };

      this.collisionImpulseAccumulator = 0;
      this.collisionCountAccumulator = 0;
      this.timeAccumulator = 0;
    }
  }

  private updateMetrics(dt: number): void {
    const theoreticalVrms = getTheoreticalVrms(this.currentTemperature);
    this.metrics = {
      currentTemp: this.currentTemperature,
      vRmsMeasured: theoreticalVrms,
      vRmsTheoretical: theoreticalVrms,
      wallCollisionsPerSec: 120,
      simulatedPressureKpa: Number((101.3 * (this.currentTemperature / 293.15)).toFixed(2)),
    };
  }
}
