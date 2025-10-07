# 🚀 AWS EC2 Deployment Checklist

Follow this checklist to deploy your BuildVeritas Backend to AWS EC2 free tier.

## ✅ Pre-Deployment Steps

### 1. GitHub Repository Setup
- [ ] Create GitHub repository named `buildveritas-backend`
- [ ] Push your code: `git remote add origin https://github.com/YOUR_USERNAME/buildveritas-backend.git`
- [ ] Push to main: `git push -u origin main`

### 2. AWS Account Setup
- [ ] Create AWS account (if you don't have one)
- [ ] Access EC2 Dashboard
- [ ] Create/download Key Pair (.pem file)

## 🖥️ EC2 Instance Setup

### 3. Launch EC2 Instance
- [ ] Choose **Amazon Linux 2 AMI** (Free Tier)
- [ ] Select **t2.micro** instance type
- [ ] Configure Security Group:
  - [ ] SSH (22) - Your IP only
  - [ ] HTTP (80) - Anywhere (0.0.0.0/0)
  - [ ] Custom TCP (5000) - Anywhere (0.0.0.0/0)
- [ ] Select/create Key Pair
- [ ] Launch instance
- [ ] Note your **Public IP address**

### 4. Connect to Instance
```bash
chmod 400 your-key.pem
ssh -i "your-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP
```

## 🔧 Deployment Steps

### 5. Upload Deployment Script
From your local machine:
```bash
scp -i "your-key.pem" deploy-aws.sh ec2-user@YOUR_EC2_PUBLIC_IP:~/
```

### 6. Run Deployment
On EC2 instance:
```bash
chmod +x deploy-aws.sh
./deploy-aws.sh
```

### 7. Update Environment Variables
```bash
sudo nano /var/www/buildveritas-backend/.env
```

**Critical Updates:**
- [ ] `JWT_SECRET=your_super_secret_key_here`
- [ ] `OPENROUTER_API_KEY=your_api_key_here`
- [ ] `CORS_ORIGIN=https://yourdomain.com`
- [ ] Update MongoDB URI if needed

### 8. Restart Application
```bash
cd /var/www/buildveritas-backend
pm2 restart buildveritas-backend
```

## ✅ Post-Deployment Verification

### 9. Test Your API
- [ ] Check status: `pm2 status`
- [ ] View logs: `pm2 logs buildveritas-backend`
- [ ] Test API: `curl http://YOUR_EC2_PUBLIC_IP/`
- [ ] Check Swagger: `http://YOUR_EC2_PUBLIC_IP/api-docs`

### 10. Verify Services
- [ ] MongoDB: `sudo systemctl status mongod`
- [ ] Nginx: `sudo systemctl status nginx`
- [ ] Application: `pm2 list`

## 🔒 Security & Production Setup

### 11. Secure Your Instance
- [ ] Change default passwords
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Configure MongoDB authentication
- [ ] Update security groups (remove port 5000 public access)
- [ ] Set up CloudWatch monitoring

### 12. Domain Setup (Optional)
- [ ] Configure Route 53 DNS
- [ ] Point domain to EC2 IP
- [ ] Update CORS_ORIGIN in .env
- [ ] Set up SSL certificate

## 🔄 Continuous Deployment (Optional)

### 13. GitHub Actions Setup
Add these secrets to your GitHub repository:
- [ ] `EC2_HOST` - Your EC2 public IP
- [ ] `EC2_USERNAME` - `ec2-user`
- [ ] `EC2_PRIVATE_KEY` - Content of your .pem file

## 📊 Monitoring Commands

### Useful PM2 Commands
```bash
pm2 status                    # Application status
pm2 logs buildveritas-backend # View logs
pm2 restart buildveritas-backend # Restart app
pm2 stop buildveritas-backend # Stop app
pm2 monit                     # Real-time monitoring
```

### System Monitoring
```bash
htop          # System resources
df -h         # Disk usage
free -m       # Memory usage
curl http://localhost:5000/health  # Health check
```

## 🚨 Troubleshooting

### Common Issues
- **Port in use**: `pm2 restart all`
- **MongoDB not running**: `sudo systemctl restart mongod`
- **Nginx issues**: `sudo systemctl restart nginx`
- **Permission errors**: `sudo chown -R ec2-user:ec2-user /var/www/buildveritas-backend`

### Log Locations
- App logs: `/var/www/buildveritas-backend/logs/`
- Nginx: `/var/log/nginx/`
- MongoDB: `/var/log/mongodb/mongod.log`

## ✅ Final Checklist

- [ ] API accessible at `http://YOUR_EC2_PUBLIC_IP/`
- [ ] Swagger docs at `http://YOUR_EC2_PUBLIC_IP/api-docs`
- [ ] All environment variables configured
- [ ] MongoDB running and accessible
- [ ] PM2 process manager working
- [ ] Nginx reverse proxy configured
- [ ] Application logs are being written
- [ ] No errors in PM2 logs

## 🎉 Success!

Your BuildVeritas Backend is now deployed on AWS EC2!

**API URL:** `http://YOUR_EC2_PUBLIC_IP/`
**Swagger Docs:** `http://YOUR_EC2_PUBLIC_IP/api-docs`

## 📞 Next Steps

1. Set up a domain name
2. Configure SSL certificate
3. Set up MongoDB authentication
4. Implement automated backups
5. Set up monitoring and alerts
6. Scale as needed

---

**Remember:** Replace `YOUR_EC2_PUBLIC_IP` with your actual EC2 instance public IP address!