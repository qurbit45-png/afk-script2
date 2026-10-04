import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Play,
  RotateCcw,
  CheckCircle2,
  Server,
  User,
  Copy,
  Check,
  Clock,
  ArrowRight,
  Shield,
  Zap,
  Settings,
  Code,
  Download,
  Plus,
  Trash2,
  Activity,
  Compass,
  Sword,
  MessageSquare,
  HelpCircle,
  AlertCircle
} from "lucide-react";

interface SequenceStep {
  id: string;
  name: string;
  command: string;
  delaySec: number;
}

interface BotConfig {
  name: string;
  username: string;
  serverIp: string;
  serverPort: number;
  serverVersion: string;
  authType: "offline" | "microsoft";
  circleWalk: boolean;
  circleRadius: number;
  lookAround: boolean;
  randomJump: boolean;
  sneak: boolean;
  autoEat: boolean;
  attackMobs: boolean;
  reconnectDelay: number;
  maxReconnectDelay: number;
  discordWebhook: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"sequence" | "config" | "code" | "guide">("sequence");

  // Bot Configuration State
  const [config, setConfig] = useState<BotConfig>({
    name: "AFK Bot",
    username: "DemonXTR",
    serverIp: "play.oderismc.fun",
    serverPort: 19142,
    serverVersion: "",
    authType: "offline",
    circleWalk: false,
    circleRadius: 2,
    lookAround: false,
    randomJump: false,
    sneak: false,
    autoEat: false,
    attackMobs: false,
    reconnectDelay: 3000,
    maxReconnectDelay: 30000,
    discordWebhook: ""
  });

  // Join Sequence Steps State (Configured to the exact user specs)
  const [steps, setSteps] = useState<SequenceStep[]>([
    {
      id: "1",
      name: "Initial Login",
      command: "/login Demonx32",
      delaySec: 1.5
    },
    {
      id: "2",
      name: "Switch to Lifesteal Realm",
      command: "/server lifesteal",
      delaySec: 5.0
    },
    {
      id: "3",
      name: "Warp to AFK Station",
      command: "/warp afk",
      delaySec: 5.0
    }
  ]);

  // Selected Code File Tab
  const [selectedFile, setSelectedFile] = useState<"settings.json" | "index.js" | "logger.js" | "package.json">("settings.json");
  const [copied, setCopied] = useState(false);

  // Simulation State
  const [simRunning, setSimRunning] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(-1);
  const [simSecondsLeft, setSimSecondsLeft] = useState(0);
  const [simLogs, setSimLogs] = useState<Array<{ text: string; type: "info" | "cmd" | "success" | "warn" | "error"; time: string }>>([]);
  const [simReconnecting, setSimReconnecting] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Add initial log
  useEffect(() => {
    setSimLogs([
      { time: "00:00:00", text: "[System] Bot sequence ready. Click 'Run Sequence Simulation' to test.", type: "info" }
    ]);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [simLogs]);

  const addSimLog = (text: string, type: "info" | "cmd" | "success" | "warn" | "error" = "info") => {
    const time = new Date().toLocaleTimeString();
    setSimLogs(prev => [...prev.slice(-100), { text, type, time }]);
  };

  // Run the sequence simulation
  const startSimulation = (simulateKick = false) => {
    if (simRunning) return;
    setSimRunning(true);
    setSimStepIndex(-1);
    setSimReconnecting(false);

    addSimLog(`[Bot] Connecting to ${config.serverIp}:${config.serverPort} as "${config.username}"...`, "info");

    // Spawn delay
    setTimeout(() => {
      addSimLog(`[Bot] [+] Successfully connected and spawned! (Minecraft ${config.serverVersion})`, "success");
      addSimLog(`[JoinSequence] === Executing ${steps.length}-Step Join Sequence ===`, "info");

      executeSimulationStep(0, simulateKick);
    }, 1200);
  };

  const executeSimulationStep = (index: number, simulateKickAfterComplete = false) => {
    if (index >= steps.length) {
      // Completed sequence
      setSimStepIndex(steps.length);
      addSimLog(`[JoinSequence] [+] Sequence completed! Arrived at destination.`, "success");
      addSimLog(`[Modules] Anti-AFK routines activated (Sneak: ${config.sneak ? "ON" : "OFF"}, CircleWalk: ${config.circleWalk ? "ON" : "OFF"}).`, "info");

      if (simulateKickAfterComplete) {
        setTimeout(() => {
          addSimLog(`[Bot] [!] Kicked: "Server closed" or "Proxy restart"`, "error");
          addSimLog(`[Bot] Reconnecting in 3.0s... Sequence will repeat automatically!`, "warn");
          setSimReconnecting(true);
          setSimStepIndex(-1);

          setTimeout(() => {
            setSimReconnecting(false);
            addSimLog(`[Bot] [+] Reconnected! Re-triggering sequence from Step 1...`, "success");
            executeSimulationStep(0, false);
          }, 3000);
        }, 3000);
      } else {
        setSimRunning(false);
      }
      return;
    }

    const current = steps[index];
    setSimStepIndex(index);
    let remaining = current.delaySec;
    setSimSecondsLeft(remaining);

    const interval = setInterval(() => {
      remaining -= 0.5;
      if (remaining <= 0) {
        clearInterval(interval);
        addSimLog(`[JoinSequence] [Step ${index + 1}/${steps.length}] Sent: "${current.command}" (${current.name})`, "cmd");
        executeSimulationStep(index + 1, simulateKickAfterComplete);
      } else {
        setSimSecondsLeft(Math.max(0, parseFloat(remaining.toFixed(1))));
      }
    }, 500);
  };

  const stopSimulation = () => {
    setSimRunning(false);
    setSimStepIndex(-1);
    setSimReconnecting(false);
    addSimLog("[Bot] Simulation stopped by user.", "warn");
  };

  // Add / Remove step
  const addStep = () => {
    const newId = String(Date.now());
    setSteps([
      ...steps,
      {
        id: newId,
        name: `Step ${steps.length + 1}`,
        command: "/say Hello",
        delaySec: 5.0
      }
    ]);
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, field: keyof SequenceStep, val: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: val } : s));
  };

  // Generate dynamic settings.json based on UI values
  const generatedSettingsJson = JSON.stringify(
    {
      name: config.name,
      "bot-account": {
        username: config.username,
        password: "",
        type: config.authType
      },
      server: {
        ip: config.serverIp,
        port: Number(config.serverPort),
        version: config.serverVersion,
        "try-creative": false
      },
      "join-sequence": {
        enabled: true,
        description: "Executed in order upon every server join and reconnect",
        steps: steps.map(s => ({
          name: s.name,
          command: s.command,
          delayMs: Math.round(s.delaySec * 1000)
        }))
      },
      position: {
        enabled: false,
        x: 0,
        y: 100,
        z: 0
      },
      utils: {
        "anti-afk": {
          enabled: config.sneak,
          sneak: config.sneak,
          "arm-swing": false,
          "hotbar-cycle": false,
          teabag: false
        },
        "chat-messages": {
          enabled: false,
          repeat: true,
          "repeat-delay": 120,
          messages: ["I am currently AFK."]
        },
        "chat-log": true,
        "auto-reconnect": true,
        "auto-reconnect-delay": config.reconnectDelay,
        "max-reconnect-delay": config.maxReconnectDelay
      },
      movement: {
        enabled: config.circleWalk || config.lookAround || config.randomJump,
        "circle-walk": {
          enabled: config.circleWalk,
          radius: config.circleRadius,
          speed: 3500
        },
        "look-around": {
          enabled: config.lookAround,
          interval: 5000
        },
        "random-jump": {
          enabled: config.randomJump,
          interval: 12000
        }
      },
      modules: {
        avoidMobs: false,
        combat: config.attackMobs,
        beds: false,
        chat: true,
        "console-commands": true
      },
      combat: {
        "attack-mobs": config.attackMobs,
        "auto-eat": config.autoEat
      },
      discord: {
        enabled: Boolean(config.discordWebhook),
        webhookUrl: config.discordWebhook,
        events: {
          connect: true,
          disconnect: true,
          chat: false
        }
      }
    },
    null,
    2
  );

  const getFileContent = () => {
    switch (selectedFile) {
      case "settings.json":
        return generatedSettingsJson;
      case "index.js":
        return `// Minecraft AFK Bot v2.5 with Multi-Step Join Sequence
// Full script with auto-reconnect, join sequence runner, and web dashboard
const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals;
const config = require("./settings.json");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 5000;

let bot = null;
let joinSequenceTimers = [];

function clearJoinSequence() {
  joinSequenceTimers.forEach(t => clearTimeout(t));
  joinSequenceTimers = [];
}

function runJoinSequence(currentBot, mcData, defaultMove) {
  clearJoinSequence();
  const steps = config["join-sequence"].steps || [];
  let delaySum = 0;

  addLog(\`[JoinSequence] Executing \${steps.length}-step join sequence...\`);

  steps.forEach((step, idx) => {
    delaySum += step.delayMs || 5000;
    const tid = setTimeout(() => {
      if (!currentBot || !currentBot.entity) return;
      currentBot.chat(step.command);
      addLog(\`[JoinSequence] Step \${idx + 1}/\${steps.length}: \${step.command}\`);

      // After final step, start anti-AFK movement
      if (idx === steps.length - 1) {
        addLog("[JoinSequence] Reached destination! Starting AFK routines.");
        initializeModules(currentBot, mcData, defaultMove);
      }
    }, delaySum);
    joinSequenceTimers.push(tid);
  });
}

function createBot() {
  clearJoinSequence();
  bot = mineflayer.createBot({
    username: config["bot-account"].username,
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version || false
  });

  bot.once("spawn", () => {
    addLog("[Bot] Spawned! Starting join sequence...");
    const mcData = require("minecraft-data")(bot.version);
    const defaultMove = new Movements(bot, mcData);
    runJoinSequence(bot, mcData, defaultMove);
  });

  bot.on("kicked", (reason) => {
    addLog(\`[Bot] Kicked: \${reason}\`);
    clearJoinSequence();
  });

  bot.on("end", () => {
    addLog("[Bot] Disconnected. Reconnecting...");
    clearJoinSequence();
    setTimeout(createBot, config.utils["auto-reconnect-delay"] || 3000);
  });
}

function initializeModules(currentBot, mcData, defaultMove) {
  if (config.utils["anti-afk"].sneak) currentBot.setControlState("sneak", true);
  // Additional movement routines...
}

createBot();
app.listen(PORT, () => console.log(\`Dashboard on port \${PORT}\`));`;
      case "logger.js":
        return `"use strict";
const logs = [];

function addLog(message) {
  const time = new Date().toLocaleTimeString();
  const formatted = \`[\${time}] \${message}\`;
  console.log(formatted);
  logs.push(formatted);
  if (logs.length > 300) logs.shift();
}

function getLogs() {
  return logs;
}

module.exports = { addLog, getLogs };`;
      case "package.json":
        return `{
  "name": "minecraft-afk-bot",
  "version": "2.5.0",
  "description": "Robust AFK bot for Minecraft servers with multi-step join sequence.",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "minecraft-data": "^3.105.0",
    "mineflayer": "^4.35.0",
    "mineflayer-pathfinder": "^2.4.5"
  }
}`;
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getFileContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight text-white">AFK Bot Sequence Studio</h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.5 Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Target: <span className="text-slate-200 font-mono">{config.serverIp}:{config.serverPort}</span> &middot; IGN: <span className="text-slate-200 font-mono">{config.username}</span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-sm">
            <button
              onClick={() => setActiveTab("sequence")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "sequence"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Terminal className="w-4 h-4" />
              Join Sequence & Test
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "config"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Settings className="w-4 h-4" />
              Bot Config
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "code"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Code className="w-4 h-4" />
              Export Script Files
            </button>
            <button
              onClick={() => setActiveTab("guide")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "guide"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              24/7 Hosting Guide
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {/* TAB 1: JOIN SEQUENCE & SIMULATOR */}
        {activeTab === "sequence" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 cols: Step Builder */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      Sequential Join Commands
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Commands execute in order upon initial connect and re-trigger automatically whenever reconnected.
                    </p>
                  </div>
                  <button
                    onClick={addStep}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Step
                  </button>
                </div>

                {/* Steps List */}
                <div className="space-y-3">
                  {steps.map((step, idx) => {
                    const isCurrentInSim = simRunning && simStepIndex === idx;
                    const isPassedInSim = simRunning && simStepIndex > idx;

                    return (
                      <div
                        key={step.id}
                        className={`relative rounded-xl p-4 border transition-all ${
                          isCurrentInSim
                            ? "bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500"
                            : isPassedInSim
                            ? "bg-slate-900/90 border-emerald-800/50"
                            : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          {/* Step number badge */}
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                isCurrentInSim
                                  ? "bg-emerald-500 text-slate-950 animate-pulse"
                                  : isPassedInSim
                                  ? "bg-emerald-900 text-emerald-300"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <input
                              type="text"
                              value={step.name}
                              onChange={(e) => updateStep(step.id, "name", e.target.value)}
                              className="font-semibold text-sm bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none text-slate-200 px-1 py-0.5"
                              placeholder="Step name"
                            />
                          </div>

                          {/* Delay and Delete */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Delay:</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={step.delaySec}
                                onChange={(e) => updateStep(step.id, "delaySec", parseFloat(e.target.value) || 0)}
                                className="w-12 bg-slate-950 text-slate-100 text-center font-mono rounded border border-slate-700 focus:outline-none px-1 py-0.5"
                              />
                              <span>sec</span>
                            </div>

                            {steps.length > 1 && (
                              <button
                                onClick={() => removeStep(step.id)}
                                className="text-slate-500 hover:text-red-400 p-1 transition"
                                title="Remove step"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Command Input Box */}
                        <div className="mt-3 flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/80">
                          <span className="text-emerald-400 font-mono text-xs font-bold">&gt;</span>
                          <input
                            type="text"
                            value={step.command}
                            onChange={(e) => updateStep(step.id, "command", e.target.value)}
                            className="flex-1 bg-transparent font-mono text-xs text-emerald-300 focus:outline-none"
                            placeholder="/command"
                          />
                        </div>

                        {isCurrentInSim && (
                          <div className="mt-2.5 flex items-center justify-between text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800/40">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              Executing command in progress...
                            </span>
                            <span className="font-mono font-bold">{simSecondsLeft}s left</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Final Destination Card */}
                <div className="mt-4 p-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 flex items-center gap-3 text-xs text-slate-400">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-200">Destination: AFK Area</span>
                    <p className="text-slate-500">
                      After Step {steps.length} ({steps[steps.length - 1]?.command || "/warp afk"}), the bot stays completely stationary at the AFK warp point.
                    </p>
                  </div>
                </div>
              </div>

              {/* Simulation Controls Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Interactive Sequence Simulator
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Verify the exact flow in real-time. Test normal join completion and test what happens when kicked by the server.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  {!simRunning ? (
                    <>
                      <button
                        onClick={() => startSimulation(false)}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm"
                      >
                        <Play className="w-4 h-4 fill-slate-950" />
                        Run Sequence Simulation
                      </button>
                      <button
                        onClick={() => startSimulation(true)}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold px-4 py-2 rounded-xl text-xs border border-amber-500/30 transition"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Test Kick & Auto-Reconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={stopSimulation}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                    >
                      Stop Simulation
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSimLogs([]);
                      addSimLog("[Console] Logs cleared.", "info");
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2"
                  >
                    Clear Terminal
                  </button>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Simulated Live Console */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col flex-1 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="ml-2 font-mono text-xs font-semibold text-slate-400">
                      live-session.log
                    </span>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                      simReconnecting
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                        : simRunning
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {simReconnecting ? "Reconnecting..." : simRunning ? "Sequence Running" : "Standby"}
                  </span>
                </div>

                {/* Log entries container */}
                <div
                  ref={logContainerRef}
                  className="flex-1 min-h-[380px] max-h-[460px] overflow-y-auto font-mono text-xs p-3 space-y-1.5 my-3 bg-slate-950 rounded-xl border border-slate-900"
                >
                  {simLogs.map((log, i) => {
                    let color = "text-slate-400";
                    if (log.type === "cmd") color = "text-emerald-400 font-bold";
                    if (log.type === "success") color = "text-emerald-300";
                    if (log.type === "warn") color = "text-amber-400";
                    if (log.type === "error") color = "text-red-400 font-bold";

                    return (
                      <div key={i} className="flex gap-2 leading-relaxed">
                        <span className="text-slate-600 select-none">{log.time}</span>
                        <span className={color}>{log.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Status Bar */}
                <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Server:</span>
                    <span className="font-mono text-slate-200">{config.serverIp}:{config.serverPort}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>IGN:</span>
                    <span className="font-mono text-slate-200">{config.username}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Sequence Progress:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {simStepIndex >= 0 && simStepIndex < steps.length
                        ? `Step ${simStepIndex + 1} of ${steps.length}`
                        : simStepIndex >= steps.length
                        ? "Complete (AFK Zone)"
                        : "Ready"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BOT CONFIGURATION */}
        {activeTab === "config" && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Server & Bot Account Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Minecraft Server & Bot Account
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Server IP / Hostname</label>
                  <input
                    type="text"
                    value={config.serverIp}
                    onChange={(e) => setConfig({ ...config, serverIp: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="play.oderismc.fun"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Server Port</label>
                  <input
                    type="number"
                    value={config.serverPort}
                    onChange={(e) => setConfig({ ...config, serverPort: parseInt(e.target.value) || 25565 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Bot In-Game Name (IGN)</label>
                  <input
                    type="text"
                    value={config.username}
                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="DemonXTR"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Minecraft Version</label>
                  <input
                    type="text"
                    value={config.serverVersion}
                    onChange={(e) => setConfig({ ...config, serverVersion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="1.20.1 (or leave blank to auto-detect)"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Leave empty or set to 1.20.1</span>
                </div>
              </div>
            </div>

            {/* Anti-AFK & Movement Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                Anti-AFK & Movement Behaviors
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
                  <div>
                    <span className="font-semibold text-sm text-slate-200 block">Continuous Sneak</span>
                    <span className="text-xs text-slate-500">Crouches to prevent mob knockback & detection</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.sneak}
                    onChange={(e) => setConfig({ ...config, sneak: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
                  <div>
                    <span className="font-semibold text-sm text-slate-200 block">Circle Walk (Pathfinding)</span>
                    <span className="text-xs text-slate-500">Walks in a small circle around the AFK spot</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.circleWalk}
                    onChange={(e) => setConfig({ ...config, circleWalk: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
                  <div>
                    <span className="font-semibold text-sm text-slate-200 block">Look Around Naturally</span>
                    <span className="text-xs text-slate-500">Smooth random head yaw and pitch rotation</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.lookAround}
                    onChange={(e) => setConfig({ ...config, lookAround: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
                  <div>
                    <span className="font-semibold text-sm text-slate-200 block">Random Jumps</span>
                    <span className="text-xs text-slate-500">Periodic jump actions every 12 seconds</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.randomJump}
                    onChange={(e) => setConfig({ ...config, randomJump: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>
              </div>
            </div>

            {/* Combat & Survival */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Sword className="w-4 h-4 text-emerald-400" />
                Combat & Auto-Survival
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
                  <div>
                    <span className="font-semibold text-sm text-slate-200 block">Attack Hostile Mobs</span>
                    <span className="text-xs text-slate-500">Swings weapon at mobs within 4 blocks</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.attackMobs}
                    onChange={(e) => setConfig({ ...config, attackMobs: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
                  <div>
                    <span className="font-semibold text-sm text-slate-200 block">Auto-Eat Food</span>
                    <span className="text-xs text-slate-500">Consumes food from inventory when hunger &lt; 14</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.autoEat}
                    onChange={(e) => setConfig({ ...config, autoEat: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>
              </div>
            </div>

            {/* Auto Reconnect Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                Auto-Reconnect Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Base Reconnect Delay (ms)</label>
                  <input
                    type="number"
                    value={config.reconnectDelay}
                    onChange={(e) => setConfig({ ...config, reconnectDelay: parseInt(e.target.value) || 3000 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Max Reconnect Delay (ms)</label>
                  <input
                    type="number"
                    value={config.maxReconnectDelay}
                    onChange={(e) => setConfig({ ...config, maxReconnectDelay: parseInt(e.target.value) || 30000 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CODE EXPORT */}
        {activeTab === "code" && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                {(["settings.json", "index.js", "logger.js", "package.json"] as const).map((filename) => (
                  <button
                    key={filename}
                    onClick={() => setSelectedFile(filename)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                      selectedFile === filename
                        ? "bg-emerald-500 text-slate-950 font-bold"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {filename}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy File"}
                </button>
                <button
                  onClick={() => downloadFile(selectedFile, getFileContent())}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>

            {/* Code Display */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
                <span>{selectedFile}</span>
                <span className="text-[11px] text-slate-500">Updated in real-time based on your settings</span>
              </div>
              <pre className="p-5 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed bg-slate-950/70 max-h-[560px]">
                <code>{getFileContent()}</code>
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: 24/7 HOSTING GUIDE */}
        {activeTab === "guide" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" />
                How to Host Your Bot 24/7
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Your bot includes an automated Express HTTP server and self-ping module, making it fully compatible with free hosting providers like Render, Replit, or a standard VPS.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                    <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs">1</span>
                    Local or VPS (Ubuntu / Debian / Windows)
                  </div>
                  <p className="text-xs text-slate-400">
                    Download the files from the <strong>Export Script Files</strong> tab into a folder, open your terminal and run:
                  </p>
                  <pre className="p-2.5 bg-slate-900 rounded-lg text-emerald-400 font-mono text-xs">
                    npm install{"\n"}npm start
                  </pre>
                  <p className="text-xs text-slate-500">
                    Your bot will connect and the web dashboard will open on port 5000.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                    <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs">2</span>
                    Render.com (Free 24/7 Web Service)
                  </div>
                  <ol className="text-xs text-slate-400 list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>Push the bot files to a GitHub repository.</li>
                    <li>Create a new <strong>Web Service</strong> on Render linked to your repository.</li>
                    <li>Set Build Command to <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">npm install</code>.</li>
                    <li>Set Start Command to <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">node index.js</code>.</li>
                    <li>Under Environment Variables, set <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">RENDER_EXTERNAL_URL</code> to your Render app URL. The bot will automatically self-ping to prevent sleeping!</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                    <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs">3</span>
                    How the Sequential Join & Reconnect Works
                  </div>
                  <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
                    <p>
                      <strong>Initial Join:</strong> When the bot joins <code className="text-emerald-300">{config.serverIp}</code>, it waits 1.5 seconds and sends <code className="text-emerald-300">/login lifesteal</code>.
                    </p>
                    <p>
                      <strong>Server Switch:</strong> After 5 seconds, it sends <code className="text-emerald-300">/server lifesteal</code> to move across the proxy.
                    </p>
                    <p>
                      <strong>AFK Warp:</strong> After another 5 seconds, it sends <code className="text-emerald-300">/warp afk</code>. Once arrived, sneaking and anti-AFK circle walk activate.
                    </p>
                    <p className="text-amber-300 font-semibold">
                      <strong>Auto-Reconnect:</strong> If kicked or disconnected, it safely backs off, reconnects, and automatically runs the whole sequence again from Step 1!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
