# LS100 - Full Stack React App

A simple full-stack application with React frontend and Express.js backend.

## Project Structure

```
ls100/
├── client/          # React frontend (Vite)
├── server/          # Express.js backend
├── package.json     # Root workspace configuration
└── README.md
```

## Development Mode

```bash
yarn dev
```
- Frontend: `http://localhost:5173` (Vite dev server with hot reload)
- Backend: `http://localhost:3001` (Express server with nodemon)
- CORS enabled for cross-origin requests
- **File watching enabled** for both frontend and backend

## Production Mode

```bash
yarn start
```
- Auto-builds React app first
- Everything runs on `http://localhost:3001` (or $PORT)
- Frontend served as static assets from backend
- No CORS needed (same origin)
- **No file watching** - optimized for production

## Tech Stack

- **Frontend**: React + Vite + JavaScript (ESM)
- **Backend**: Express.js + Node.js 
- **Package Manager**: Yarn
- **Development**: Hot reload + live restart
- **Production**: Single-port deployment

## API Endpoints

- `GET /api/hello` - Returns greeting message with timestamp and environment
- `GET /api/status` - Returns server status and environment

## Features

- ✅ Full-stack React + Express setup
- ✅ Backend API integration  
- ✅ Modern glassmorphism UI design
- ✅ Development hot reload (frontend + backend)
- ✅ Production auto-build and single-port deployment
- ✅ Environment-aware API calls
- ✅ SPA routing support
- ✅ ESM modules throughout 