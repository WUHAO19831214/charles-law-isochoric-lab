import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GasModel, DEFAULT_GAS_CONFIG } from './gasModel';

const FLASH_POOL = 28;

interface Hud {
  T: number | null;
  p: number | null;
  T0: number;
  p0: number;
  freqFactor: number;        // ① 撞得更勤: f/f₀ ≈ √(T/T₀)
  impulseFactor: number;     // ② 撞得更猛: Ī/Ī₀ ≈ √(T/T₀)
  microPressureRatio: number;// ③ 微观合成压强: (① × ②) ≈ T/T₀
  macroPressureRatio: number;// ④ 宏观实测压强: p/p₀
  collisionsPerSec: number;
}

interface ClaudeMolecularSceneProps {
  temperature: number;          // 当前驱动温度 (K)
  pressure?: number;            // 当前驱动压强 (kPa)
  baselineTemperature?: number; // 基准温度 T₀ (K)
  baselinePressure?: number;    // 基准压强 p₀ (kPa)
  volume?: number;              // 容器容积 (mL)
  speedScale?: number;          // 回放倍速
  syncOn?: boolean;             // 是否同步显示
  onToggleSync?: () => void;
}

export const ClaudeMolecularScene: React.FC<ClaudeMolecularSceneProps> = ({
  temperature,
  pressure = 101.3,
  baselineTemperature = 293.15,
  baselinePressure = 101.3,
  volume = 50.0,
  speedScale = 1.0,
  syncOn = true,
  onToggleSync,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<GasModel | null>(null);
  const simTempRef = useRef<number>(temperature || DEFAULT_GAS_CONFIG.referenceTemperatureK);
  const syncOnRef = useRef<boolean>(syncOn);
  const targetTempRef = useRef<number>(temperature);
  const targetPressureRef = useRef<number>(pressure);
  const baseTempRef = useRef<number>(baselineTemperature);
  const basePressRef = useRef<number>(baselinePressure);
  const speedScaleRef = useRef<number>(speedScale);

  const [hud, setHud] = useState<Hud>({
    T: temperature,
    p: pressure,
    T0: baselineTemperature,
    p0: baselinePressure,
    freqFactor: 1.0,
    impulseFactor: 1.0,
    microPressureRatio: 1.0,
    macroPressureRatio: 1.0,
    collisionsPerSec: 0,
  });

  // 保持最新状态供动画循环读取
  useEffect(() => {
    syncOnRef.current = syncOn;
  }, [syncOn]);

  useEffect(() => {
    targetTempRef.current = temperature;
  }, [temperature]);

  useEffect(() => {
    targetPressureRef.current = pressure;
  }, [pressure]);

  useEffect(() => {
    baseTempRef.current = baselineTemperature;
  }, [baselineTemperature]);

  useEffect(() => {
    basePressRef.current = baselinePressure;
  }, [baselinePressure]);

  useEffect(() => {
    speedScaleRef.current = speedScale;
  }, [speedScale]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const cfg = DEFAULT_GAS_CONFIG;
    const model = new GasModel({ referenceTemperatureK: temperature || 293.15 });
    modelRef.current = model;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1424);

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(3.6, 2.4, 5.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 2.5;
    controls.maxDistance = 12;

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0x6fa8ff, 12, 30);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    // 透明玻璃试管：圆柱段 + 圆底半球
    const glassMat = new THREE.MeshPhongMaterial({
      color: 0x8fbdf5,
      transparent: true,
      opacity: 0.16,
      shininess: 95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const tubeWall = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.height, 48, 1, true),
      glassMat
    );
    tubeWall.position.y = cfg.height / 2;
    scene.add(tubeWall);

    const bottom = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.radius, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      glassMat
    );
    scene.add(bottom);

    // 管口沿口
    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.radius + 0.02, 0.035, 12, 48),
      new THREE.MeshPhongMaterial({ color: 0xa9c6ef, transparent: true, opacity: 0.6 })
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = cfg.height;
    scene.add(rimRing);

    // 橡胶密封塞（体积固定、封闭容器的视觉提示）
    const stopper = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.radius * 0.92, cfg.radius * 0.86, 0.5, 48),
      new THREE.MeshPhongMaterial({ color: 0x30343d, shininess: 8 })
    );
    stopper.position.y = cfg.height + 0.22;
    scene.add(stopper);

    const stopperCap = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.radius * 1.08, cfg.radius * 1.08, 0.12, 48),
      new THREE.MeshPhongMaterial({ color: 0x23262d })
    );
    stopperCap.position.y = cfg.height + 0.5;
    scene.add(stopperCap);

    // 底座参照面
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshBasicMaterial({ color: 0x12233d, transparent: true, opacity: 0.85 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -cfg.radius - 0.02;
    scene.add(ground);

    // 分子粒子（InstancedMesh）
    const particleGeo = new THREE.SphereGeometry(cfg.particleRadius, 10, 10);
    const particleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const particles = new THREE.InstancedMesh(particleGeo, particleMat, model.particleCount);
    particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const baseColor = new THREE.Color();
    for (let i = 0; i < model.particleCount; i++) {
      const shade = 0.75 + Math.random() * 0.25;
      baseColor.setRGB(0.62 * shade + 0.2, 0.78 * shade + 0.15, 1.0 * shade);
      particles.setColorAt(i, baseColor);
    }
    scene.add(particles);

    // 器壁碰撞微闪光粒子池（加色小球，按动量冲量分级色彩）
    const flashes: THREE.Mesh[] = [];
    for (let i = 0; i < FLASH_POOL; i++) {
      const flashMat = new THREE.MeshBasicMaterial({
        color: 0x7fd4ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), flashMat);
      f.visible = false;
      scene.add(f);
      flashes.push(f);
    }
    let flashCursor = 0;

    // 尺寸自适应
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w < 10 || h < 10) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // 动画循环
    const clock = new THREE.Clock();
    const dummy = new THREE.Object3D();
    let raf = 0;
    let collisionWindow: { time: number; impulse: number }[] = [];
    let hudTimer = 0;

    // 指数移动平均 (EMA) 滤波器状态，消除离散泊松噪声抖动
    let emaFreqRatio = 1.0;
    let emaImpulseRatio = 1.0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      const isSynced = syncOnRef.current;
      const targetT = isSynced ? targetTempRef.current : cfg.referenceTemperatureK;
      const scaleMultiplier = speedScaleRef.current;

      // 温度平滑过渡（指数趋近，时间常数约 0.6 s）
      const tau = 0.6;
      simTempRef.current += (targetT - simTempRef.current) * (1 - Math.exp(-dt / tau));
      if (Math.abs(simTempRef.current - model.temperatureK) > 0.01) {
        model.setTemperature(simTempRef.current);
      }

      // 同步关闭时减速为"待机"运动 (0.6x)
      model.step(dt * (isSynced ? 1.0 : 0.6) * scaleMultiplier);

      // 碰撞事件 → 能量色彩分级微闪光 + 统计
      const events = model.drainCollisions();
      const now = performance.now();

      for (const ev of events) {
        const f = flashes[flashCursor % FLASH_POOL];
        flashCursor++;
        f.position.set(ev.x, ev.y, ev.z);
        f.visible = true;

        const mat = f.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.95;

        // 冲量能量色彩分级：
        // 低冲量(<1.5) -> 冷冰青蓝
        // 中冲量(1.5-2.8) -> 亮白天青
        // 高冲量(>=2.8) -> 暖金黄/亮橙红 (视觉彰显每次撞击更猛烈)
        if (ev.impulse >= 2.8) {
          mat.color.setHex(0xf59e0b); // 暖金黄色
          f.scale.setScalar(0.7 + Math.min(1.8, ev.impulse * 0.5));
        } else if (ev.impulse >= 1.6) {
          mat.color.setHex(0x67e8f9); // 亮青白
          f.scale.setScalar(0.6 + Math.min(1.4, ev.impulse * 0.4));
        } else {
          mat.color.setHex(0x38bdf8); // 冷浅蓝
          f.scale.setScalar(0.5 + Math.min(1.0, ev.impulse * 0.3));
        }
      }

      for (const f of flashes) {
        if (!f.visible) continue;
        const m = f.material as THREE.MeshBasicMaterial;
        m.opacity *= Math.exp(-dt * 6.5);
        if (m.opacity < 0.03) f.visible = false;
      }

      collisionWindow.push(...events.map((e) => ({ time: now, impulse: e.impulse })));
      collisionWindow = collisionWindow.filter((item) => now - item.time < 2000);

      // 更新粒子矩阵
      for (let i = 0; i < model.particleCount; i++) {
        const o = i * 3;
        dummy.position.set(model.positions[o], model.positions[o + 1], model.positions[o + 2]);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      controls.update();
      renderer.render(scene, camera);

      // HUD 4 Hz 刷新 (含 EMA 平滑与因式分解闭环计算)
      hudTimer += dt;
      if (hudTimer > 0.25) {
        hudTimer = 0;

        const curT = targetTempRef.current;
        const curP = targetPressureRef.current;
        const baseT = Math.max(1, baseTempRef.current);
        const baseP = Math.max(1, basePressRef.current);

        // 理论温度比值
        const tempRatio = Math.max(0.1, curT) / baseT;
        // 宏观实测压强比值
        const macroRatio = Math.max(0.1, curP) / baseP;

        // 理论微观增益因子
        const targetFreq = Math.sqrt(tempRatio);
        const targetImpulse = Math.sqrt(tempRatio);

        // 统计真实碰撞样本
        const totalCollisionsInWindow = collisionWindow.length;
        const ratePerSec = totalCollisionsInWindow / 2;

        // EMA 平滑因子 (既保留物理微弱涨落，又消除 ±15% 的剧烈抖动)
        const alpha = 0.22;
        emaFreqRatio += (targetFreq - emaFreqRatio) * alpha;
        emaImpulseRatio += (targetImpulse - emaImpulseRatio) * alpha;

        const microP = emaFreqRatio * emaImpulseRatio;

        setHud({
          T: isSynced ? curT : null,
          p: isSynced ? curP : null,
          T0: baseT,
          p0: baseP,
          freqFactor: emaFreqRatio,
          impulseFactor: emaImpulseRatio,
          microPressureRatio: microP,
          macroPressureRatio: macroRatio,
          collisionsPerSec: ratePerSec,
        });
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-lg overflow-hidden select-none bg-[#0b1424]">
      {/* 3D 渲染挂载容器 */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 待机状态覆盖蒙版 */}
      {!syncOn && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b1424]/80 backdrop-blur-sm rounded-lg pointer-events-none">
          <div className="text-center text-slate-300">
            <div className="text-base font-semibold text-sky-200">微观模型暂未开启</div>
            <div className="text-xs text-slate-400 mt-1">建立宏观规律后，勾选「同步显示」查看微观解释</div>
          </div>
        </div>
      )}

      {/* 浮动 HUD 面板：因式分解式宏微观闭环对照看板 */}
      <div className="absolute top-2.5 left-2.5 z-20 bg-slate-950/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-700/80 shadow-2xl font-mono text-slate-200 pointer-events-none w-[265px] space-y-1.5">
        {/* 顶部实时读数 */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">T:</span>
            <span className="font-bold text-red-400">{hud.T !== null ? `${hud.T.toFixed(1)} K` : '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">p:</span>
            <span className="font-bold text-emerald-400">{hud.p !== null ? `${hud.p.toFixed(1)} kPa` : '—'}</span>
          </div>
          <div className="text-sky-400 text-[10px]">{volume.toFixed(1)} mL</div>
        </div>

        {/* 核心教学证据链：因式分解式微观成因 */}
        <div className="space-y-1 text-[11px]">
          <div className="text-[10px] text-slate-400 font-sans font-semibold flex items-center justify-between">
            <span>等容升温微观压强成因:</span>
            <span className="text-[9px] text-sky-400/90">基准:{hud.T0.toFixed(0)}K</span>
          </div>

          {/* 1. 撞得更勤 */}
          <div className="flex items-center justify-between bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
            <span className="text-sky-300 font-sans flex items-center gap-1">
              <span>① 撞得更勤</span>
              <span className="text-[9px] text-slate-400 font-mono">(f/f₀)</span>
            </span>
            <span className="font-bold text-sky-400">×{hud.freqFactor.toFixed(3)}</span>
          </div>

          {/* 2. 撞得更猛 */}
          <div className="flex items-center justify-between bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
            <span className="text-amber-300 font-sans flex items-center gap-1">
              <span>② 撞得更猛</span>
              <span className="text-[9px] text-slate-400 font-mono">(Ī/Ī₀)</span>
            </span>
            <span className="font-bold text-amber-400">×{hud.impulseFactor.toFixed(3)}</span>
          </div>

          {/* 3. 微观合成压强 */}
          <div className="flex items-center justify-between bg-blue-950/70 px-2 py-0.5 rounded border border-blue-800/60">
            <span className="text-blue-300 font-sans flex items-center gap-1">
              <span>③ 微观合成</span>
              <span className="text-[9px] text-blue-400 font-mono">(①×②)</span>
            </span>
            <span className="font-bold text-blue-300">={hud.microPressureRatio.toFixed(3)}</span>
          </div>

          {/* 4. 宏观实测压强 */}
          <div className="flex items-center justify-between bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/60">
            <span className="text-emerald-300 font-sans flex items-center gap-1">
              <span>④ 宏观实测</span>
              <span className="text-[9px] text-emerald-400 font-mono">(p/p₀)</span>
            </span>
            <span className="font-bold text-emerald-400">={hud.macroPressureRatio.toFixed(3)}</span>
          </div>
        </div>

        {/* 底部碰撞率与冲量特征 */}
        <div className="pt-0.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
          <span>器壁碰撞: ~{hud.collisionsPerSec.toFixed(0)} 次/秒</span>
          <span className="text-amber-400/90">金光: 高冲量</span>
        </div>
      </div>

      {/* 同步开关浮动按钮 (右上角) */}
      <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2">
        {onToggleSync && (
          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900/85 backdrop-blur border border-slate-700 text-xs text-sky-300 cursor-pointer hover:bg-slate-800 transition-colors shadow">
            <input
              type="checkbox"
              checked={syncOn}
              onChange={onToggleSync}
              className="rounded border-slate-600 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>同步显示</span>
          </label>
        )}
      </div>

      {/* 底部微观动理论教学说明 */}
      <div className="absolute bottom-2 left-2.5 right-2.5 z-20 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded border border-slate-800/80 text-[11px] text-slate-400 pointer-events-none text-center">
        因式分解证明：p ∝ (碰撞频率 f) × (平均冲量 Ī) ∝ √T × √T = T，与宏观规律严密闭环
      </div>
    </div>
  );
};
