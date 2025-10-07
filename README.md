# BuildVeritas Backend API

A comprehensive backend API for the BuildVeritas construction management platform, built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Authentication & Authorization** - JWT-based auth with role management
- **Project Management** - Complete project lifecycle management
- **Bidding System** - Vendor bidding and proposal management
- **Budget Estimation** - AI-powered cost estimation
- **Profile Management** - Client and vendor profile system
- **API Documentation** - Swagger/OpenAPI documentation
- **Security** - Rate limiting, CORS, helmet security headers
- **Cloud Ready** - AWS EC2 deployment ready

## 🛠️ Tech Stack

- **Runtime**: Node.js 22.x
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcryptjs
- **Documentation**: Swagger UI
- **Process Management**: PM2
- **Security**: Helmet, express-rate-limit, CORS
- **AI Integration**: OpenRouter API

## 📋 Prerequisites

- Node.js 22.x or higher
- MongoDB 7.0 or higher
- npm or yarn package manager

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/buildveritas-backend.git
   cd buildveritas-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

5. **Run the application**
   ```bash
   # Development mode with hot reload
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - API: http://localhost:5000
   - Swagger Docs: http://localhost:5000/api-docs

### AWS EC2 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed AWS EC2 deployment instructions.

## 📁 Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── models/         # MongoDB models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utility functions
└── docs/           # API documentation
```

## 🔧 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment (development/production) | No | development |
| `PORT` | Server port | No | 5000 |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `JWT_EXPIRES_IN` | JWT expiration time | No | 7d |
| `OPENROUTER_API_KEY` | AI service API key | No | - |
| `CORS_ORIGIN` | CORS allowed origins | No | * |

## 📚 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile

### Projects
- `GET /projects` - List all projects
- `POST /projects` - Create new project
- `GET /projects/:id` - Get project details
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

### Bids
- `GET /bids` - List bids
- `POST /bids` - Submit bid
- `GET /bids/:id` - Get bid details

### Budget Estimation
- `POST /budget-estimate` - Generate cost estimate
- `GET /budget-estimate/:id` - Get estimate details

For complete API documentation, visit `/api-docs` when the server is running.

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Rate Limiting** - Protection against brute force attacks
- **CORS Configuration** - Cross-origin resource sharing control
- **Security Headers** - Helmet.js security headers
- **Input Validation** - Joi schema validation
- **Error Handling** - Centralized error management

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run with coverage
npm run test:coverage
```

## 📊 Monitoring

### PM2 Commands (Production)
```bash
pm2 status                    # Check status
pm2 logs buildveritas-backend # View logs
pm2 restart buildveritas-backend # Restart app
pm2 monit                     # Real-time monitoring
```

### Health Check
```bash
curl http://localhost:5000/health
```

## 🚀 Deployment

### AWS EC2 (Recommended)
1. Follow the [deployment guide](./DEPLOYMENT.md)
2. Run the deployment script: `./deploy-aws.sh`
3. Configure environment variables
4. Access your API at `http://your-ec2-ip/`

### Other Platforms
- **Vercel**: Configured with `vercel.json`
- **Docker**: Dockerfile available
- **Heroku**: Add Procfile for Heroku deployment

## 🔄 CI/CD

GitHub Actions workflow is configured for automatic deployment:
- Triggers on push to `main` branch
- Runs tests (when implemented)
- Deploys to EC2 instance

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

If you encounter any issues:

1. Check the [deployment guide](./DEPLOYMENT.md)
2. Review the logs: `pm2 logs buildveritas-backend`
3. Verify environment variables
4. Check MongoDB connection
5. Open an issue on GitHub

## 🔗 Links

- [API Documentation](http://localhost:5000/api-docs)
- [Deployment Guide](./DEPLOYMENT.md)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Express.js Documentation](https://expressjs.com/)

---

Built with ❤️ for the construction industry