import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "../config.js";
import { assertProductionEnvironment } from "../production-config.js";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runTar(args) {
  const result = spawnSync("tar", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || "tar failed").trim().slice(0, 400));
}

try {
  assertProductionEnvironment();
  mkdirSync(config.uploads.dir, { recursive: true, mode: 0o700 });
  mkdirSync(config.backup.dir, { recursive: true, mode: 0o700 });
  const fileName = `clinova-uploads-${timestamp()}.tar.gz`;
  const target = join(config.backup.dir, fileName);
  runTar(["-czf", target, "-C", dirname(config.uploads.dir), basename(config.uploads.dir)]);
  runTar(["-tzf", target]);

  const archives = readdirSync(config.backup.dir)
    .filter((name) => name.startsWith("clinova-uploads-") && name.endsWith(".tar.gz"))
    .map((name) => ({ name, mtimeMs: statSync(join(config.backup.dir, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const archive of archives.slice(config.backup.retention)) {
    rmSync(join(config.backup.dir, archive.name), { force: true });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, archive: fileName, verified: true })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: String(error?.message || "Upload backup failed.").slice(0, 400) })}\n`);
  process.exitCode = 1;
}
