module.exports = {
  apps: [
    // Staging Environment (main branch)
    {
      name: 'ls100-staging',
      script: './server/server.js',
      cwd: '/home/ls100/staging/current',
      env: {
        NODE_ENV: 'staging',
        PORT: 9666,
        DOMAIN: 'ls100.flj.icu',
        PROXY_API: 'http://localhost:6000'
      },
      max_memory_restart: '500M',
      error_file: '/home/ls100/logs/staging-error.log',
      out_file: '/home/ls100/logs/staging-out.log',
      log_file: '/home/ls100/logs/staging-combined.log'
    },
    
    // Production Environment (release tags)
    {
      name: 'ls100-production',
      script: './server/server.js',
      cwd: '/home/ls100/production/current',
      env: {
        NODE_ENV: 'production',
        PORT: 9667,
        DOMAIN: 'loci.flj.icu',
        PROXY_API: 'http://localhost:6000'
      },
      max_memory_restart: '500M',
      error_file: '/home/ls100/logs/production-error.log',
      out_file: '/home/ls100/logs/production-out.log',
      log_file: '/home/ls100/logs/production-combined.log'
    }
  ]
}