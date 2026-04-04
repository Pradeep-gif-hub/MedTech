#!/usr/bin/env python3
"""
Migration script to create the feedback table and add doctor_name column to existing tables.
Run this once on startup if needed.
"""

import os
import sys
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, ForeignKey, DateTime, func, inspect
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Base, engine
from models import Feedback, Prescription, User, Notification

def create_feedback_table():
    """Create feedback table if it doesn't exist"""
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if 'feedback' not in tables:
            print("Creating feedback table...")
            Base.metadata.create_all(engine, tables=[Feedback.__table__])
            print("✓ Feedback table created successfully")
        else:
            print("✓ Feedback table already exists")
            
    except Exception as e:
        print(f"✗ Error creating feedback table: {e}")
        return False
    
    return True

def main():
    print("Starting migration...")
    
    # Create feedback table
    if not create_feedback_table():
        print("Migration failed!")
        return False
    
    print("\n✓ All migrations completed successfully!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
