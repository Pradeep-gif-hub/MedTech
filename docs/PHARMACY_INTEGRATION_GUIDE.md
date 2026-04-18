# Pharmacy Integration System - Implementation Guide

## Overview

This document describes the complete Pharmacy Integration System implementation for the MedTech healthcare application. The system enables:

1. **Real-time Prescription Flow** - Doctors create prescriptions that automatically appear in pharmacy dashboards
2. **Pharmacy Dashboard** - Pharmacies manage prescriptions and can approve/reject them
3. **Inventory Management** - Each pharmacy maintains their own inventory with real-time stock tracking
4. **Stats & Analytics** - Dashboard cards showing inventory metrics (total items, low stock, out of stock, inventory value)

## Architecture

### Backend (FastAPI)

#### New Models
- **Prescription** (updated): Added `pharmacy_status` and `status` fields
- **Inventory** (new): Per-pharmacy inventory management

#### New API Routes (`/api/pharmacy`)
- `GET /prescriptions` - List all pending/approved prescriptions
- `POST /prescriptions/{id}/approve` - Approve a prescription
- `POST /prescriptions/{id}/reject` - Reject a prescription
- `GET /inventory` - List inventory for logged-in pharmacy
- `POST /inventory` - Add new medicine
- `PUT /inventory/{id}` - Update medicine details
- `DELETE /inventory/{id}` - Delete medicine
- `GET /inventory/stats` - Get inventory statistics

### Frontend (React/TypeScript)

#### Updated Components
- **PharmacyDashboard**: Completely rewritten to use real API data
  - Prescriptions tab: Shows real prescriptions with approve/reject buttons
  - Inventory tab: Shows real inventory with CRUD operations
  - Live stats cards that update from database

## Database Schema

### Prescriptions Table Changes
```sql
ALTER TABLE prescriptions ADD COLUMN pharmacy_status VARCHAR DEFAULT 'pending';
ALTER TABLE prescriptions ADD COLUMN status VARCHAR DEFAULT 'pending';
```

**New Fields:**
- `pharmacy_status`: pending | approved | rejected (for pharmacy workflow)
- `status`: pending | approved | rejected | dispensed (for general workflow)

### Inventory Table (New)
```sql
CREATE TABLE inventory (
    id INTEGER PRIMARY KEY,
    pharmacy_id INTEGER NOT NULL (FOREIGN KEY),
    medicine_name VARCHAR NOT NULL,
    category VARCHAR NOT NULL,
    current_stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    price FLOAT DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pharmacy_id) REFERENCES users(id)
);
```

## Implementation Steps

### 1. Database Setup
```bash
cd healthconnect-backend
python init_pharmacy_db.py
```

This script:
- Creates the `inventory` table
- Adds `pharmacy_status` and `status` columns to prescriptions
- Verifies all tables are correctly created

### 2. Backend Verification
The pharmacy router is automatically imported and registered in `main.py`:
```python
from routers import pharmacy
app.include_router(pharmacy.router)  # Mounts at /api/pharmacy
```

### 3. Frontend Integration
The PharmacyDashboard component automatically:
- Fetches prescriptions from `/api/pharmacy/prescriptions`
- Fetches inventory from `/api/pharmacy/inventory`
- Fetches stats from `/api/pharmacy/inventory/stats`
- Polls for new prescriptions every 5 seconds
- Handles approve/reject/CRUD operations

## API Endpoints

### Authentication
All pharmacy endpoints require `user_id` query parameter:
```
GET /api/pharmacy/prescriptions?user_id=123
```

The `user_id` is extracted from localStorage (user profile):
```typescript
const userId = signedUser?.id || localStorage.getItem('user_id');
```

### Prescription Endpoints

#### GET /api/pharmacy/prescriptions
Returns all pending and approved prescriptions visible to all pharmacies.

**Response:**
```json
[
  {
    "id": 1,
    "patient_id": 10,
    "patient_name": "John Doe",
    "doctor_id": 5,
    "doctor_name": "Dr. Smith",
    "date": "2024-04-18",
    "diagnosis": "Hypertension",
    "medicines": [
      {
        "name": "Lisinopril 10mg",
        "dosage": "10mg",
        "frequency": "Daily",
        "duration": "30 days"
      }
    ],
    "pharmacy_status": "pending",
    "created_at": "2024-04-18T10:30:00"
  }
]
```

#### POST /api/pharmacy/prescriptions/{id}/approve
Approves a prescription.

**Request:** None (only user_id query param)

**Response:**
```json
{
  "message": "Prescription approved",
  "prescription_id": 1,
  "status": "approved"
}
```

#### POST /api/pharmacy/prescriptions/{id}/reject
Rejects a prescription.

**Response:**
```json
{
  "message": "Prescription rejected",
  "prescription_id": 1,
  "status": "rejected"
}
```

### Inventory Endpoints

#### GET /api/pharmacy/inventory
Returns inventory for logged-in pharmacy user.

**Response:**
```json
[
  {
    "id": 1,
    "medicine_name": "Paracetamol 500mg",
    "category": "Analgesics",
    "current_stock": 500,
    "min_stock": 100,
    "price": 2.50,
    "pharmacy_id": 123,
    "status": "in-stock",
    "created_at": "2024-04-18T10:00:00",
    "updated_at": "2024-04-18T10:00:00"
  }
]
```

#### POST /api/pharmacy/inventory
Add new medicine to pharmacy inventory.

**Request:**
```json
{
  "medicine_name": "Aspirin 100mg",
  "category": "Analgesics",
  "current_stock": 200,
  "min_stock": 50,
  "price": 1.50
}
```

**Response:**
```json
{
  "message": "Inventory item created",
  "id": 1,
  "medicine_name": "Aspirin 100mg",
  "status": "in-stock"
}
```

#### PUT /api/pharmacy/inventory/{id}
Update inventory item.

**Request:** (all fields optional)
```json
{
  "current_stock": 300,
  "price": 2.00
}
```

**Response:**
```json
{
  "message": "Inventory item updated",
  "id": 1,
  "medicine_name": "Paracetamol 500mg",
  "status": "in-stock"
}
```

#### DELETE /api/pharmacy/inventory/{id}
Delete inventory item.

**Response:**
```json
{
  "message": "Inventory item deleted",
  "id": 1
}
```

#### GET /api/pharmacy/inventory/stats
Get inventory statistics for dashboard.

**Response:**
```json
{
  "total_items": 25,
  "low_stock_count": 3,
  "out_of_stock_count": 1,
  "inventory_value": 5234.50
}
```

## Testing

### Test Flow 1: Prescription Creation → Pharmacy Visibility

1. **Create prescription as doctor:**
   ```bash
   curl -X POST http://localhost:8000/api/prescriptions/create \
     -H "Content-Type: application/json" \
     -d '{
       "patient_id": 10,
       "doctor_id": 5,
       "diagnosis": "Hypertension",
       "instruction": "Take with water",
       "medications": [
         {"name": "Lisinopril 10mg", "dosage": "10mg", "frequency": "Daily", "duration": "30 days"}
       ],
       "date": "2024-04-18"
     }'
   ```

2. **Check pharmacy dashboard:**
   - Navigate to Pharmacy Dashboard
   - Go to "Prescriptions" tab
   - Should see the newly created prescription with status "pending"

3. **Approve prescription:**
   - Click "Approve" button on prescription card
   - Status should change to "approved" immediately
   - UI updates without page refresh

### Test Flow 2: Inventory Management

1. **Add medicine to inventory:**
   - Click "+ Add New Item" button in Inventory tab
   - Fill in details:
     - Medicine Name: "Paracetamol 500mg"
     - Category: "Analgesics"
     - Current Stock: 500
     - Min Stock: 100
     - Price: 2.50
   - Click "Save"

2. **Verify inventory:**
   - Medicine appears in table
   - Status badge shows "in-stock"
   - Stats cards update:
     - Total Items: 1
     - Low Stock Items: 0
     - Out of Stock: 0
     - Inventory Value: 2.50

3. **Update stock:**
   - Click "Edit" on medicine row
   - Enter new quantity (e.g., 50)
   - Status should change to "low-stock"

4. **Test low stock:**
   - Edit item to stock = 50 (below min_stock of 100)
   - Status changes to "low-stock"
   - Stats update: Low Stock Items = 1

5. **Test out of stock:**
   - Edit item to stock = 0
   - Status changes to "out-of-stock"
   - Stats update: Out of Stock = 1

### Test Flow 3: Multi-Pharmacy Isolation

1. **Pharmacy A adds inventory:**
   - Login as Pharmacy A (user_id = 100)
   - Add "Aspirin 100mg" with stock 200

2. **Pharmacy B doesn't see it:**
   - Login as Pharmacy B (user_id = 101)
   - Inventory is empty
   - Total Items = 0

3. **Pharmacy B adds own inventory:**
   - Add "Ibuprofen 200mg" with stock 300

4. **Verify isolation:**
   - Pharmacy A still only sees Aspirin
   - Pharmacy B still only sees Ibuprofen

## Deployment Notes

### Environment Variables
No new environment variables required. Pharmacy routes use existing:
- `DATABASE_URL` for database connection
- `VITE_API_URL` for frontend API endpoint (frontend only)

### Database Migrations
For PostgreSQL production deployments:
```bash
python init_pharmacy_db.py  # Creates tables if not exist
```

For SQLite (development):
- Tables auto-created on first access
- Run `init_pharmacy_db.py` to ensure columns exist

### CORS Configuration
Pharmacy endpoints are already included in CORS configuration in `main.py`:
- `/api/pharmacy/*` routes are available to frontend

## Monitoring & Debugging

### Check Backend Status
```bash
curl http://localhost:8000/health
```

### Check Pharmacy Routes Mounted
```bash
curl http://localhost:8000/api/pharmacy/prescriptions?user_id=1
```

### Logs
Backend logs will show:
```
[STARTUP] Pharmacy router imported successfully
[STARTUP] Pharmacy router mounted at /api/pharmacy/*
```

## Known Limitations & Future Enhancements

### Current Limitations
1. User ID passed as query parameter (should use JWT in production)
2. No WebSocket for real-time updates (polls every 5 seconds instead)
3. No caching of frequently accessed data
4. No pagination for large prescription/inventory lists

### Recommended Enhancements
1. **JWT Authentication** - Replace user_id query param with JWT token
2. **WebSocket Integration** - Real-time prescription push notifications
3. **Pagination** - Handle large datasets efficiently
4. **Batch Operations** - Update multiple inventory items at once
5. **Analytics** - Detailed sales and usage analytics
6. **Notifications** - Email/SMS alerts for out-of-stock items
7. **Prescription History** - Track prescription approvals over time

## Support & Troubleshooting

### Prescriptions not appearing in pharmacy dashboard?
- Check that prescription `pharmacy_status` is "pending" or "approved"
- Verify pharmacy user is logged in (check user_id)
- Refresh dashboard (F5) to trigger new API call

### Inventory not saving?
- Check browser console for API errors
- Verify user_id is being sent in request
- Confirm pharmacy user role in database

### Status badges not updating?
- Hard refresh browser (Ctrl+Shift+R)
- Check network tab to see if API responses are correct
- Verify inventory status calculation is correct:
  - `out-of-stock`: current_stock == 0
  - `low-stock`: current_stock < min_stock && current_stock > 0
  - `in-stock`: current_stock >= min_stock

## File Structure

```
healthconnect-backend/
├── routers/
│   └── pharmacy.py          # NEW: Pharmacy API routes
├── models.py                # UPDATED: Added pharmacy_status, Inventory model
├── schemas.py               # UPDATED: Added pharmacy schemas
├── main.py                  # UPDATED: Registered pharmacy router
└── init_pharmacy_db.py      # NEW: Database initialization script

healthconnect-frontend/
└── src/components/
    └── PharmacyDashboard.tsx  # UPDATED: Real API integration
```
