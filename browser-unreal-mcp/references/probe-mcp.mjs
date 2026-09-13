// Minimal MCP stdio probe: initialize -> tools/list -> (optional) tool call
// Usage:
//   node probe-mcp.mjs -- <command> [args...]                 # list tools
//   node probe-mcp.mjs --call toolName '{"json":"args"}' -- <command> [args...]
// Examples:
//   node probe-mcp.mjs -- npx -y @playwright/mcp@latest --headless --browser chromium
//   node probe-mcp.mjs --call browser_navigate '{"url":"https://example.com"}' -- npx -y @playwright/mcp@latest --headless --browser chromium
//   node probe-mcp.mjs -- npx -y chrome-devtools-mcp@latest
// Note: stdio servers only. UE's unreal-mcp is HTTP (not probeable with this script).
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
let callName = null, callArgs = null;
const sep = argv.indexOf('--');
let srv = argv;
if (sep >= 0) {
  const pre = argv.slice(0, sep);
  srv = argv.slice(sep + 1);
  const cIdx = pre.indexOf('--call');
  if (cIdx >= 0) {
    callName = pre[cIdx + 1];
    callArgs = pre[cIdx + 2] ? JSON.parse(pre[cIdx + 2]) : {};
  }
}

const proc = spawn(srv[0], srv.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
let buf = '';
const send = (obj) => proc.stdin.write(JSON.stringify(obj) + '\n');
const done = (code) => { try { proc.kill(); } catch {} process.exit(code); };

proc.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
    if (!line.trim()) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id === 1) {
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    }
    if (msg.id === 2) {
      const tools = (msg.result && msg.result.tools) || [];
      if (callName) {
        const t = tools.find(x => x.name === callName);
        if (!t) { console.log('TOOL_NOT_FOUND:' + callName); done(1); return; }
        console.log('CALLING:' + callName);
        send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: callName, arguments: callArgs } });
      } else {
        for (const t of tools) console.log(t.name + ' :: ' + String(t.description || '').split('\n')[0].slice(0, 140));
        console.log('TOTAL:' + tools.length);
        done(0); return;
      }
    }
    if (msg.id === 3) {
      const r = msg.result;
      const text = (r && r.content || []).map(c => c.text || '').join('\n').slice(0, 800);
      console.log('CALL_RESULT isError=' + (r && r.isError) + '\n' + text);
      done(0); return;
    }
  }
});
proc.stderr.on('data', (d) => process.stderr.write(d));
proc.on('exit', (c) => { console.error('SERVER_EXIT:' + c); process.exit(1); });
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'probe', version: '0.0.0' } } });
setTimeout(() => { console.error('PROBE_TIMEOUT'); done(1); }, 110000);
