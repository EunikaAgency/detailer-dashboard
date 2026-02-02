module.exports = {
  apps: [
    {
      name: 'detailer-web-prod',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 6060
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/prod-err.log',
      out_file: './logs/prod-out.log',
      log_file: './logs/prod-combined.log',
      time: true
    },
    {
      name: 'detailer-web-dev',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 6060
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/dev-err.log',
      out_file: './logs/dev-out.log',
      log_file: './logs/dev-combined.log',
      time: true
    },
    {
      name: 'detailer-conversion-cron',
      script: 'node',
      args: 'scripts/conversion-cron.js',
      env: {
        NODE_ENV: 'production',
        CONVERSION_CRON_URL: 'http://localhost:6060/api/conversion/worker',
        CONVERSION_CRON_SECRET: 'conversion-cron-secret-20260202',
        CONVERSION_CRON_INTERVAL_MS: '60000'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      error_file: './logs/cron-err.log',
      out_file: './logs/cron-out.log',
      log_file: './logs/cron-combined.log',
      time: true
    }
  ]
};
