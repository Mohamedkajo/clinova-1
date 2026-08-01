module.exports = {
  apps: [
    {
      name: "clinova",
      script: "server/app.js",
      cwd: __dirname,
      instances: process.env.DATABASE_URL ? (process.env.WEB_CONCURRENCY || 2) : 1,
      exec_mode: process.env.DATABASE_URL ? "cluster" : "fork",
      watch: false,
      wait_ready: false,
      listen_timeout: 8000,
      kill_timeout: 5000,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production"
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
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
      kill_timeout: 10000,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production"
      },
      error_file: "./logs/pm2-worker-error.log",
      out_file: "./logs/pm2-worker-out.log",
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
      max_memory_restart: "150M",
      env: {
        NODE_ENV: "production"
      },
      error_file: "./logs/pm2-backup-error.log",
      out_file: "./logs/pm2-backup-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
