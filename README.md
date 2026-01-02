# Polywerk Dashboard

Business management system for Polywerk OÜ 3D printing operations.

## Features

- 🖨️ **Printer Fleet Management** - Real-time monitoring of Creality K1 and Bambu Lab printers
- 💼 **Business Operations** - Orders, quotes, clients, invoicing
- 📦 **Inventory** - Material spools tracking with drying reminders
- 📊 **Analytics** - Cost tracking, energy savings, carbon footprint
- 🤖 **AI Features** - Image-to-3D generation, dataset management (owner only)
- 💬 **Team Chat** - Real-time communication
- 🔐 **Role-Based Access** - Owner, Partner, Worker permissions

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start dev server (connects to http://localhost:5000)
npm start
```

Dashboard: http://localhost:3000

### Production Build

```bash
# Create production build
npm run build

# Build output goes to ./build folder
```

## Environment Configuration

### Development (.env)
```env
REACT_APP_SERVER_ROOT=http://localhost:5000
REACT_APP_API_BASE=http://localhost:5000/api/v1
REACT_APP_WS_URL=ws://127.0.0.1:5000/ws
```

### Production (.env.production)
```env
REACT_APP_SERVER_ROOT=https://api.polywerk.ee
REACT_APP_API_BASE=https://api.polywerk.ee/api/v1
REACT_APP_WS_URL=wss://api.polywerk.ee/ws
```

## Pre-Launch Checklist

### Backend Verification
```bash
# Run from printer-dashboard folder
python scripts/verify_launch.py --backend http://localhost:5000
```

### Frontend Verification
1. ✅ Login works with valid credentials
2. ✅ WebSocket shows "● LIVE" status in Printers tab
3. ✅ Role permissions work (owner sees AI tab, worker doesn't)
4. ✅ Orders can be created and updated
5. ✅ Team chat sends/receives messages

## Deployment Options

### Option 1: Static Files (Recommended for subdomain)
```bash
npm run build
# Upload ./build folder to your web server
# Configure nginx/apache to serve index.html for all routes
```

### Option 2: Serve from Flask Backend
```bash
npm run build
# Copy build/* to api/static/dashboard/
# Access at http://yourserver:5000/dashboard
```

## User Roles

| Permission | Owner | Partner | Worker |
|------------|-------|---------|--------|
| Business (orders, clients) | ✅ | ✅ | ✅ |
| Printers | ✅ | ✅ | ✅ |
| Production | ✅ | ✅ | ✅ |
| Inventory | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ |
| AI Features | ✅ | ❌ | ❌ |
| Marketing | ✅ | ✅ | ❌ |
| Config | ✅ | ✅ | ❌ |

## Tech Stack

- React 18.2.0
- Tailwind CSS 3.4
- Chart.js 4.4
- Socket.io Client 4.8
- Three.js / React Three Fiber

## Support

Contact: info@polywerk.ee
