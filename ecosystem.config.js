module.exports = {
  apps: [
    {
      name: 'detailer-web-prod',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 7001,
        MONGO_URI: 'mongodb://localhost:27017/otsuka_prod'
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
        PORT: 7000,
        MONGO_URI: 'mongodb://localhost:27017/otsuka_dev'
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
        CONVERSION_CRON_URL: 'http://localhost:7001/api/conversion/worker',
        CONVERSION_CRON_SECRET: 'c0470b6a5069cb73e61e27bb0c00e7d2877aaef809ba66b064a13e2ce5dd26d1caae6f840f807a8b757f45355799cf15bfd30315872e7bd7ce74a60b44569e2f',
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
