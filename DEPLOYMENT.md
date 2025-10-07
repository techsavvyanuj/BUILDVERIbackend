# BuildVeritas Backend - AWS EC2 Deployment Guide

This guide will help you deploy the BuildVeritas Backend to AWS EC2 free tier.

## Prerequisites

1. AWS Account with EC2 access
2. GitHub account
3. Basic knowledge of AWS EC2 and SSH

## Step 1: Set Up AWS EC2 Instance

### 1.1 Launch EC2 Instance
1. Log into AWS Console and navigate to EC2
2. Click "Launch Instance"
3. Choose **Amazon Linux 2 AMI (HVM) - SSD Volume Type** (Free Tier Eligible)
4. Select **t2.micro** instance type (Free Tier Eligible)
5. Configure Security Group:
   - SSH (22) - Your IP
   - HTTP (80) - Anywhere (0.0.0.0/0)
   - Custom TCP (5000) - Anywhere (0.0.0.0/0) [for development]
6. Create or select a Key Pair
7. Launch the instance

### 1.2 Connect to Your Instance
```bash
chmod 400 your-key.pem
ssh -i "your-key.pem" ec2-user@your-ec2-public-ip
```

## Step 2: Set Up GitHub Repository

### 2.1 Initialize Git Repository (Local)
```bash
cd /Users/anujmishra/Downloads/BUILDVERIbackend
git init
git add .
git commit -m "Initial commit: BuildVeritas Backend"
```

### 2.2 Create GitHub Repository
1. Go to GitHub and create a new repository named `buildveritas-backend`
2. Don't initialize with README, .gitignore, or license (we already have them)

### 2.3 Push to GitHub
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/buildveritas-backend.git
git push -u origin main
```

## Step 3: Deploy to EC2

### 3.1 Upload Deployment Script
Copy the deployment script to your EC2 instance:
```bash
scp -i "your-key.pem" deploy-aws.sh ec2-user@your-ec2-public-ip:~/
```

### 3.2 Run Deployment Script
SSH into your EC2 instance and run:
```bash
chmod +x deploy-aws.sh
./deploy-aws.sh
```

### 3.3 Update Environment Variables
After deployment, update the environment file:
```bash
sudo nano /var/www/buildveritas-backend/.env
```

Update these critical values:
- `JWT_SECRET=your_super_secret_jwt_key_here`
- `OPENROUTER_API_KEY=your_openrouter_api_key_here`
- `CORS_ORIGIN=https://yourdomain.com` (or your frontend URL)

### 3.4 Restart Application
```bash
cd /var/www/buildveritas-backend
pm2 restart buildveritas-backend
```

## Step 4: Verify Deployment

1. **Check Application Status:**
   ```bash
   pm2 status
   pm2 logs buildveritas-backend
   ```

2. **Test API Endpoints:**
   ```bash
   curl http://your-ec2-public-ip/
   curl http://your-ec2-public-ip/api-docs
   ```

3. **Access Swagger Documentation:**
   Open `http://your-ec2-public-ip/api-docs` in your browser

## Step 5: Set Up Continuous Deployment (Optional)

### 5.1 Create Deploy Script for Updates
```bash
#!/bin/bash
cd /var/www/buildveritas-backend
git pull origin main
npm ci --production
pm2 restart buildveritas-backend
pm2 save
```

### 5.2 Set Up GitHub Actions (Optional)
Create `.github/workflows/deploy.yml` for automatic deployment on push.

## Security Best Practices

1. **Environment Variables:** Never commit sensitive data to Git
2. **Firewall:** Restrict SSH access to your IP only
3. **SSL Certificate:** Set up HTTPS with Let's Encrypt (free)
4. **MongoDB Security:** Enable authentication in production
5. **Regular Updates:** Keep system packages updated

## Monitoring and Maintenance

### PM2 Commands
- `pm2 status` - Check application status
- `pm2 logs buildveritas-backend` - View application logs
- `pm2 restart buildveritas-backend` - Restart application
- `pm2 stop buildveritas-backend` - Stop application
- `pm2 monit` - Real-time monitoring

### System Monitoring
- `htop` - System resource usage
- `df -h` - Disk usage
- `free -m` - Memory usage

## Troubleshooting

### Common Issues

1. **Port Already in Use:**
   ```bash
   pm2 stop all
   pm2 start ecosystem.config.js
   ```

2. **MongoDB Connection Issues:**
   ```bash
   sudo systemctl status mongod
   sudo systemctl restart mongod
   ```

3. **Nginx Issues:**
   ```bash
   sudo systemctl status nginx
   sudo nginx -t  # Test configuration
   sudo systemctl restart nginx
   ```

4. **Permission Issues:**
   ```bash
   sudo chown -R ec2-user:ec2-user /var/www/buildveritas-backend
   ```

### Log Locations
- Application logs: `/var/www/buildveritas-backend/logs/`
- Nginx logs: `/var/log/nginx/`
- MongoDB logs: `/var/log/mongodb/mongod.log`

## Cost Optimization (Free Tier)

- **Instance:** t2.micro (750 hours/month free)
- **Storage:** 30GB EBS (free tier)
- **Data Transfer:** 15GB outbound (free tier)
- **Monitoring:** CloudWatch basic monitoring (free)

## Next Steps

1. Set up domain name and SSL certificate
2. Configure MongoDB authentication
3. Set up automated backups
4. Implement logging and monitoring
5. Set up CI/CD pipeline
6. Configure load balancing (when scaling)

## Support

If you encounter issues:
1. Check the logs: `pm2 logs buildveritas-backend`
2. Verify environment variables
3. Check MongoDB connection
4. Ensure all services are running
5. Review security group settings

---

**Your API will be available at:** `http://your-ec2-public-ip/`
**Swagger Documentation:** `http://your-ec2-public-ip/api-docs`