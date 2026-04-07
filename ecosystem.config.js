// PM2 ecosystem config — use: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "campaignflow-pro",
      script: "npm",
      args: "run dev",
      cwd: __dirname,
      node_args: "--max-old-space-size=1536",
      env: {
        NODE_ENV: "development",
      },
      // Restart if process exceeds 1.8 GB RSS (safety net on top of heap limit)
      max_memory_restart: "1800M",
      // Restart delay after a crash — prevents rapid crash loops
      restart_delay: 3000,
      // Keep stdout/stderr in separate logs
      merge_logs: false,
      // Disable watch mode (next dev handles HMR itself)
      watch: false,
      autorestart: true,
    },
  ],
};
