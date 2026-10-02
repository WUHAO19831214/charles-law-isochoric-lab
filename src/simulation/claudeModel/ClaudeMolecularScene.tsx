import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GasModel, DEFAULT_GAS_CONFIG } from './gasModel';
import { vrms } from './maxwellBoltzmann';

const FLASH_POOL = 24;

interface Hud {
  T: number | null;
  p: number | null;
  vrmsRatio: number;
  collisionsPerSec: number;
}

interface ClaudeMolecularSceneProps {
  temperature: number; // 驱动温度 (K)
  pressure?: number;   // 驱动压强 (kPa)
  volume?: number;     // 容器容积 (mL)
  speedScale?: number; // 回放倍速
  syncOn?: boolean;    // 是否同步显示
  onToggleSync?: () => void;
}

export const ClaudeMolecularScene: React.FC<ClaudeMolecularSceneProps> = ({
  temperature,
  pressure = 101.3,
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
  const speedScaleRef = useRef<number>(speedScale);

  const [hud, setHud] = useState<Hud>({
    T: temperature,
    p: pressure,
    vrmsRatio: 1,
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

    // 器壁碰撞微闪光（加色小球，命中后迅速衰减）
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0x7fd4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flashes: THREE.Mesh[] = [];
    for (let i = 0; i < FLASH_POOL; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), flashMat.clone());
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
    let collisionWindow: number[] = [];
    let hudTimer = 0;
    const t0Vrms = vrms(cfg.referenceTemperatureK);

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

      // 碰撞事件 → 微闪光 + 频率统计
      const events = model.drainCollisions();
      const now = performance.now();
      for (const ev of events) {
        const f = flashes[flashCursor % FLASH_POOL];
        flashCursor++;
        f.position.set(ev.x, ev.y, ev.z);
        f.visible = true;
        (f.material as THREE.MeshBasicMaterial).opacity = 0.9;
        f.scale.setScalar(0.6 + Math.min(1.4, ev.impulse * 0.4));
      }
      for (const f of flashes) {
        if (!f.visible) continue;
        const m = f.material as THREE.MeshBasicMaterial;
        m.opacity *= Math.exp(-dt * 6);
        if (m.opacity < 0.03) f.visible = false;
      }
      collisionWindow.push(...events.map(() => now));
      collisionWindow = collisionWindow.filter((t) => now - t < 2000);

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

      // HUD 4 Hz 刷新
      hudTimer += dt;
      if (hudTimer > 0.25) {
        hudTimer = 0;
        setHud({
          T: isSynced ? targetTempRef.current : null,
          p: isSynced ? targetPressureRef.current : null,
          vrmsRatio: vrms(simTempRef.current) / t0Vrms,
          collisionsPerSec: collisionWindow.length / 2,
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

      {/* 浮动 HUD 面板 */}
      <div className="absolute top-2.5 left-2.5 z-20 bg-slate-950/85 backdrop-blur-md p-2.5 rounded-lg border border-slate-700/80 text-xs space-y-1 shadow-xl font-mono text-slate-200 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">T:</span>
          <span className="font-bold text-red-400">{hud.T !== null ? `${hud.T.toFixed(1)} K` : '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">p:</span>
          <span className="font-bold text-emerald-400">{hud.p !== null ? `${hud.p.toFixed(1)} kPa` : '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">V:</span>
          <span className="font-bold text-sky-400">{volume.toFixed(1)} mL（恒定）</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-400">v<sub>rms</sub>/v<sub>rms,0</sub>:</span>
          <span className="font-bold text-amber-400">√(T/T₀) ≈ {hud.vrmsRatio.toFixed(3)}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-400">器壁碰撞:</span>
          <span className="font-bold text-blue-300">≈ {hud.collisionsPerSec.toFixed(0)} 次/秒</span>
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
        示意模拟：分子数与速率均按比例缩放，仅反映统计规律（v ∝ √T，Maxwell–Boltzmann 分布）
      </div>
    </div>
  );
};
