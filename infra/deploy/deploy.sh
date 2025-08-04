#!/bin/bash

# LS100 Universal Deployment Script
set -e

# Check if environment argument is provided
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <environment>"
    echo "Available environments: staging, production"
    exit 1
fi

ENVIRONMENT="$1"
CONFIG_FILE="$(dirname "$0")/environments.json"

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "❌ jq is required but not installed. Please install jq first."
    exit 1
fi

# Load environment configuration
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Environment config not found: $CONFIG_FILE"
    exit 1
fi

# Extract configuration values
ENV_NAME=$(jq -r ".$ENVIRONMENT.name" "$CONFIG_FILE")
APP_NAME=$(jq -r ".$ENVIRONMENT.appName" "$CONFIG_FILE")
DOMAIN=$(jq -r ".$ENVIRONMENT.domain" "$CONFIG_FILE")
PORT=$(jq -r ".$ENVIRONMENT.port" "$CONFIG_FILE")
BACKUP_RETENTION=$(jq -r ".$ENVIRONMENT.backupRetention" "$CONFIG_FILE")
RUN_MIGRATIONS=$(jq -r ".$ENVIRONMENT.runMigrations" "$CONFIG_FILE")
VERIFY_DELAY=$(jq -r ".$ENVIRONMENT.verifyDelay" "$CONFIG_FILE")

# Validate environment exists
if [ "$ENV_NAME" = "null" ]; then
    echo "❌ Environment '$ENVIRONMENT' not found in config"
    echo "Available environments: $(jq -r 'keys[]' "$CONFIG_FILE" | tr '\n' ' ')"
    exit 1
fi

# Set up paths
ROOT="/home/ls100"
ENV_DIR="$ROOT/$ENV_NAME"
BACKUP_DIR="$ROOT/backups/$ENV_NAME"
LOGS_DIR="$ROOT/logs"

echo "🚀 Deploying LS100 $ENV_NAME..."
echo "📋 Config: $APP_NAME → $DOMAIN:$PORT"

# Create directories
mkdir -p "$ENV_DIR" "$BACKUP_DIR" "$LOGS_DIR"

# Backup current deployment
if [ -d "$ENV_DIR/current" ]; then
    echo "📦 Creating backup..."
    BACKUP_NAME="$ENV_NAME-$(date +%Y%m%d-%H%M%S)"
    cp -r "$ENV_DIR/current" "$BACKUP_DIR/$BACKUP_NAME"
    
    # Keep only specified number of backups
    RETENTION_PLUS_ONE=$((BACKUP_RETENTION + 1))
    cd "$BACKUP_DIR" && ls -t | tail -n +$RETENTION_PLUS_ONE | xargs rm -rf
fi

# Extract new deployment
echo "📂 Extracting deployment..."
rm -rf "$ENV_DIR/staging"
mkdir -p "$ENV_DIR/staging"
tar -xzf /tmp/ls100-deploy/deployment.tar.gz -C "$ENV_DIR/staging"

# Install dependencies
echo "📥 Installing dependencies..."
cd "$ENV_DIR/staging"
yarn install --production --frozen-lockfile

# Run migrations for production
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "🗄️  Running migrations..."
    cd "$ENV_DIR/staging/server"
    node -e "
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = 'data/database.sqlite';
const db = new Database(dbPath);

const moduleDirs = ['modules/auth', 'modules/shard', 'modules/subtitle', 'shards/subtitle'];

for (const moduleDir of moduleDirs) {
  const migrationPath = path.join(moduleDir, 'migration.sql');
  if (fs.existsSync(migrationPath)) {
    console.log(\`Running migration: \${migrationPath}\`);
    const migration = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migration);
  }
}

db.close();
console.log('Migrations completed');
"
fi

# Switch to new deployment
echo "🔄 Switching deployment..."
rm -rf "$ENV_DIR/previous"
if [ -d "$ENV_DIR/current" ]; then
    mv "$ENV_DIR/current" "$ENV_DIR/previous"
fi
mv "$ENV_DIR/staging" "$ENV_DIR/current"

# Restart app with PM2
echo "🔄 Restarting $APP_NAME..."
pm2 reload "$APP_NAME" || pm2 start /home/ls100/infra/deploy/ecosystem.config.js --only "$APP_NAME"

# Verify deployment
sleep "$VERIFY_DELAY"
if pm2 describe "$APP_NAME" | grep -q "online"; then
    echo "✅ $ENV_NAME deployment successful!"
else
    echo "❌ $ENV_NAME deployment failed!"
    exit 1
fi

echo "🎉 $ENV_NAME deployment completed!"
echo "🔗 Available at: http://$DOMAIN:9000"