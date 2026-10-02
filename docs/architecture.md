# 系统架构与物理计算深度指南 (Architecture & Physics Guide)

本文档面向对本项目底层实现、计算机视觉算法、3D 分子动力学以及物理建模感兴趣的开发者与物理教研工作者，详细阐述系统的技术实现机制。

---

## 1. 系统总体架构与分层设计

工作台采用自顶向下的单向数据流与响应式组件架构：

```text
+--------------------------------------------------------------------------+
|                                App (状态中枢)                             |
|  - currentPressure, currentTemp (实时感知值)                               |
|  - records (实验数据序列: t, p, T, V)                                      |
|  - isReplaying, replayIndex (复盘时间线)                                  |
|  - fitResults (最小二乘法拟合参数: k, p0, R^2)                             |
+--------------------------------------------------------------------------+
       |                               |                              |
       v                               v                              v
+---------------+             +----------------+             +-----------------+
|  左侧数据感知与  |             |  中间实景多镜头  |             |  右侧微观 3D    |
|   图表分析系统   |             |   流媒体中心   |             | 分子动力学仿真   |
|               |             |                |             |                 |
| - 屏幕共享/ROI |             | - WebRTC 枚举  |             | - 麦克斯韦抽样   |
| - Tesseract   |             | - 镜像反转     |             | - 试管弹性碰撞  |
| - 数据表/导出  |             | - 全屏投影     |             | - 冲量微观压强   |
| - Chart.js拟合 |             |                |             | - 复盘时间轴联动 |
+---------------+             +----------------+             +-----------------+
```

---

## 2. 屏幕感知与 OCR 视觉提取流管 (Vision & OCR Pipeline)

在真实中学物理实验室中，教师通常使用电脑连接数据采集器（如朗威、远大或自制 DISLab 软件）。为了无侵入式地捕获数据，系统实现了基于客户端的高精度视觉提取流水线：

```text
[操作系统窗口 / 传感器软件]
       | (navigator.mediaDevices.getDisplayMedia)
       v
[HTMLVideoElement (内部离屏视频源)]
       | (用户在界面上按鼠标拖拽生成 ROI 矩形: x, y, width, height)
       v
[实时裁切离屏 Canvas]
       | (等比缩放 / 灰度强化 / 边缘保真)
       v
[Tesseract OCR 核心工作线程 Worker]
       | (提取原始带噪文本，例如: "压强: 103.2 kPa S188: 293.8 K")
       v
[双参单位绑定正则清洗算法 (Double-Parameter RegEx)]
       |
       +---> 压强提取: 匹配以 kPa 为后缀或 "压强" 标记的实数，且 p > 20 kPa (过滤微小噪点)
       +---> 温度提取: 优先匹配以 K 为后缀的数字 (如 293.8 K)；若为 ℃ 则自动换算 T = t + 273.15
       v
[更新 App 顶层响应式状态]
```

### 关键防噪设计：
某些传感器界面的中文符号（如“温度:”、“℃”）会被 OCR 误读为乱码数字（如 `S188:` 或 `45188:`）。系统特别设计了**单位强绑定过滤器**：只要数字后面紧随 `K` 或 `kPa`，即具有最高解析权重，彻底消除了中文标签引发的数值漂移。

---

## 3. 麦克斯韦-玻尔兹曼速率分布与 3D 分子动力学 (Molecular Kinetics)

### 3.1 速率分布理论推导
在温度为 $T$ 的热力学平衡态下，单原子分子速率的概率密度函数由麦克斯韦-玻尔兹曼分布给出：
$$f(v) = 4\pi \left(\frac{m}{2\pi k_B T}\right)^{3/2} v^2 \exp\left(-\frac{m v^2}{2 k_B T}\right)$$

其特征统计量满足：
* 最概然速率：$v_p = \sqrt{\frac{2 k_B T}{m}}$
* 平均速率：$\bar{v} = \sqrt{\frac{8 k_B T}{\pi m}} \approx 1.128 v_p$
* 方均根速率：$v_{\text{rms}} = \sqrt{\frac{3 k_B T}{m}} \approx 1.225 v_p$

### 3.2 三维速度向量的 Box-Muller 正态采样
每个速度分量 $v_x, v_y, v_z$ 服从独立的一维正态分布：
$$v_i \sim \mathcal{N}\left(0, \frac{k_B T}{m}\right), \quad i \in \{x, y, z\}$$

算法利用两组独立均匀分布伪随机数 $U_1, U_2 \in (0, 1)$，通过 Box-Muller 变换生成标准正态随机变量：
$$Z_0 = \sqrt{-2\ln U_1}\cos(2\pi U_2), \qquad Z_1 = \sqrt{-2\ln U_1}\sin(2\pi U_2)$$
随后将其乘以尺度因子 $\sigma = \sqrt{\frac{k_B T}{m}}$ 赋予各分量。当温度由 $T_1$ 变更为 $T_2$ 时，速度向量满足平滑动能连续缩放：
$$\vec{v}_{\text{new}} = \vec{v}_{\text{old}} \cdot \sqrt{\frac{T_2}{T_1}}$$

### 3.3 密闭圆柱试管完全弹性碰撞几何解算
设圆柱试管内径为 $R$，有效高度为 $H$，分子球体半径为 $r$。
1. **圆柱曲面碰撞判定与反弹**：
   在 $xz$ 水平截面上，分子到中心轴线的径向距离为 $d = \sqrt{x^2 + z^2}$。
   当 $d \ge R - r$ 时，表面法向量为 $\vec{n} = \left(\frac{x}{d}, 0, \frac{z}{d}\right)$。
   反射速度由向量反射定理给出：
   $$\vec{v}' = \vec{v} - 2(\vec{v} \cdot \vec{n})\vec{n}$$
   位置修正为：
   $$(x', z') = (R - r) \cdot \left(\frac{x}{d}, \frac{z}{d}\right)$$
2. **上下两端平底碰撞**：
   当 $|y| \ge H/2 - r$ 时，法向平行于 $y$ 轴：
   $$v_y' = -v_y, \qquad y' = \text{sgn}(y) \cdot (H/2 - r)$$

### 3.4 微观压强统计与动量冲量
每次碰撞中分子受到的冲量为 $\Delta \vec{p} = m(\vec{v}' - \vec{v})$。根据牛顿第三定律，分子施加于器壁的正压力冲量标量为：
$$I_{\text{wall}} = 2m |\vec{v} \cdot \vec{n}|$$
在时间窗口 $\Delta t$ 内累计所有碰撞冲量 $\sum I_i$，容器总内表面积为 $A = 2\pi R H + 2\pi R^2$。微观统计压强为：
$$p_{\text{micro}} = \frac{\sum I_i}{A \cdot \Delta t}$$
该统计值在界面上实时显示，让学生亲眼见证：**温度升高 $\to$ 分子速度变快 $\to$ 冲量增加、单位时间碰撞次数增多 $\to$ 宏观压强升高**。

---

## 4. 最小二乘法与绝对零度外推数学模型 (Mathematical Fitting)

### 4.1 热力学温标下的查理定律拟合 ($p = kT$)
理论物理模型指出理想气体严格过原点 $(0, 0)$。拟合目标为最小化误差平方和：
$$S(k) = \sum_{i=1}^N (p_i - k T_i)^2$$
求导 $\frac{dS}{dk} = 0$，解得最佳斜率：
$$k = \frac{\sum_{i=1}^N T_i p_i}{\sum_{i=1}^N T_i^2}$$
判定系数 $R^2$ 定义为：
$$R^2 = 1 - \frac{\sum (p_i - k T_i)^2}{\sum (p_i - \bar{p})^2}$$

### 4.2 摄氏温标下的线性拟合与绝对零度解算 ($p = kt + p_0$)
在摄氏度模式下，不强制过原点，采用双参数无偏最小二乘回归：
$$k = \frac{N \sum t_i p_i - \sum t_i \sum p_i}{N \sum t_i^2 - (\sum t_i)^2}, \qquad p_0 = \bar{p} - k \bar{t}$$
令 $p = 0$，求得压强外推至零时的理论摄氏温度：
$$t_0 = -\frac{p_0}{k}$$
在标准大气实验下，$t_0$ 理论收敛至 $-273.15^\circ\text{C}$。系统在图表上以红蓝虚线绘制自实测温区（如 $20^\circ\text{C} \sim 80^\circ\text{C}$）延伸至 $-273.15^\circ\text{C}$ 的几何外推线，为热力学温标建立提供了无可辩驳的可视化佐证。

---

## 5. 坐标系自适应缩放与美学步长算法 (Tick Quantization)

为了防止缩放或平移时坐标轴刻度杂乱无章，系统实现了美学对齐的“1-2-5”整步长量化算法：

```typescript
function calculateNiceTickStep(range: number, targetTickCount: number): number {
  const rawStep = range / targetTickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalizedStep = rawStep / magnitude;

  let niceStep: number;
  if (normalizedStep < 1.5) {
    niceStep = 1;
  } else if (normalizedStep < 3.5) {
    niceStep = 2;
  } else if (normalizedStep < 7.5) {
    niceStep = 5;
  } else {
    niceStep = 10;
  }
  return niceStep * magnitude;
}
```
该算法保证了无论用户如何缩放平移图表，坐标轴上的刻度数值始终为整洁的数字（如 10、20、50、100），极大优化了投影教学场景下的观感体验。
