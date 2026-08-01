import { spawn } from "node:child_process";

const commands = [
  ["--env-file=.env.development", "--watch", "server/app.js"],
  ["--env-file=.env.development", "--watch", "server/worker.js"],
];
const children = commands.map((args) => spawn(process.execPath, args, { stdio: "inherit" }));
let stopping = false;

function stop(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill(signal);
  }
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

for (const child of children) {
  child.once("exit", (code) => {
    if (!stopping && code) {
      process.exitCode = code;
      stop("SIGTERM");
    }
  });
}
