# BMT IIoT Middleware - Startup Guide

## Architecture Overview

```
Frontend React Wizard (localhost:5173)
        ↓
FastAPI Middleware (localhost:8081)
        ↓
SAP Service Layer (192.168.1.248:50000)
        ↓
SAP Business One
```

## Prerequisites

- Python 3.14+ (detected in venv: Python 3.14.5)
- Node.js 18+ (for React frontend)
- SAP Business One Service Layer (for production)

## Backend Startup (FastAPI Middleware)

### 1. Navigate to BMT-main directory
```bash
cd BMT-main
```

### 2. Activate virtual environment
```bash
# On Windows
.\venv\Scripts\activate

# On Linux/Mac
source venv/bin/activate
```

### 3. Install dependencies (if not already installed)
```bash
pip install -r requirements.txt
```

### 4. Configure environment variables
```bash
# Copy .env.example to .env
copy .env.example .env

# Edit .env with your SAP credentials
# SAP_HOST=192.168.1.248
# SAP_PORT=50000
# SAP_COMPANY=TEST_BMT
# SAP_USER=manager
# SAP_PASSWORD=S@PB1Admin
```

### 5. Start FastAPI server
```bash
# Development mode with hot reload
.\venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8081 --reload

# Or using Python
python -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload
```

### 6. Verify server is running
- Open browser: http://localhost:8081/docs
- Check health endpoint: http://localhost:8081/health
- Check API docs: http://localhost:8081/docs

## Frontend Startup (React Wizard)

### 1. Navigate to project root
```bash
cd "Nouveau dossier/project"
```

### 2. Install dependencies (if not already installed)
```bash
npm install
```

### 3. Start React development server
```bash
npm run dev
```

### 4. Access the application
- Open browser: http://localhost:5173
- The wizard will automatically connect to the backend at http://localhost:8081

## API Endpoints

### Events API
- `GET /events/pending` - Get all pending events for validation
- `PATCH /events/{event_id}/approve` - Approve an event and send to SAP
- `PATCH /events/{event_id}/reject` - Reject an event with reason

### Health Check
- `GET /health` - Check server and SAP session status

### API Documentation
- `GET /docs` - Interactive Swagger UI documentation
- `GET /openapi.json` - OpenAPI specification

## Troubleshooting

### Port Already in Use (Error 10048)
**Problem:** Port 8080 or 8081 is already in use

**Solution:**
```bash
# Find process using the port
netstat -ano | findstr :8081

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or use a different port
.\venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8082
```

### SAP Connection Failed
**Problem:** Cannot connect to SAP Service Layer

**Solution:**
- Check SAP server is running at configured IP:PORT
- Verify network connectivity to SAP server
- Check credentials in .env file
- For development, server will run in API-only mode with mock data

### Python Not Found
**Problem:** Python command not recognized

**Solution:**
```bash
# Use venv python directly
.\venv\Scripts\python.exe --version

# Or add venv to PATH
```

### CORS Errors in Frontend
**Problem:** Frontend cannot connect to backend

**Solution:**
- Ensure backend is running
- Check CORS configuration in main.py
- Verify frontend URL is in allowed_origins
- Check browser console for specific error

### Dependencies Not Installed
**Problem:** Module import errors

**Solution:**
```bash
# Backend
cd BMT-main
.\venv\Scripts\pip install -r requirements.txt

# Frontend
cd "Nouveau dossier/project"
npm install
```

### WebSocket Connection Failed
**Problem:** Real-time updates not working

**Solution:**
- Check WebSocket URL in src/services/api.ts
- Ensure backend server supports WebSocket
- Check firewall settings
- Verify WebSocket endpoint is accessible

## Development Mode vs Production

### Development Mode
- SAP connection is optional (server runs with mock data)
- Hot reload enabled
- CORS allows localhost:5173 and localhost:3000
- Debug logging enabled

### Production Mode
- SAP connection required
- No hot reload
- CORS configured for production domains
- Error logging only
- Environment variables from .env

## Environment Variables

### Backend (.env)
```
# SAP Business One Service Layer Configuration
SAP_HOST=192.168.1.248
SAP_PORT=50000
SAP_COMPANY=TEST_BMT
SAP_USER=manager
SAP_PASSWORD=S@PB1Admin

# Application Configuration
APP_ENV=development
LOG_LEVEL=INFO

# Retry Configuration
RETRY_MAX=5
RETRY_DELAY_SECONDS=3

# Anti-duplicate Configuration
DUPLICATE_WINDOW_SECONDS=30
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:8081
```

## Testing the Integration

### 1. Test Backend API
```bash
# Test health endpoint
curl http://localhost:8081/health

# Test pending events
curl http://localhost:8081/events/pending
```

### 2. Test Frontend Connection
1. Start backend server (port 8081)
2. Start frontend server (port 5173)
3. Open browser to http://localhost:5173
4. Navigate through wizard steps
5. Verify events load from backend
6. Test approve/reject functionality

### 3. Test WebSocket
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by WS (WebSocket)
4. Start backend server
5. Check for WebSocket connection
6. Trigger new events to test real-time updates

## Project Structure

```
project/
├── BMT-main/                    # FastAPI Backend
│   ├── api/
│   │   └── routes/
│   │       └── events.py       # Event validation API
│   ├── config/
│   │   ├── settings.py         # Configuration
│   │   └── logging_config.py   # Logging setup
│   ├── core/
│   │   └── event_router.py     # Event routing logic
│   ├── handlers/
│   │   ├── pince_pf.py         # Pince PF handler
│   │   └── sortie_wagon.py     # Sortie Wagon handler
│   ├── sap/
│   │   ├── session.py          # SAP session management
│   │   ├── udt_service.py      # UDT operations
│   │   └── models.py           # Data models
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt        # Python dependencies
│   └── .env.example            # Environment template
│
└── src/                        # React Frontend
    ├── components/
    │   └── SapValidationWizard.tsx  # Main wizard component
    ├── context/
    │   ├── AuthContext.tsx     # Authentication
    │   └── ThemeContext.tsx    # Theme management
    ├── lib/
    │   ├── fastapi.ts          # API service layer
    │   └── websocket.ts        # WebSocket service
    ├── services/
    │   └── api.ts              # Centralized API client
    └── App.tsx                # React app entry point
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in BMT-main/bmt_middleware.log
3. Check browser console for frontend errors
4. Verify backend logs in terminal
5. Test API endpoints using /docs Swagger UI
