import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const serverRoot = path.join(projectRoot, "server");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const children = [];
let shuttingDown = false;

function prefixOutput(prefix, colorCode, stream, target) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      target.write(`\x1b[${colorCode}m[${prefix}]\x1b[0m ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer.trim()) {
      target.write(`\x1b[${colorCode}m[${prefix}]\x1b[0m ${buffer}\n`);
    }
  });
}

function spawnProcess(name, cwd, args, colorCode) {
  const child = spawn(npmCommand, args, {
    cwd,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  prefixOutput(name, colorCode, child.stdout, process.stdout);
  prefixOutput(name, colorCode, child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[launcher] ${name} exited with ${reason}. Shutting down the other process.`);
    shutdown(typeof code === "number" ? code : 1);
  });

  children.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[launcher] Starting ChongzhenSim frontend and server...");
console.log("[launcher] Frontend: http://localhost:5173");
console.log("[launcher] Server:   http://localhost:3002");

spawnProcess("server", serverRoot, ["run", "start"], "33");
spawnProcess("frontend", projectRoot, ["run", "dev", "--", "--host", "0.0.0.0"], "36");