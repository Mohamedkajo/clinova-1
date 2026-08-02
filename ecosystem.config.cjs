const path = require("node:path");

const logDir = path.resolve(process.env.LOG_DIR || "./logs");

module.exports = {
  apps: [
    {
      name: "clinova",
      script: "server/app.js",
      cwd: __dirname,
      instances: process.env.DATABASE_URL ? (process.env.WEB_CONCURRENCY || 2) : 1,
      exec_mode: process.env.DATABASE_URL ? "cluster" : "fork",
      watch: false,
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 10000,
      min_uptime: "10s",
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production"
      },
      error_file: path.join(logDir, "pm2-web-error.log"),
      out_file: path.join(logDir, "pm2-web-out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "clinova-worker",
      script: "server/worker.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 10000,
      min_uptime: "10s",
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production"
      },
      error_file: path.join(logDir, "pm2-worker-error.log"),
      out_file: path.join(logDir, "pm2-worker-out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "clinova-backup",
      script: "server/backup-scheduler.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 10000,
      min_uptime: "10s",
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "150M",
      env: {
        NODE_ENV: "production"
      },
      error_file: path.join(logDir, "pm2-backup-error.log"),
      out_file: path.join(logDir, "pm2-backup-out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
