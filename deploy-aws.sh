#!/bin/bash

# AWS EC2 Deployment Script for BuildVeritas Backend
# This script sets up the Node.js application on Amazon Linux 2

set -e

echo "🚀 Starting BuildVeritas Backend Deployment on AWS EC2..."

# Update system packages
sudo yum update -y

# Install Node.js 22.x
echo "📦 Installing Node.js 22.x..."
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# Install Git if not present
sudo yum install -y git

# Install PM2 globally for process management
sudo npm install -g pm2

# Install MongoDB (Amazon Linux 2)
echo "🗄️ Installing MongoDB..."
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo > /dev/null <<EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

sudo yum install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Create application directory
APP_DIR="/var/www/buildveritas-backend"
sudo mkdir -p $APP_DIR
sudo chown ec2-user:ec2-user $APP_DIR

# Clone repository from your GitHub
cd /var/www
if [ -d "buildveritas-backend" ]; then
    echo "📁 Updating existing repository..."
    cd buildveritas-backend
    git pull origin main
else
    echo "📁 Cloning repository..."
    git clone https://github.com/techsavvyanuj/BUILDVERIbackend.git buildveritas-backend
    cd buildveritas-backend
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm ci --production

# Create .env file from template
if [ ! -f .env ]; then
    echo "⚙️ Creating environment configuration..."
    cp .env.example .env
    
    # Update .env with production values
    sed -i 's/NODE_ENV=development/NODE_ENV=production/' .env
    sed -i 's/PORT=5000/PORT=5000/' .env
    sed -i 's|MONGODB_URI=mongodb://localhost:27017/buildveritas|MONGODB_URI=mongodb://localhost:27017/buildveritas_prod|' .env
    sed -i 's|CORS_ORIGIN=http://localhost:3000|CORS_ORIGIN=*|' .env
    
    echo "⚠️  Please update the following in /var/www/buildveritas-backend/.env:"
    echo "   - JWT_SECRET (use a strong, random secret)"
    echo "   - OPENROUTER_API_KEY (if using AI services)"
    echo "   - CORS_ORIGIN (set to your frontend domain)"
fi

# Set up PM2 ecosystem
if [ ! -f ecosystem.config.js ]; then
    echo "⚙️ Creating PM2 ecosystem configuration..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'buildveritas-backend',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
fi

# Create logs directory
mkdir -p logs

# Start application with PM2
echo "🚀 Starting application..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ec2-user --hp /home/ec2-user

# Configure firewall (if using firewalld)
sudo yum install -y firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload

# Install and configure Nginx as reverse proxy
echo "🌐 Installing Nginx..."
sudo amazon-linux-extras install nginx1 -y

# Create Nginx configuration
sudo tee /etc/nginx/conf.d/buildveritas.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Update environment variables in: /var/www/buildveritas-backend/.env"
echo "2. Your API is running at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/"
echo "3. Swagger docs available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/api-docs"
echo "4. Check application status: pm2 status"
echo "5. View logs: pm2 logs buildveritas-backend"
echo ""
echo "🔧 Useful PM2 Commands:"
echo "   pm2 restart buildveritas-backend  # Restart app"
echo "   pm2 stop buildveritas-backend     # Stop app"
echo "   pm2 logs buildveritas-backend     # View logs"
echo "   pm2 monit                         # Monitor resources"