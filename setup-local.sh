#!/bin/bash
# Quick Setup Script for Google OAuth Testing
# Run this to set up local development environment

set -e

echo "=========================================="
echo "MedTech - Google OAuth Local Setup"
echo "=========================================="

# Get Google Client ID
read -p "Enter your GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID

# Setup Backend
echo ""
echo "[1/4] Setting up backend..."
cd healthconnect-backend
export GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
pip install -r requirements.txt --quiet
echo "✓ Backend ready"

# Setup Frontend
echo ""
echo "[2/4] Setting up frontend..."
cd ../healthconnect-frontend
npm install --silent
echo "✓ Frontend ready"

# Run tests
echo ""
echo "[3/4] Running authentication tests..."
cd ../healthconnect-backend
export GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
python test_auth.py > /dev/null 2>&1 && echo "✓ Auth tests passed" || echo "⚠️  Some auth tests failed"

# Summary
echo ""
echo "[4/4] Setup complete!"
echo ""
echo "=========================================="
echo "NEXT STEPS:"
echo "=========================================="
echo ""
echo "Option A: Run Backend (Terminal 1)"
echo "  cd healthconnect-backend"
echo "  export GOOGLE_CLIENT_ID='$GOOGLE_CLIENT_ID'"
echo "  python -m uvicorn main:app --reload"
echo ""
echo "Option B: Run Frontend (Terminal 2)"  
echo "  cd healthconnect-frontend"
echo "  npm run dev"
echo ""
echo "Then visit: http://localhost:5173"
echo ""
