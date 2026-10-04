"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals;
const config = require("./settings.json");
const express = require("express");
const http = require("http");
const https = require("https");

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos/Replit alive
// ============================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;

// Bot state tracking
let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  sequenceStatus: "idle", // 'idle' | 'running' | 'completed' | 'failed'
  sequenceStep: 0,
  totalSteps: (config["join-sequence"] && config["join-sequence"].steps) ? config["join-sequence"].steps.length : 0,
  errors: [],
  wasThrottled: false,
};

// ============================================================
// JOIN SEQUENCE RUNNER
// Executes: /login lifesteal -> wait 5s -> /server lifesteal -> wait 5s -> /warp afk
// Runs every time on spawn (both first connect and every reconnect)
// ============================================================
let joinSequenceTimers = [];

function clearJoinSequence() {
  if (joinSequenceTimers.length > 0) {
    addLog(`[JoinSequence] Clearing ${joinSequenceTimers.length} pending step timer(s)`);
    joinSequenceTimers.forEach((timerId) => clearTimeout(timerId));
    joinSequenceTimers = [];
  }
}

function runPostSpawnSequence(currentBot, mcData, defaultMove) {
  clearJoinSequence();
  botState.sequenceStatus = "running";
  botState.sequenceStep = 1;
  botState.totalSteps = 3;

  addLog(`[JoinSequence] === Executing Post-Spawn Realm Transfer & Warp ===`);

  // Step 2: /server lifesteal after 4s
  const step2Timer = setTimeout(() => {
    if (!currentBot || !botState.connected) return;
    botState.sequenceStep = 2;
    addLog(`[JoinSequence] [Step 2/3] Executing: "/server lifesteal" (Switch to Lifesteal Realm)`);
    try {
      currentBot.chat("/server lifesteal");
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog(`[JoinSequence] Error in step 2: ${e.message}`);
    }

    // Step 3: /warp afk after 5s
    const step3Timer = setTimeout(() => {
      if (!currentBot || !botState.connected) return;
      botState.sequenceStep = 3;
      addLog(`[JoinSequence] [Step 3/3] Executing: "/warp afk" (Warp to AFK Zone)`);
      try {
        currentBot.chat("/warp afk");
        botState.lastActivity = Date.now();
      } catch (e) {
        addLog(`[JoinSequence] Error in step 3: ${e.message}`);
      }

      // Initialize AFK modules after teleport completes
      const afkInitTimer = setTimeout(() => {
        if (!currentBot || !botState.connected) return;
        botState.sequenceStatus = "completed";
        addLog(`[JoinSequence] [+] Sequence fully completed! Bot arrived at AFK target.`);
        initializeModules(currentBot, mcData, defaultMove);
      }, 5500);
      joinSequenceTimers.push(afkInitTimer);
    }, 5000);
    joinSequenceTimers.push(step3Timer);
  }, 4000);
  joinSequenceTimers.push(step2Timer);
}

function runJoinSequence(currentBot, mcData, defaultMove) {
  clearJoinSequence();

  const seqConfig = config["join-sequence"];
  if (!seqConfig || !seqConfig.enabled || !Array.isArray(seqConfig.steps) || seqConfig.steps.length === 0) {
    addLog("[JoinSequence] No sequence configured - directly initializing AFK modules");
    botState.sequenceStatus = "completed";
    initializeModules(currentBot, mcData, defaultMove);
    return;
  }

  const steps = seqConfig.steps;
  botState.sequenceStatus = "running";
  botState.sequenceStep = 0;
  botState.totalSteps = steps.length;

  addLog(`[JoinSequence] === Starting ${steps.length}-Step Join Sequence ===`);

  let accumulatedDelay = 0;

  steps.forEach((step, index) => {
    const stepNumber = index + 1;
    const delay = step.delayMs || (index === 0 ? 1500 : 5000);
    accumulatedDelay += delay;

    const timerId = setTimeout(() => {
      if (!currentBot || !botState.connected) {
        addLog(`[JoinSequence] Aborted step ${stepNumber}/${steps.length} (${step.command}) - bot is not connected`);
        botState.sequenceStatus = "failed";
        return;
      }

      try {
        botState.sequenceStep = stepNumber;
        addLog(`[JoinSequence] [Step ${stepNumber}/${steps.length}] Executing: "${step.command}" (${step.name || "Action"})`);
        
        currentBot.chat(step.command);
        botState.lastActivity = Date.now();

        if (index === steps.length - 1) {
          botState.sequenceStatus = "completed";
          addLog(`[JoinSequence] [+] Sequence fully completed! Bot arrived at AFK target.`);
          
          const postInitTimer = setTimeout(() => {
            if (currentBot && botState.connected) {
              initializeModules(currentBot, mcData, defaultMove);
            }
          }, 2000);
          joinSequenceTimers.push(postInitTimer);
        }
      } catch (err) {
        addLog(`[JoinSequence] [!] Error executing step ${stepNumber} (${step.command}): ${err.message}`);
      }
    }, accumulatedDelay);

    joinSequenceTimers.push(timerId);
  });
}

// Health check endpoint for monitoring
app.get('/', (req, res) => {
  const stepsHtml = (config["join-sequence"] && config["join-sequence"].steps)
    ? config["join-sequence"].steps.map((s, i) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #21262d;font-size:13px;">
          <span style="color:#58a6ff;font-family:monospace;">${i+1}. ${s.command}</span>
          <span style="color:#8b949e;">+${(s.delayMs||5000)/1000}s</span>
        </div>
      `).join('')
    : '<p style="color:#8b949e;">None</p>';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} Dashboard</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 24px;
          }
          main { width: 100%; max-width: 440px; }
          header { margin-bottom: 24px; }
          header h1 { font-size: 24px; font-weight: 700; color: #f0f6fc; margin: 0; }
          header p { font-size: 13px; color: #8b949e; margin: 4px 0 0; }

          .status-section {
            border-radius: 12px;
            padding: 18px 20px;
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: all 0.3s ease;
          }
          .status-section.online  { background: #0d2218; border: 2px solid #238636; }
          .status-section.offline { background: #200d0d; border: 2px solid #da3633; }

          .status-icon {
            width: 42px; height: 42px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; flex-shrink: 0;
          }
          .status-icon.online  { background: #238636; color:#fff; }
          .status-icon.offline { background: #da3633; color:#fff; }

          .status-label { font-size: 17px; font-weight: 700; }
          .status-label.online  { color: #3fb950; }
          .status-label.offline { color: #f85149; }
          .status-detail { font-size: 12.5px; color: #8b949e; margin-top: 2px; }

          .stat-card {
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 10px;
            padding: 14px 18px;
            margin-bottom: 10px;
          }
          .stat-title { font-size: 11.5px; color: #8b949e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          .stat-val { font-size: 16px; font-weight: 600; color: #e6edf3; margin-top: 2px; }
          .stat-sub { font-size: 11px; color: #6e7681; margin-top: 3px; }

          .controls { margin-top: 14px; }
          .btn-grid { display: grid; gap: 10px; margin-bottom: 10px; }
          .btn-grid-2 { grid-template-columns: 1fr 1fr; }

          .btn-primary {
            min-height: 48px; border-radius: 10px;
            font-size: 14px; font-weight: 700;
            cursor: pointer;
            transition: filter 0.2s;
            font-family: inherit;
          }
          .btn-primary:hover  { filter: brightness(1.15); }
          .btn-start { border: 2px solid #238636; background: #0d2218; color: #3fb950; }
          .btn-stop  { border: 2px solid #da3633; background: #200d0d; color: #f85149; }

          .btn-secondary {
            min-height: 42px; border-radius: 10px;
            border: 1px solid #21262d; background: #161b22; color: #8b949e;
            font-size: 13px; font-weight: 500;
            text-decoration: none;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            transition: background 0.2s, color 0.2s;
          }
          .btn-secondary:hover { background: #21262d; color: #c9d1d9; }

          .badge-seq {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            background: #1f2937;
            color: #93c5fd;
          }
          footer { margin-top: 20px; text-align: center; }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main>
          <header>
            <h1>${config.name} Dashboard</h1>
            <p>${config.server.ip}:${config.server.port} &middot; Auto-Sequence Active</p>
          </header>

          <section id="status-section" class="status-section offline">
            <div id="status-icon" class="status-icon offline">&#x2717;</div>
            <div>
              <div id="status-label" class="status-label offline">Connecting…</div>
              <div id="status-detail" class="status-detail">Establishing connection</div>
            </div>
          </section>

          <div class="stat-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="stat-title">Join Command Sequence</span>
              <span id="seq-badge" class="badge-seq">Idle</span>
            </div>
            <div style="margin-top:8px;">
              ${stepsHtml}
            </div>
            <p class="stat-sub">Executed upon every initial join and reconnect</p>
          </div>

          <div class="stat-card">
            <span class="stat-title">Uptime & Status</span>
            <div id="uptime-text" class="stat-val">—</div>
            <p class="stat-sub">Current in-game position: <span id="coords-text" style="color:#58a6ff;">Searching…</span></p>
          </div>

          <section class="controls">
            <div class="btn-grid btn-grid-2">
              <button class="btn-primary btn-start" onclick="startBot()">Start bot</button>
              <button class="btn-primary btn-stop" onclick="stopBot()">Stop bot</button>
            </div>
            <div class="btn-grid btn-grid-2">
              <a href="/logs" class="btn-secondary">View Live Logs</a>
              <button class="btn-secondary" onclick="triggerSequence()">Re-run Sequence</button>
            </div>
          </section>

          <footer>
            <p>AFK Bot &middot; Polling every 4 seconds</p>
          </footer>
        </main>

        <script>
          function formatUptime(s) {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
            if (m > 0) return m + 'm ' + sec + 's';
            return sec + 's';
          }

          async function update() {
            try {
              const r = await fetch('/health');
              const data = await r.json();
              const online = data.status === 'connected';

              const section = document.getElementById('status-section');
              const icon    = document.getElementById('status-icon');
              const label   = document.getElementById('status-label');
              const detail  = document.getElementById('status-detail');
              const badge   = document.getElementById('seq-badge');

              section.className = 'status-section ' + (online ? 'online' : 'offline');
              icon.className    = 'status-icon '    + (online ? 'online' : 'offline');
              icon.innerHTML    = online ? '&#10003;' : '&#10007;';
              label.className   = 'status-label '   + (online ? 'online' : 'offline');
              label.textContent = online ? 'Connected' : 'Disconnected';
              
              if (online) {
                if (data.sequenceStatus === 'running') {
                  detail.textContent = 'Running join sequence (Step ' + data.sequenceStep + '/' + data.totalSteps + ')';
                  badge.textContent = 'Step ' + data.sequenceStep + '/' + data.totalSteps;
                  badge.style.color = '#fbbf24';
                } else if (data.sequenceStatus === 'completed') {
                  detail.textContent = 'In AFK Zone - routines active';
                  badge.textContent = 'Completed (AFK)';
                  badge.style.color = '#34d399';
                } else {
                  detail.textContent = 'Active on server';
                  badge.textContent = data.sequenceStatus;
                }
              } else {
                detail.textContent = 'Attempting reconnect (#' + data.reconnectAttempts + ')';
                badge.textContent = 'Waiting';
                badge.style.color = '#9ca3af';
              }

              document.getElementById('uptime-text').textContent = formatUptime(data.uptime);

              if (data.coords) {
                const x = Math.floor(data.coords.x);
                const y = Math.floor(data.coords.y);
                const z = Math.floor(data.coords.z);
                document.getElementById('coords-text').textContent = 'X: ' + x + ', Y: ' + y + ', Z: ' + z;
              } else {
                document.getElementById('coords-text').textContent = 'Searching…';
              }
            } catch (e) {
              const label = document.getElementById('status-label');
              label.className = 'status-label offline';
              label.textContent = 'Unreachable';
            }
          }

          async function startBot() {
            const r = await fetch('/start', { method: 'POST' });
            const data = await r.json();
            alert(data.success ? 'Bot started!' : data.msg);
            update();
          }

          async function stopBot() {
            const r = await fetch('/stop', { method: 'POST' });
            const data = await r.json();
            alert(data.success ? 'Bot stopped!' : data.msg);
            update();
          }

          async function triggerSequence() {
            const r = await fetch('/command', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ command: '/joinseq' })
            });
            const data = await r.json();
            alert(data.msg);
            update();
          }

          setInterval(update, 4000);
          update();
        </script>
      </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: bot && bot.entity ? bot.entity.position : null,
    lastActivity: botState.lastActivity,
    reconnectAttempts: botState.reconnectAttempts,
    sequenceStatus: botState.sequenceStatus,
    sequenceStep: botState.sequenceStep,
    totalSteps: botState.totalSteps,
    memoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
  });
});

app.get("/ping", (req, res) => res.send("pong"));

app.get("/logs", (req, res) => {
  const logs = getLogs();

  const escapeHTML = (str) =>
    str.replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );

  const logCount = logs.length;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Logs</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            margin: 0;
            padding: 30px 20px;
          }
          main { width: 100%; max-width: 800px; margin: 0 auto; }
          .back-btn {
            display: inline-flex; align-items: gap: 6px;
            font-size: 13px; color: #8b949e; text-decoration: none;
            background: #161b22; border: 1px solid #21262d; border-radius: 8px;
            padding: 6px 12px; margin-bottom: 20px;
          }
          .back-btn:hover { background: #21262d; color: #fff; }
          .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; }
          h1 { font-size: 22px; margin: 0; color: #f0f6fc; }
          .card { background: #0d1117; border: 1px solid #21262d; border-radius: 10px; overflow: hidden; }
          .card-header { background: #161b22; border-bottom: 1px solid #21262d; padding: 10px 16px; font-size: 12px; color: #8b949e; display: flex; gap: 8px; align-items: center; }
          .dot { width: 9px; height: 9px; border-radius: 50%; }
          .dot-red { background: #ff5f57; } .dot-yellow { background: #ffbd2e; } .dot-green { background: #28c840; }
          .log-body { padding: 14px 16px; max-height: 520px; overflow-y: auto; font-family: monospace; font-size: 12.5px; line-height: 1.6; }
          .log-entry { display: block; word-break: break-all; }
          .log-entry.error   { color: #ff7b72; }
          .log-entry.warn    { color: #e3b341; }
          .log-entry.success { color: #3fb950; }
          .log-entry.control { color: #58a6ff; }
          .log-entry.seq     { color: #d2a8ff; font-weight: 600; }
          .log-entry.default { color: #8b949e; }
          .console-row { display: flex; border-top: 1px solid #21262d; background: #0d1117; padding: 8px 14px; gap: 10px; }
          .console-input { flex: 1; background: transparent; border: none; outline: none; font-family: monospace; font-size: 13px; color: #e6edf3; }
          .console-send { background: #0d2218; border: 1px solid #238636; color: #3fb950; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px; cursor: pointer; }
        </style>
      </head>
      <body>
        <main>
          <a href="/" class="back-btn">&larr; Back to Dashboard</a>
          <div class="header-row">
            <div>
              <h1>Live Bot Console</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#8b949e;">Multi-step join sequence & in-game logs</p>
            </div>
            <span style="font-size:12px;color:#8b949e;background:#161b22;padding:4px 10px;border-radius:12px;border:1px solid #21262d;">${logCount} entries</span>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
              <span>mineflayer-bot.log</span>
            </div>
            <div class="log-body" id="log-body">
              ${logs.map((l) => {
                const esc = escapeHTML(l);
                const lower = l.toLowerCase();
                let cls = "default";
                if (lower.includes("error") || lower.includes("fail")) cls = "error";
                else if (lower.includes("warn")) cls = "warn";
                else if (lower.includes("[joinsequence]")) cls = "seq";
                else if (lower.includes("[control]")) cls = "control";
                else if (lower.includes("spawn") || lower.includes("connect")) cls = "success";
                return `<span class="log-entry ${cls}">${esc}</span>`;
              }).join("")}
            </div>
            <div class="console-row">
              <span style="color:#3fb950;font-family:monospace;font-weight:700;">&gt;</span>
              <input id="cin" class="console-input" type="text" placeholder="Type /joinseq to test sequence, or any Minecraft command..." autocomplete="off">
              <button id="csend" class="console-send">Send</button>
            </div>
          </div>
        </main>
        <script>
          const b = document.getElementById('log-body');
          b.scrollTop = b.scrollHeight;
          const inp = document.getElementById('cin');
          const btn = document.getElementById('csend');

          async function send() {
            const val = inp.value.trim();
            if (!val) return;
            inp.value = '';
            await fetch('/command', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ command: val })
            });
            setTimeout(() => location.reload(), 300);
          }

          btn.onclick = send;
          inp.onkeydown = (e) => { if (e.key === 'Enter') send(); };
          setTimeout(() => location.reload(), 5000);
        </script>
      </body>
    </html>
  `);
});

let botRunning = true;

app.post("/start", (req, res) => {
  if (botRunning) return res.json({ success: false, msg: "Already running" });
  botRunning = true;
  createBot();
  addLog("[Control] Bot started manually via Web Panel");
  res.json({ success: true });
});

app.post("/stop", (req, res) => {
  if (!botRunning) return res.json({ success: false, msg: "Already stopped" });
  botRunning = false;
  clearJoinSequence();
  clearAllIntervals();
  clearBotTimeouts();

  if (bot) {
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (_) {}
    bot = null;
  }
  botState.connected = false;
  botState.sequenceStatus = "idle";
  addLog("[Control] Bot stopped manually via Web Panel");
  res.json({ success: true });
});

app.post("/command", (req, res) => {
  const cmd = (req.body.command || "").trim();
  if (!cmd) return res.json({ success: false, msg: "Empty command" });

  addLog(`[Console] > ${cmd}`);

  if (cmd === "/joinseq") {
    if (!bot || !botState.connected) {
      return res.json({ success: false, msg: "Bot is not connected right now." });
    }
    const mcData = require("minecraft-data")(bot.version || config.server.version);
    const defaultMove = new Movements(bot, mcData);
    runJoinSequence(bot, mcData, defaultMove);
    return res.json({ success: true, msg: "Triggered join sequence manually!" });
  }

  if (cmd === "/help") {
    const lines = [
      "Available commands:",
      "  /joinseq       - Manually re-trigger the 3-step join sequence",
      "  /pos           - Show bot's current coordinates",
      "  /status        - Show bot connection status & sequence state",
      "  /say <message> - Send a chat message in-game",
      "  /<anything>    - Send any Minecraft command directly"
    ];
    lines.forEach((l) => addLog(`[Console] ${l}`));
    return res.json({ success: true, msg: lines.join("\n") });
  }

  if (cmd === "/pos" || cmd === "/coords") {
    const pos = bot && bot.entity ? bot.entity.position : null;
    const msg = pos
      ? `Position: X=${Math.floor(pos.x)} Y=${Math.floor(pos.y)} Z=${Math.floor(pos.z)}`
      : "Position unavailable (bot not spawned).";
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }

  if (cmd === "/status") {
    const status = botState.connected ? "Connected" : "Disconnected";
    const uptime = Math.floor((Date.now() - botState.startTime) / 1000);
    const msg = `Status: ${status} | Seq: ${botState.sequenceStatus} (Step ${botState.sequenceStep}/${botState.totalSteps}) | Uptime: ${uptime}s | Reconnects: ${botState.reconnectAttempts}`;
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }

  if (!bot || typeof bot.chat !== "function") {
    const msg = "Bot is not connected to chat.";
    addLog(`[Console] ${msg}`);
    return res.json({ success: false, msg });
  }

  try {
    bot.chat(cmd);
    addLog(`[Console] Sent to server: ${cmd}`);
    return res.json({ success: true, msg: `Sent: ${cmd}` });
  } catch (err) {
    addLog(`[Console] Error: ${err.message}`);
    return res.json({ success: false, msg: err.message });
  }
});

// Start Express Server
const server = app.listen(PORT, "0.0.0.0", () => {
  addLog(`[Server] Web Dashboard started on port ${server.address().port}`);
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const fallbackPort = PORT + 1;
    addLog(`[Server] Port ${PORT} busy - falling back to ${fallbackPort}`);
    server.listen(fallbackPort, "0.0.0.0");
  } else {
    addLog(`[Server] HTTP server error: ${err.message}`);
  }
});

// ============================================================
// SELF-PING SYSTEM (Render / Replit keep-alive)
// ============================================================
const SELF_PING_INTERVAL = 10 * 60 * 1000;
function startSelfPing() {
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (!renderUrl) {
    addLog("[KeepAlive] Running locally or without RENDER_EXTERNAL_URL");
    return;
  }
  setInterval(() => {
    const protocol = renderUrl.startsWith("https") ? https : http;
    protocol.get(`${renderUrl}/ping`, () => {}).on("error", (e) => {
      addLog(`[KeepAlive] Ping failed: ${e.message}`);
    });
  }, SELF_PING_INTERVAL);
  addLog("[KeepAlive] Self-ping active (every 10m)");
}
startSelfPing();

// ============================================================
// BOT CREATION & RECONNECT ENGINE
// ============================================================
let bot = null;
let activeIntervals = [];
let reconnectTimeoutId = null;
let connectionTimeoutId = null;
let isReconnecting = false;
let lastDiscordSend = 0;
const DISCORD_RATE_LIMIT_MS = 5000;

function clearBotTimeouts() {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  if (connectionTimeoutId) {
    clearTimeout(connectionTimeoutId);
    connectionTimeoutId = null;
  }
}

function clearAllIntervals() {
  if (activeIntervals.length > 0) {
    activeIntervals.forEach((id) => clearInterval(id));
    activeIntervals = [];
  }
}

function addInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.push(id);
  return id;
}

function getReconnectDelay() {
  if (botState.wasThrottled) {
    botState.wasThrottled = false;
    const throttleDelay = 60000 + Math.floor(Math.random() * 60000);
    addLog(`[Bot] Server throttle detected - backing off for ${Math.round(throttleDelay / 1000)}s`);
    return throttleDelay;
  }

  const baseDelay = config.utils["auto-reconnect-delay"] || 3000;
  const maxDelay = config.utils["max-reconnect-delay"] || 30000;
  const delay = Math.min(baseDelay * Math.pow(1.6, botState.reconnectAttempts), maxDelay);
  const jitter = Math.floor(Math.random() * 2000);
  return Math.round(delay + jitter);
}

function createBot() {
  if (isReconnecting) {
    addLog("[Bot] Reconnection currently in progress, skipping duplicate call...");
    return;
  }

  // Clean up any existing instances and pending join-sequence timers
  clearJoinSequence();
  clearAllIntervals();

  if (bot) {
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (e) {
      addLog(`[Cleanup] Error ending previous bot: ${e.message}`);
    }
    bot = null;
  }

  addLog(`[Bot] Initiating connection to ${config.server.ip}:${config.server.port} as "${config["bot-account"].username}"...`);

  try {
    const botVersion = config.server.version && config.server.version.trim() !== ""
      ? config.server.version
      : false;

    bot = mineflayer.createBot({
      username: config["bot-account"].username,
      password: config["bot-account"].password || undefined,
      auth: config["bot-account"].type || "offline",
      host: config.server.ip,
      port: config.server.port,
      version: botVersion,
      hideErrors: false,
      checkTimeoutInterval: 600000,
    });

    bot.loadPlugin(pathfinder);

    clearBotTimeouts();
    // Guard against dead connection where spawn never fires
    connectionTimeoutId = setTimeout(() => {
      if (!botState.connected) {
        addLog("[Bot] Connection timeout: spawn packet not received within 150s");
        try {
          bot.removeAllListeners();
          bot.end();
        } catch (_) {}
        bot = null;
        scheduleReconnect();
      }
    }, 150000);

    let spawnHandled = false;
    let authSent = false;

    function getAuthCommand() {
      if (config["join-sequence"] && config["join-sequence"].steps && config["join-sequence"].steps.length > 0) {
        const step1 = config["join-sequence"].steps[0];
        if (step1 && step1.command) return step1.command;
      }
      const pass = (config["bot-account"] && config["bot-account"].password) ? config["bot-account"].password : "Demonx32";
      return `/login ${pass}`;
    }

    function getRegisterCommand() {
      const pass = (config["bot-account"] && config["bot-account"].password) ? config["bot-account"].password : "Demonx32";
      return `/register ${pass} ${pass}`;
    }

    function doAuth() {
      if (authSent || !bot) return;
      authSent = true;
      botState.connected = true;
      botState.lastActivity = Date.now();
      const cmd = getAuthCommand();
      addLog(`[Auth] Executing Step 1: "${cmd}"...`);
      try {
        bot.chat(cmd);
      } catch (err) {
        addLog(`[Auth] Chat send error: ${err.message}`);
      }
    }

    bot.once("login", () => {
      botState.connected = true;
      botState.lastActivity = Date.now();
      isReconnecting = false;
      addLog(`[Bot] [+] Connected to proxy gateway as "${config["bot-account"].username}"! Triggering auth in 1.2s...`);
      setTimeout(() => {
        doAuth();
      }, 1200);
    });

    bot.on("message", (msg) => {
      const text = msg.toString();
      addLog(`[Chat] ${text}`);
      const lower = text.toLowerCase();
      if (lower.includes("/login") || lower.includes("please, login") || lower.includes("authorization time")) {
        addLog(`[Auth] Received login prompt from server - executing auth command`);
        doAuth();
      } else if (lower.includes("/register") || lower.includes("please, register") || lower.includes("use /register")) {
        const regCmd = getRegisterCommand();
        addLog(`[Auth] Server requested registration - sending "${regCmd}"`);
        try { bot.chat(regCmd); } catch (_) {}
      }
    });

    bot.once("spawn", () => {
      if (spawnHandled) return;
      spawnHandled = true;

      clearBotTimeouts();
      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;

      addLog(`[Bot] [+] Successfully spawned in world! (Version: ${bot.version})`);

      if (config.discord && config.discord.events && config.discord.events.connect) {
        sendDiscordWebhook(`[+] **Connected & Spawned** in \`${config.server.ip}:${config.server.port}\``, 0x4ade80);
      }

      const mcData = require("minecraft-data")(bot.version);
      const defaultMove = new Movements(bot, mcData);
      defaultMove.allowFreeMotion = false;
      defaultMove.canDig = false;
      defaultMove.liquidCost = 1000;
      defaultMove.fallDamageCost = 1000;

      // Execute Step 2 (/server lifesteal) and Step 3 (/warp afk)
      runPostSpawnSequence(bot, mcData, defaultMove);
    });

    // When the server kicks the bot
    bot.on("kicked", (reason) => {
      const kickReason = typeof reason === "object" ? JSON.stringify(reason) : String(reason);
      addLog(`[Bot] [!] Kicked from server: ${kickReason}`);
      botState.connected = false;
      botState.sequenceStatus = "failed";
      botState.errors.push({ type: "kicked", reason: kickReason, time: Date.now() });

      clearJoinSequence();
      clearAllIntervals();

      const reasonLower = kickReason.toLowerCase();
      if (reasonLower.includes("throttl") || reasonLower.includes("wait before reconnect") || reasonLower.includes("too fast")) {
        addLog("[Bot] Throttle detected - will wait longer before reconnecting");
        botState.wasThrottled = true;
      }

      if (config.discord && config.discord.events && config.discord.events.disconnect) {
        sendDiscordWebhook(`[!] **Kicked**: ${kickReason}`, 0xff0000);
      }
      // Reconnect will be triggered by the 'end' event right after 'kicked'
    });

    // The single authoritative disconnect trigger
    bot.on("end", (reason) => {
      addLog(`[Bot] [-] Disconnected: ${reason || "Connection closed"}`);
      botState.connected = false;
      botState.sequenceStatus = "idle";
      clearJoinSequence();
      clearAllIntervals();
      spawnHandled = false;

      if (config.discord && config.discord.events && config.discord.events.disconnect) {
        sendDiscordWebhook(`[-] **Disconnected**: ${reason || "Connection closed"}`, 0xf87171);
      }

      // Automatically re-trigger connection & sequence
      scheduleReconnect();
    });

    bot.on("error", (err) => {
      const msg = err.message || "Unknown error";
      addLog(`[Bot] Error event: ${msg}`);
      botState.errors.push({ type: "error", message: msg, time: Date.now() });
    });

  } catch (err) {
    addLog(`[Bot] Exception initializing bot: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearBotTimeouts();

  if (isReconnecting) {
    addLog("[Bot] Reconnection timer already scheduled.");
    return;
  }

  isReconnecting = true;
  botState.reconnectAttempts++;

  const delay = getReconnectDelay();
  addLog(`[Bot] Reconnecting in ${(delay / 1000).toFixed(1)}s (Attempt #${botState.reconnectAttempts})...`);

  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    isReconnecting = false;
    createBot();
  }, delay);
}

// ============================================================
// AFK & IN-GAME MODULE INITIALIZATION (Runs AFTER Join Sequence)
// ============================================================
function initializeModules(currentBot, mcData, defaultMove) {
  addLog("[Modules] Initializing AFK routines at destination...");

  // Chat message broadcaster (optional periodic promotional or regular chat)
  if (config.utils["chat-messages"] && config.utils["chat-messages"].enabled) {
    const messages = config.utils["chat-messages"].messages;
    if (config.utils["chat-messages"].repeat && messages.length > 0) {
      let i = 0;
      addInterval(() => {
        if (currentBot && botState.connected) {
          currentBot.chat(messages[i]);
          botState.lastActivity = Date.now();
          i = (i + 1) % messages.length;
        }
      }, (config.utils["chat-messages"]["repeat-delay"] || 120) * 1000);
    }
  }

  // Position goal (if configured and circle-walk is disabled)
  if (config.position && config.position.enabled && !(config.movement && config.movement["circle-walk"] && config.movement["circle-walk"].enabled)) {
    try {
      currentBot.pathfinder.setMovements(defaultMove);
      currentBot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
      addLog(`[Position] Moving to target coords (${config.position.x}, ${config.position.y}, ${config.position.z})`);
    } catch (e) {
      addLog(`[Position] Error setting goal: ${e.message}`);
    }
  }

  // Anti-AFK behaviors
  if (config.utils["anti-afk"] && config.utils["anti-afk"].enabled) {
    // Arm swing
    addInterval(() => {
      if (!currentBot || !botState.connected) return;
      try { currentBot.swingArm(); } catch (_) {}
    }, 12000 + Math.floor(Math.random() * 30000));

    // Hotbar cycling
    addInterval(() => {
      if (!currentBot || !botState.connected) return;
      try {
        const slot = Math.floor(Math.random() * 9);
        currentBot.setQuickBarSlot(slot);
      } catch (_) {}
    }, 25000 + Math.floor(Math.random() * 40000));

    // Sneaking / Teabagging
    if (config.utils["anti-afk"].sneak) {
      try {
        if (typeof currentBot.setControlState === "function") {
          currentBot.setControlState("sneak", true);
        }
      } catch (_) {}
    }
  }

  // Movement routines (Circle Walk, Look Around, Random Jump)
  if (config.movement && config.movement.enabled !== false) {
    if (config.movement["circle-walk"] && config.movement["circle-walk"].enabled) {
      startCircleWalk(currentBot, defaultMove);
    }
    if (config.movement["random-jump"] && config.movement["random-jump"].enabled && !(config.movement["circle-walk"] && config.movement["circle-walk"].enabled)) {
      startRandomJump(currentBot);
    }
    if (config.movement["look-around"] && config.movement["look-around"].enabled) {
      startLookAround(currentBot);
    }
  }

  // Combat / Mob Defense & Auto-eat
  if (config.modules.combat) {
    setupCombatModule(currentBot, mcData);
  }

  // Chat auto-responder
  if (config.modules.chat) {
    setupChatModule(currentBot);
  }

  addLog("[Modules] [+] All AFK routines are active!");
}

function startCircleWalk(currentBot, defaultMove) {
  const radius = (config.movement["circle-walk"] && config.movement["circle-walk"].radius) || 2;
  let angle = 0;
  let lastPathTime = 0;

  addInterval(() => {
    if (!currentBot || !botState.connected || !currentBot.entity) return;
    const now = Date.now();
    if (now - lastPathTime < 2500) return;
    lastPathTime = now;
    try {
      const x = currentBot.entity.position.x + Math.cos(angle) * radius;
      const z = currentBot.entity.position.z + Math.sin(angle) * radius;
      currentBot.pathfinder.setMovements(defaultMove);
      currentBot.pathfinder.setGoal(new GoalBlock(Math.floor(x), Math.floor(currentBot.entity.position.y), Math.floor(z)));
      angle += Math.PI / 4;
      botState.lastActivity = Date.now();
    } catch (e) {
      // Ignore pathfinding hiccups
    }
  }, (config.movement["circle-walk"] && config.movement["circle-walk"].speed) || 3500);
}

function startRandomJump(currentBot) {
  addInterval(() => {
    if (!currentBot || !botState.connected || typeof currentBot.setControlState !== "function") return;
    try {
      currentBot.setControlState("jump", true);
      setTimeout(() => {
        if (currentBot && typeof currentBot.setControlState === "function") {
          currentBot.setControlState("jump", false);
        }
      }, 300);
      botState.lastActivity = Date.now();
    } catch (_) {}
  }, (config.movement["random-jump"] && config.movement["random-jump"].interval) || 12000);
}

function startLookAround(currentBot) {
  addInterval(() => {
    if (!currentBot || !botState.connected) return;
    try {
      const yaw = Math.random() * Math.PI * 2 - Math.PI;
      const pitch = (Math.random() * Math.PI) / 2 - Math.PI / 4;
      currentBot.look(yaw, pitch, false);
      botState.lastActivity = Date.now();
    } catch (_) {}
  }, (config.movement["look-around"] && config.movement["look-around"].interval) || 5000);
}

function setupCombatModule(currentBot, mcData) {
  let lastAttackTime = 0;

  currentBot.on("physicsTick", () => {
    if (!currentBot || !botState.connected) return;
    if (!config.combat || !config.combat["attack-mobs"]) return;

    const now = Date.now();
    if (now - lastAttackTime < 650) return; // Attack cooldown

    try {
      const mobs = Object.values(currentBot.entities).filter(
        (e) => e.type === "mob" && e.position && currentBot.entity && currentBot.entity.position.distanceTo(e.position) < 3.8
      );
      if (mobs.length > 0) {
        currentBot.attack(mobs[0]);
        lastAttackTime = now;
      }
    } catch (_) {}
  });

  // Auto-Eat
  currentBot.on("health", () => {
    if (!config.combat || !config.combat["auto-eat"]) return;
    try {
      if (currentBot.food < 14) {
        const food = currentBot.inventory.items().find((i) => i.foodPoints && i.foodPoints > 0);
        if (food) {
          currentBot.equip(food, "hand").then(() => currentBot.consume()).catch(() => {});
        }
      }
    } catch (_) {}
  });
}

function setupChatModule(currentBot) {
  currentBot.on("chat", (username, message) => {
    if (!currentBot || username === currentBot.username) return;
    try {
      if (config.discord && config.discord.enabled && config.discord.events && config.discord.events.chat) {
        sendDiscordWebhook(`💬 **${username}**: ${message}`, 0x7289da);
      }
      if (config.chat && config.chat.respond) {
        const lower = message.toLowerCase();
        if (lower === "ping") currentBot.chat("pong!");
      }
    } catch (_) {}
  });
}

// Discord Webhook
function sendDiscordWebhook(content, color = 0x0099ff) {
  if (!config.discord || !config.discord.enabled || !config.discord.webhookUrl || config.discord.webhookUrl.includes("YOUR_DISCORD")) return;
  const now = Date.now();
  if (now - lastDiscordSend < DISCORD_RATE_LIMIT_MS) return;
  lastDiscordSend = now;

  try {
    const urlParts = new URL(config.discord.webhookUrl);
    const protocol = config.discord.webhookUrl.startsWith("https") ? https : http;
    const payload = JSON.stringify({
      username: config.name,
      embeds: [{ description: content, color, timestamp: new Date().toISOString() }]
    });

    const req = protocol.request({
      hostname: urlParts.hostname,
      port: 443,
      path: urlParts.pathname + urlParts.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload, "utf8"),
      }
    });
    req.on("error", () => {});
    req.write(payload);
    req.end();
  } catch (_) {}
}

// Crash Recovery
process.on("uncaughtException", (err) => {
  addLog(`[FATAL] Uncaught Exception: ${err.message}`);
  clearJoinSequence();
  clearAllIntervals();
  botState.connected = false;
  botState.sequenceStatus = "failed";
  if (isReconnecting) isReconnecting = false;
  setTimeout(() => scheduleReconnect(), 6000);
});

process.on("unhandledRejection", (reason) => {
  addLog(`[FATAL] Unhandled Rejection: ${String(reason)}`);
});

// START
addLog("=".repeat(52));
addLog("  Minecraft AFK Bot v2.5 - Multi-Step Join Sequence");
addLog("=".repeat(52));
addLog(`Server Target: ${config.server.ip}:${config.server.port}`);
addLog(`Bot IGN: ${config["bot-account"].username}`);
addLog(`Join Steps: 1: /login lifesteal -> 2: /server lifesteal (5s) -> 3: /warp afk (5s)`);
addLog("=".repeat(52));

createBot();
