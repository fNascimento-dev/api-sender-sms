module.exports = {
  apps: [
    {
      name: 'imperial_topaz',
      script: './src/server.js',
      exec_mode: 'cluster_mode',
      instances: 1, // 'max',
      autorestart: true,
      watch: true,
      ignore_watch: ['logs','node_modules'],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }

    }
  ]
}
