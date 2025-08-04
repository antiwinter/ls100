# LS100 Infrastructure

## Components

### redbird/
- **Proxy service** with dynamic route registration
- **Runs on PM2** as `redbird-proxy`
- **Listens on**: Port 9000 (HTTP), Port 6000 (API, internal only)

### deploy/
- **PM2 ecosystem** config for all processes
- **Unified deployment script** with environment configuration
- **Proxy client** for app registration

## Usage

### Initial Server Setup

1. **Create application user**:
   ```bash
   sudo useradd -r -s /bin/bash ls100
   sudo mkdir -p /home/ls100
   sudo chown ls100:ls100 /home/ls100
   ```

2. **Create directory structure**:
   ```bash
   sudo mkdir -p /home/ls100/{proxy,staging,production,backups/{staging,production},logs}
   sudo chown -R ls100:ls100 /home/ls100
   ```

3. **Install Node.js and PM2**:
   ```bash
   # Install Node.js via nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | sudo -u ls100 bash
   sudo -u ls100 bash -c "source ~/.nvm/nvm.sh && nvm install 18 && nvm use 18 && nvm alias default 18"
   
   # Install PM2 globally
   sudo -u ls100 bash -c "source ~/.nvm/nvm.sh && npm install -g pm2"
   ```

4. **Setup PM2 startup**:
   ```bash
   sudo -u ls100 bash -c "source ~/.nvm/nvm.sh && pm2 startup"
   # Follow the generated command output
   ```

5. **Deploy infrastructure**:
   ```bash
   # Copy infrastructure files
   sudo -u ls100 cp -r infra/redbird /home/ls100/proxy/
   sudo -u ls100 cp infra/deploy/ecosystem.config.js /home/ls100/proxy/
   
   # Install dependencies and start proxy
   cd /home/ls100/proxy/redbird
   sudo -u ls100 bash -c "source ~/.nvm/nvm.sh && yarn install --production"
   cd /home/ls100/proxy
   sudo -u ls100 bash -c "source ~/.nvm/nvm.sh && pm2 start ecosystem.config.js --only redbird-proxy"
   sudo -u ls100 bash -c "source ~/.nvm/nvm.sh && pm2 save"
   ```

### Deploy Staging (main branch)
Automatic via GitHub Actions on push to `main`

### Deploy Production (release tags)
Automatic via GitHub Actions on release publish

### GitHub Actions Setup
Required secrets in repository settings (Environment: `ls100`):
- `HOST`: Server IP or hostname
- `USERNAME`: `ls100` (the dedicated deployment user)
- `SSH_KEY`: Private SSH key content (complete key with headers)

### Manual Deployment
```bash
# Deploy to staging
./infra/deploy/deploy.sh staging

# Deploy to production  
./infra/deploy/deploy.sh production
```

### Manual Commands
```bash
# Check PM2 status
pm2 list

# View logs
pm2 logs redbird-proxy
pm2 logs ls100-staging
pm2 logs ls100-production

# Restart services
pm2 restart redbird-proxy
pm2 restart ls100-staging
```

## Environment Variables

Apps need these env vars for proxy registration:
- `DOMAIN` - Domain for routing (ls100.flj.icu or vm.flj.icu)
- `PORT` - App port (6666 for staging, 6667 for production)
- `PROXY_API` - Redbird API URL (http://localhost:6000, internal only)

## Ports

- **9000**: Redbird HTTP proxy
- **6000**: Redbird registration API (internal only)
- **6666**: LS100 staging
- **6667**: LS100 production