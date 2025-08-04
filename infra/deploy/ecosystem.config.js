export default {
  apps: [
    // Redbird Proxy
    {
      name: 'redbird-proxy',
      script: '../redbird/proxy.js',
      cwd: '/home/ls100/proxy',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '200M',
      error_file: '/home/ls100/logs/redbird-error.log',
      out_file: '/home/ls100/logs/redbird-out.log',
      log_file: '/home/ls100/logs/redbird-combined.log'
    },
    
    // Staging Environment (main branch)
    {
      name: 'ls100-staging',
      script: './server/server.js',
      cwd: '/home/ls100/staging',
      env: {
        NODE_ENV: 'staging',
        PORT: 6666,
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
      cwd: '/home/ls100/production',
      env: {
        NODE_ENV: 'production',
        PORT: 6667,
        DOMAIN: 'vm.flj.icu',
        PROXY_API: 'http://localhost:6000'
      },
      max_memory_restart: '500M',
      error_file: '/home/ls100/logs/production-error.log',
      out_file: '/home/ls100/logs/production-out.log',
      log_file: '/home/ls100/logs/production-combined.log'
    }
  ]
}