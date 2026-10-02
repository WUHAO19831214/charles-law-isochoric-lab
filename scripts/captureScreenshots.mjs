import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9229;
const USER_DATA_DIR = `/tmp/chrome-cdp-profile-${Date.now()}`;
const OUTPUT_DIR = path.resolve('docs/images');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const { resolve, reject } = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) {
              reject(new Error(msg.error.message));
            } else {
              resolve(msg.result);
            }
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    await this.evaluate('window.scrollTo(0, 0)');
    await sleep(300);
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`📸 保存截图: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  console.log('🚀 启动 Headless Chrome 实例 (WebGL Enabled)...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${USER_DATA_DIR}`,
    'http://127.0.0.1:5173/',
  ], { stdio: 'ignore' });

  try {
    let versionData = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch {
        await sleep(200);
      }
    }

    if (!versionData) {
      throw new Error('Chrome CDP 端口未能及时响应');
    }

    await sleep(1500);

    const pagesRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const pages = await pagesRes.json();
    const page = pages.find((p) => p.type === 'page' && p.url.includes('5173')) || pages[0];
    if (!page?.webSocketDebuggerUrl) {
      throw new Error('未找到可用的页面 WebSocket URL');
    }

    console.log('🔗 连接 CDP WebSocket...');
    const client = new CdpClient(page.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1720,
      height: 1060,
      deviceScaleFactor: 2,
      mobile: false,
    });

    console.log('⏳ 等待 React 挂载与页面渲染完成...');
    for (let i = 0; i < 50; i++) {
      const ready = await client.evaluate('Boolean(document.querySelector("header"))');
      if (ready) break;
      await sleep(200);
    }
    await sleep(2000);

    // 1. 全景主工作台截图 (默认传感器屏幕识别与实验台就绪)
    console.log('📷 截图 1: 工作台三列响应式全景...');
    await client.captureScreenshot('01-workbench-overview.png');

    // 2. 切换至“演示模拟模式”并注入四组标准等容升温实验数据
    console.log('⚙️ 切换至演示模拟模式并采集 20℃, 40℃, 60℃, 80℃ 数据点...');
    await client.evaluate(`
      (function() {
        // 点击“演示模拟模式”
        const demoModeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('演示模拟模式'));
        if (demoModeBtn) demoModeBtn.click();
      })()
    `);
    await sleep(500);

    // 逐级设置温度并打点
    await client.evaluate(`
      (async function() {
        const findBtn = (txt) => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === txt);
        const recordBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('单次打点'));

        const temps = ['20℃', '40℃', '60℃', '80℃'];
        for (const t of temps) {
          const tBtn = findBtn(t);
          if (tBtn) tBtn.click();
          await new Promise(r => setTimeout(r, 200));
          if (recordBtn) recordBtn.click();
          await new Promise(r => setTimeout(r, 200));
        }
      })()
    `);
    await sleep(1500);

    // 执行数据点绘制与查理定律线性拟合
    await client.evaluate(`
      (function() {
        const plotBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('绘制数据点'));
        if (plotBtn) plotBtn.click();
        const fitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('线性拟合'));
        if (fitBtn) fitBtn.click();
      })()
    `);
    await sleep(800);

    console.log('📷 截图 2: 查理定律 p-T (K) 线性拟合与外推至原点...');
    await client.captureScreenshot('02-pt-linear-regression.png');

    // 3. 切换至 p-t (℃) 模式并查看绝对零度 -273.15℃ 标定
    console.log('🔄 切换至 p-t (℃) 摄氏温度拟合模式...');
    await client.evaluate(`
      (function() {
        const ptCelsiusBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('p - t 图像 (℃)'));
        if (ptCelsiusBtn) ptCelsiusBtn.click();
        const fitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('线性拟合'));
        if (fitBtn) fitBtn.click();
      })()
    `);
    await sleep(800);

    console.log('📷 截图 3: 摄氏温标 p-t 线性拟合与绝对零度 (-273.15℃) 外推...');
    await client.captureScreenshot('03-celsius-absolute-zero.png');

    // 4. 启动复盘回放系统 (Replay)
    console.log('⏱️ 启动实验过程复盘回放...');
    await client.evaluate(`
      (function() {
        const replayBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('开始复盘回放'));
        if (replayBtn) replayBtn.click();
      })()
    `);
    await sleep(1200);

    console.log('📷 截图 4: 实验时序复盘回放与微观 3D 动力学联动...');
    await client.captureScreenshot('04-replay-and-molecular-dynamics.png');

    // 5. 打开实验原理与教学指南弹窗
    console.log('📖 打开实验教学指南与物理原理说明...');
    await client.evaluate(`
      (function() {
        const helpBtn = document.querySelector("button[title='实验原理与说明']");
        if (helpBtn) helpBtn.click();
      })()
    `);
    await sleep(800);

    console.log('📷 截图 5: 实验原理与教学指南弹窗...');
    await client.captureScreenshot('05-experiment-guide-modal.png');

    client.close();
    console.log('🎉 5 张精选高清教学截图采集完成！');
  } finally {
    chromeProcess.kill('SIGTERM');
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('执行失败:', err);
  process.exit(1);
});
