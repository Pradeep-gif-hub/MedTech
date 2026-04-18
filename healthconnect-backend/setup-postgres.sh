#!/bin/bash
# Quick Setup for PostgreSQL Migration
# Run this script to set up PostgreSQL for local development

echo "========================================="
echo "MedTech PostgreSQL Local Setup"
echo "========================================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found!"
    echo "Install from: https://www.postgresql.org/download/"
    exit 1
fi

echo "✅ PostgreSQL found"

# Start PostgreSQL service
echo "🔄 Starting PostgreSQL..."

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    brew services start postgresql
    echo "✅ PostgreSQL started (macOS)"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    sudo service postgresql start
    echo "✅ PostgreSQL started (Linux)"
else
    echo "⚠️  Please start PostgreSQL manually"
fi

sleep 2

# Create database if not exists
echo "📊 Creating database 'medtech'..."
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'medtech'" | grep -q 1 || \
    psql -U postgres -c "CREATE DATABASE medtech;"

echo "✅ Database ready"

# Display connection info
echo ""
echo "========================================="
echo "📋 Connection Info:"
echo "========================================="
echo "Host:     localhost"
echo "Port:     5432"
echo "Database: medtech"
echo "User:     postgres"
echo "Password: (your postgres password)"
echo ""

# Set environment variable
echo "🔧 Setting DATABASE_URL..."
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
    export DATABASE_URL="postgresql://postgres:@localhost/medtech"
    echo "✅ Set: export DATABASE_URL='postgresql://postgres:@localhost/medtech'"
    echo ""
    echo "💡 Add to ~/.bash_profile or ~/.zshrc to persist:"
    echo "   echo 'export DATABASE_URL=\"postgresql://postgres:@localhost/medtech\"' >> ~/.zshrc"
else
    echo "⚠️  Manual setup on Windows:"
    echo "   set DATABASE_URL=postgresql://postgres:@localhost/medtech"
fi

echo ""
echo "========================================="
echo "🚀 Next Steps:"
echo "========================================="
echo "1. Install psycopg2-binary:"
echo "   pip install psycopg2-binary"
echo ""
echo "2. Run migration:"
echo "   python migrate_sqlite_to_postgres.py"
echo ""
echo "3. Start backend:"
echo "   python -m uvicorn main:app --reload"
echo ""
echo "4. Verify migration:"
echo "   psql -d medtech -c 'SELECT COUNT(*) FROM users;'"
echo ""
echo "========================================="
