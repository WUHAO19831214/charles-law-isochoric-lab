import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MolecularSystem, DEFAULT_TUBE_CONFIG, MolecularSimulationMetrics } from './molecularSystem';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface TubeSceneProps {
  temperature: number; // 驱动温度 (K)
  onMetricsUpdate?: (metrics: MolecularSimulationMetrics) => void;
  speedScale?: number; // 演示倍速
}

export const TubeScene: React.FC<TubeSceneProps> = ({
  temperature,
  onMetricsUpdate,
  speedScale = 1.0,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const systemRef = useRef<MolecularSystem | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. 初始化分子动力学引擎
    const particleCount = 260;
    const system = new MolecularSystem(particleCount, temperature, DEFAULT_TUBE_CONFIG);
    systemRef.current = system;

    // 2. Three.js 场景与渲染器
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.5, 6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 3. 轨道控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 10;
    controls.target.set(0, 0, 0);

    // 4. 灯光系统
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x93c5fd, 1.8);
    dirLight1.position.set(5, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight2.position.set(-5, -3, -5);
    scene.add(dirLight2);

    const tubePointLight = new THREE.PointLight(0x60a5fa, 1.5, 8);
    tubePointLight.position.set(0, 0, 0);
    scene.add(tubePointLight);

    // 5. 试管容器建模 (高质感半透明玻璃圆柱)
    const tubeRadius = DEFAULT_TUBE_CONFIG.radius;
    const tubeHeight = DEFAULT_TUBE_CONFIG.height;

    // 玻璃外管
    const glassGeo = new THREE.CylinderGeometry(
      tubeRadius,
      tubeRadius,
      tubeHeight,
      48,
      1,
      true
    );
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.9,
      ior: 1.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const glassTube = new THREE.Mesh(glassGeo, glassMat);
    scene.add(glassTube);

    // 玻璃底座 (半球形或圆底闭合)
    const bottomGeo = new THREE.SphereGeometry(
      tubeRadius,
      36,
      18,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2
    );
    const bottomMesh = new THREE.Mesh(bottomGeo, glassMat);
    bottomMesh.position.y = -tubeHeight / 2;
    scene.add(bottomMesh);

    // 顶部橡胶密封塞 (黑色/深灰，固定体积)
    const stopperGeo = new THREE.CylinderGeometry(
      tubeRadius * 1.05,
      tubeRadius * 0.95,
      0.55,
      32
    );
    const stopperMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.8,
      metalness: 0.2,
    });
    const stopper = new THREE.Mesh(stopperGeo, stopperMat);
    stopper.position.y = tubeHeight / 2 + 0.2;
    scene.add(stopper);

    // 试管壁刻度线装饰 (体现精确容积 50.0 mL)
    const markGroup = new THREE.Group();
    const markMaterial = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
    for (let i = -3; i <= 3; i++) {
      const ringGeo = new THREE.BufferGeometry();
      const points: THREE.Vector3[] = [];
      const segs = 32;
      for (let s = 0; s <= segs; s++) {
        const rad = (s / segs) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(rad) * (tubeRadius + 0.01), i * 0.4, Math.sin(rad) * (tubeRadius + 0.01)));
      }
      ringGeo.setFromPoints(points);
      const ringLine = new THREE.Line(ringGeo, markMaterial);
      markGroup.add(ringLine);
    }
    scene.add(markGroup);

    // 固定支架金属环 (突出等容无活塞位移)
    const clampGeo = new THREE.TorusGeometry(tubeRadius + 0.08, 0.06, 16, 40);
    const clampMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
    const clampMesh = new THREE.Mesh(clampGeo, clampMat);
    clampMesh.rotation.x = Math.PI / 2;
    clampMesh.position.y = 0.8;
    scene.add(clampMesh);

    // 6. 分子硬球渲染 (使用 InstancedMesh 保证 60fps)
    const ballRadius = DEFAULT_TUBE_CONFIG.particleRadius;
    const sphereGeo = new THREE.SphereGeometry(ballRadius, 14, 14);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.1,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.4,
    });
    const instancedMolecules = new THREE.InstancedMesh(sphereGeo, sphereMat, particleCount);
    scene.add(instancedMolecules);

    // 7. 动画主循环
    const dummy = new THREE.Object3D();
    const colorObj = new THREE.Color();
    let lastTime = performance.now();

    const animate = (now: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;

      // 步进分子动力学系统
      system.step(dt * speedScale);

      // 同步位置与动能热力学色彩
      const vRms = system.metrics.vRmsTheoretical || 2.5;

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        dummy.position.set(
          system.positions[idx],
          system.positions[idx + 1],
          system.positions[idx + 2]
        );
        dummy.updateMatrix();
        instancedMolecules.setMatrixAt(i, dummy.matrix);

        // 依据粒子速率着色：冷蓝(慢) -> 冰白(均值) -> 烈橙红(高能)
        const speedRatio = (system.speeds[i] || 0) / vRms;
        if (speedRatio < 0.7) {
          colorObj.setHSL(0.58, 0.9, 0.55); // 蓝
        } else if (speedRatio < 1.3) {
          colorObj.setHSL(0.52, 0.7, 0.75); // 浅青白
        } else {
          colorObj.setHSL(0.08, 0.95, 0.6); // 暖橙红
        }
        instancedMolecules.setColorAt(i, colorObj);
      }

      instancedMolecules.instanceMatrix.needsUpdate = true;
      if (instancedMolecules.instanceColor) {
        instancedMolecules.instanceColor.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);

      if (onMetricsUpdate) {
        onMetricsUpdate(system.metrics);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // 8. 窗口尺寸自适应监听
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 当外部温度更新时平滑传递给底层动力学系统
  useEffect(() => {
    if (systemRef.current) {
      systemRef.current.setTemperature(temperature);
    }
  }, [temperature]);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-lg overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute top-2 left-2 text-xs bg-slate-900/80 backdrop-blur px-2 py-1 rounded border border-slate-700/60 text-slate-300 pointer-events-none">
        按住鼠标左键旋转 · 滚轮缩放视角
      </div>
    </div>
  );
};
