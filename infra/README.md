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
   sudo -u ls100 bash -c "source ~/.nvm/nvm.sh && nvm install 22 && nvm use 22 && nvm alias default 22"
   
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
   sudo -u ls100 mkdir -p /home/ls100/infra/deploy
   sudo -u ls100 cp infra/deploy/ecosystem.config.js /home/ls100/infra/deploy/
   
   # Note: Redbird proxy setup is handled separately
   # Ecosystem config only manages LS100 app deployments
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
node infra/deploy/deploy.js staging

# Deploy to production  
node infra/deploy/deploy.js production
```

### Manual Commands
```bash
# Check PM2 status
pm2 list

# View logs
pm2 logs ls100-staging
pm2 logs ls100-production

# Restart services  
pm2 restart ls100-staging
pm2 restart ls100-production
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

## Deployment Progress Log

### Current Status (Aug 2025)

**Working Setup:**
- ✅ **Backend Server**: `http://x.x.x.x:9666` (direct IP access)
- ✅ **Vercel Frontend**: Deployed and accessible via `vercel.app` domain
- ✅ **Local Development**: Full-stack working on `localhost`

**Current Limitations:**

1. **Domain Access Requires ICP Filing**
   - `ls100.flj.icu:9666` returns `403 Forbidden`
   - Domain-based access blocked without proper registration
   - Affects both HTTP and HTTPS access through domain

2. **Redbird Proxy Dependency on Domain Access**
   - Redbird proxy designed for domain-based routing
   - Cannot function properly without domain access
   - Current proxy setup ineffective

3. **Vercel Frontend HTTPS Requirement**
   - Vercel frontend works perfectly
   - External API calls require HTTPS for security
   - HTTPS certificates need valid domain names (not IP addresses)
   - Mixed content (HTTPS frontend → HTTP backend) blocked by browsers

4. **IP-Only Access Limitation**
   - Only `http://x.x.x.x:9666` currently accessible
   - No SSL/HTTPS support for IP addresses (expensive and problematic)
   - Users see security warnings with IP-based HTTPS

### Next Steps: Cloud Migration

**Planned Solution:**
- 🎯 **Migrate to External Cloud Provider** (AWS/DigitalOcean/Linode)
- 🌐 **Enable Domain-Based Access** without ICP restrictions
- 🔒 **Implement HTTPS** with Let's Encrypt free certificates
- 🚀 **Full Frontend-Backend Integration** on Vercel with secure API calls

**Benefits:**
- Clean domain access: `https://api.yourapp.com`
- Secure HTTPS communication
- Proper Redbird proxy functionality
- Professional deployment setup