#!/usr/bin/env node
// E2E usability test for playwright-mcp, using the SAME launch config as the DSH patch.
// Usage: node mcp-e2e-test.mjs [binary] [extra server args...]
//   default: playwright-mcp --headless --browser chromium
// Steps 1-8 are the core loop (must all pass); step 9 is real-internet (advisory).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const bin = process.argv[2] || 'playwright-mcp';
const srvArgs = process.argv.slice(3).length ? process.argv.slice(3) : ['--headless', '--browser', 'chromium'];

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>E2E MCP Test</title></head><body>
<h1>DSH MCP Test Page</h1>
<form id="f">
  <input id="name" placeholder="name" value="">
  <select id="lang"><option value="CN">中文</option><option value="EN">English</option></select>
  <button type="submit" id="go">提交</button>
</form>
<div id="out">EMPTY</div>
<script>
document.getElementById('f').addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('out').textContent =
    'HELLO ' + document.getElementById('name').value + ' / ' + document.getElementById('lang').value;
});
console.log('e2e-page-loaded');
</script></body></html>`;

const httpSrv = createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(PAGE); });
const port = await new Promise((r) => httpSrv.listen(0, '127.0.0.1', () => r(httpSrv.address().port)));

const results = [];
const step = async (name, fn) => {
  try { const d = await fn(); results.push([name, 'PASS', d || '']); }
  catch (e) { results.push([name, 'FAIL', String(e.message || e).replace(/\s+/g, ' ').slice(0, 200)]); }
};
const wt = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timeout ' + ms + 'ms')), ms))]);

const server = spawn(bin, srvArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
let buf = ''; const pending = new Map(); let msgId = 0;
server.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  }
});
server.stderr.on('data', () => {});
const rawSend = (obj) => server.stdin.write(JSON.stringify(obj) + '\n');
const request = (method, params) => new Promise((res, rej) => {
  const id = ++msgId;
  pending.set(id, (m) => (m.error ? rej(new Error(method + ' ' + JSON.stringify(m.error).slice(0, 160))) : res(m.result)));
  rawSend({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
});
const call = async (name, args) => {
  const r = await wt(request('tools/call', { name, arguments: args || {} }), 30000, name);
  return { isError: !!r.isError, text: (r.content || []).map((c) => c.text || '').join('\n') };
};
const expect = (c, msg) => { if (!c) throw new Error(msg); };
// snapshot responses may inline the tree OR reference a file (.playwright-mcp/*.yml) — resolve both
const snapBody = (t) => {
  const m = t.match(/\[Snapshot\]\(([^)]+)\)/);
  if (!m) return t;
  try { return readFileSync(join(process.cwd(), m[1].replace(/^\.\//, '')), 'utf8'); } catch { return t; }
};
// snapshot tree emits [ref=e12] (frame-scoped refs look like f1e6); tool args take it as `target`.
const REF = /\[ref(?:=target)?=([a-z0-9]*e\d+)\]/;
const refOf = (t, ...kinds) => {
  for (const kind of kinds) {
    const line = t.split('\n').find((l) => l.includes('[') && l.toLowerCase().includes(kind));
    if (line) { const m = line.match(REF); if (m) return m[1]; }
  }
  return null;
};

await wt(request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'e2e', version: '0' } }), 20000, 'initialize');
rawSend({ jsonrpc: '2.0', method: 'notifications/initialized' });

await step('1. browser_navigate 打开本地测试页', async () => {
  const r = await call('browser_navigate', { url: `http://127.0.0.1:${port}/` });
  expect(!r.isError, 'navigate failed: ' + r.text.slice(0, 120));
  expect(r.text.includes('E2E MCP Test') || r.text.includes('DSH MCP Test Page'), '标题未返回');
  return '页面打开、标题返回';
});

let snap1 = '';
await step('2. browser_snapshot 可访问性快照（含 ref）', async () => {
  const r = await call('browser_snapshot');
  expect(!r.isError, r.text.slice(0, 120));
  snap1 = snapBody(r.text);
  expect(snap1.includes('[ref='), '快照里没有 ref 引用');
  return 'ref 引用可用';
});

const inputRef = refOf(snap1, 'textbox');
const comboRef = refOf(snap1, 'combobox');
const btnRef = refOf(snap1, 'button');

await step('3. browser_fill_form 填表（textbox+combobox）', async () => {
  expect(inputRef && comboRef, 'textbox/combobox ref 未找到');
  let r = await call('browser_fill_form', { fields: [
    { name: 'name', type: 'textbox', target: inputRef, value: 'dsh' },
    { name: 'lang', type: 'combobox', target: comboRef, value: 'CN' },
  ] });
  if (r.isError) { // 参数形态兜底：退化为单字段工具
    await call('browser_type', { element: 'name', target: inputRef, text: 'dsh' });
    r = await call('browser_select_option', { element: 'lang', target: comboRef, values: ['CN'] });
    expect(!r.isError, 'fallback type/select 失败: ' + r.text.slice(0, 100));
  }
  return `target=${inputRef}/${comboRef}`;
});

await step('4. browser_click 点击提交', async () => {
  expect(btnRef, 'button ref 未找到');
  const r = await call('browser_click', { element: 'submit', target: btnRef });
  expect(!r.isError, r.text.slice(0, 120));
  return 'clicked ' + btnRef;
});

await step('5. 快照验证提交生效（HELLO dsh / CN）', async () => {
  const r = await call('browser_snapshot');
  expect(!r.isError, r.text.slice(0, 120));
  expect(snapBody(r.text).includes('HELLO dsh / CN'), '提交结果未出现在快照');
  return 'DOM 更新被快照捕获';
});

await step('6. browser_evaluate 读 DOM 值', async () => {
  const r = await call('browser_evaluate', { function: "() => document.getElementById('out').textContent" });
  expect(!r.isError, r.text.slice(0, 120));
  expect(r.text.includes('HELLO dsh / CN'), 'evaluate 返回: ' + r.text.slice(0, 100));
  return r.text.trim().slice(0, 40);
});

await step('7. browser_console_messages 读页面日志', async () => {
  const r = await call('browser_console_messages', {});
  expect(!r.isError, r.text.slice(0, 120));
  expect(r.text.includes('e2e-page-loaded'), '页面 console 日志未捕获');
  return 'console 可读';
});

await step('8. browser_take_screenshot 截图', async () => {
  const r = await call('browser_take_screenshot', {});
  expect(!r.isError, r.text.slice(0, 120));
  return (r.text.match(/[\w./-]+\.(png|jpe?g)/) || ['截图已返回'])[0];
});

await step('9. 真实外网：bing 搜索全流程（advisory）', async () => {
  const nav = await call('browser_navigate', { url: 'https://www.bing.com' });
  if (nav.isError) throw new Error('bing 不可达（网络环境）: ' + nav.text.slice(0, 100));
  const s = await call('browser_snapshot');
  if (s.isError) throw new Error('snapshot 失败: ' + s.text.slice(0, 150));
  const body = snapBody(s.text);
  const boxRef = refOf(body, 'textbox', 'searchbox', 'textarea')
    || (body.match(/search[\s\S]{0,120}?\[ref(?:=target)?=([a-z0-9]*e\d+)\]/i) || [])[1];
  if (!boxRef) throw new Error('未找到搜索框 ref，快照头部: ' + body.replace(/\s+/g, ' ').slice(0, 260));
  await call('browser_type', { element: 'search', target: boxRef, text: 'unreal engine mcp', submit: true });
  await call('browser_wait_for', { time: 3 });
  const s2 = await call('browser_snapshot');
  expect(/unreal|results/i.test(snapBody(s2.text)), '结果页未出现');
  return '搜索→结果页 OK';
});

server.kill(); httpSrv.close();
const coreFail = results.slice(0, 8).filter((r) => r[1] === 'FAIL');
for (const [n, s, d] of results) console.log(`${s === 'PASS' ? '✅' : '❌'} ${n}${d ? '  — ' + d.slice(0, 140) : ''}`);
console.log(`\n核心 1-8：通过 ${8 - coreFail.length}/8；外网(9)：${results[8][1] === 'PASS' ? '通过' : '未通过(视网络)'}`);
process.exit(coreFail.length ? 1 : 0);
