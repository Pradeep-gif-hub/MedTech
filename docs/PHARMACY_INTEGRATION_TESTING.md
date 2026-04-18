# Pharmacy Integration System - Testing Guide

## Quick Start

### 1. Initialize Database
```bash
cd healthconnect-backend
python init_pharmacy_db.py
```

### 2. Start Backend
```bash
python main.py
# Or with uvicorn:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start Frontend
```bash
cd healthconnect-frontend
npm run dev
```

### 4. Test in Browser
- Navigate to `http://localhost:5173` (or port shown by Vite)
- Login as pharmacy user
- Go to Pharmacy Dashboard

---

## API Testing with cURL

### Prerequisites
- Backend running on `http://localhost:8000`
- Pharmacy user created with ID (example: 100)
- Doctor and patient users created

### Create Test Data First

#### 1. Create Patient User
```bash
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "patient",
    "age": 35,
    "gender": "Male",
    "bloodgroup": "O+"
  }'
```

Response will include `user_id` (example: 10)

#### 2. Create Doctor User
```bash
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Smith",
    "email": "doctor@example.com",
    "password": "password123",
    "role": "doctor",
    "specialization": "General Medicine"
  }'
```

Response will include `user_id` (example: 5)

#### 3. Create Pharmacy User
```bash
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Pharmacy",
    "email": "pharmacy@example.com",
    "password": "password123",
    "role": "pharmacy",
    "location": "Downtown"
  }'
```

Response will include `user_id` (example: 100)

---

## Prescription Flow Testing

### 1. Create Prescription (as Doctor)
```bash
PATIENT_ID=10
DOCTOR_ID=5
curl -X POST http://localhost:8000/api/prescriptions/create \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": '${PATIENT_ID}',
    "doctor_id": '${DOCTOR_ID}',
    "diagnosis": "Hypertension",
    "instruction": "Take with food, avoid salt",
    "medications": [
      {
        "name": "Lisinopril 10mg",
        "dosage": "10mg",
        "frequency": "Once daily",
        "duration": "30 days"
      },
      {
        "name": "Metoprolol 50mg",
        "dosage": "50mg",
        "frequency": "Twice daily",
        "duration": "30 days"
      }
    ],
    "date": "2024-04-18"
  }'
```

**Response:**
```json
{
  "message": "Prescription created",
  "prescription_id": 1,
  "pdf_url": "/api/prescriptions/pdf/1"
}
```

**Save the prescription_id for next steps**

### 2. Get All Prescriptions (Pharmacy View)
```bash
PHARMACY_ID=100
curl -X GET "http://localhost:8000/api/pharmacy/prescriptions?user_id=${PHARMACY_ID}"
```

**Expected Response:**
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
        "frequency": "Once daily",
        "duration": "30 days"
      }
    ],
    "pharmacy_status": "pending",
    "created_at": "2024-04-18T10:30:00"
  }
]
```

### 3. Approve Prescription
```bash
PHARMACY_ID=100
PRESCRIPTION_ID=1
curl -X POST "http://localhost:8000/api/pharmacy/prescriptions/${PRESCRIPTION_ID}/approve?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "message": "Prescription approved",
  "prescription_id": 1,
  "status": "approved"
}
```

### 4. Verify Prescription Status Changed
```bash
PHARMACY_ID=100
curl -X GET "http://localhost:8000/api/pharmacy/prescriptions?user_id=${PHARMACY_ID}" | grep "pharmacy_status"
```

Should show: `"pharmacy_status": "approved"`

### 5. Reject Prescription (Alternative)
Create another prescription and test rejection:
```bash
PHARMACY_ID=100
PRESCRIPTION_ID=2
curl -X POST "http://localhost:8000/api/pharmacy/prescriptions/${PRESCRIPTION_ID}/reject?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json"
```

---

## Inventory Management Testing

### 1. Add Medicine to Inventory
```bash
PHARMACY_ID=100
curl -X POST "http://localhost:8000/api/pharmacy/inventory?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "medicine_name": "Paracetamol 500mg",
    "category": "Analgesics",
    "current_stock": 500,
    "min_stock": 100,
    "price": 2.50
  }'
```

**Response:**
```json
{
  "message": "Inventory item created",
  "id": 1,
  "medicine_name": "Paracetamol 500mg",
  "status": "in-stock"
}
```

### 2. Add Multiple Medicines
```bash
PHARMACY_ID=100

# Add Antibiotic
curl -X POST "http://localhost:8000/api/pharmacy/inventory?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "medicine_name": "Amoxicillin 250mg",
    "category": "Antibiotics",
    "current_stock": 200,
    "min_stock": 50,
    "price": 8.75
  }'

# Add Cardiovascular medicine
curl -X POST "http://localhost:8000/api/pharmacy/inventory?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "medicine_name": "Atorvastatin 20mg",
    "category": "Cardiovascular",
    "current_stock": 15,
    "min_stock": 30,
    "price": 12.50
  }'

# Add Out of Stock medicine
curl -X POST "http://localhost:8000/api/pharmacy/inventory?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "medicine_name": "Metformin 500mg",
    "category": "Diabetes",
    "current_stock": 0,
    "min_stock": 25,
    "price": 6.25
  }'
```

### 3. Get Inventory
```bash
PHARMACY_ID=100
curl -X GET "http://localhost:8000/api/pharmacy/inventory?user_id=${PHARMACY_ID}"
```

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
    "pharmacy_id": 100,
    "status": "in-stock",
    "created_at": "2024-04-18T10:00:00",
    "updated_at": "2024-04-18T10:00:00"
  },
  {
    "id": 2,
    "medicine_name": "Amoxicillin 250mg",
    "category": "Antibiotics",
    "current_stock": 200,
    "min_stock": 50,
    "price": 8.75,
    "pharmacy_id": 100,
    "status": "in-stock"
  },
  {
    "id": 3,
    "medicine_name": "Atorvastatin 20mg",
    "category": "Cardiovascular",
    "current_stock": 15,
    "min_stock": 30,
    "price": 12.50,
    "pharmacy_id": 100,
    "status": "low-stock"
  },
  {
    "id": 4,
    "medicine_name": "Metformin 500mg",
    "category": "Diabetes",
    "current_stock": 0,
    "min_stock": 25,
    "price": 6.25,
    "pharmacy_id": 100,
    "status": "out-of-stock"
  }
]
```

### 4. Update Medicine Stock
```bash
PHARMACY_ID=100
ITEM_ID=3  # Atorvastatin (currently low-stock with 15 units)

# Update to in-stock
curl -X PUT "http://localhost:8000/api/pharmacy/inventory/${ITEM_ID}?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "current_stock": 50
  }'
```

**Response:**
```json
{
  "message": "Inventory item updated",
  "id": 3,
  "medicine_name": "Atorvastatin 20mg",
  "status": "in-stock"
}
```

### 5. Update Price
```bash
PHARMACY_ID=100
ITEM_ID=1
curl -X PUT "http://localhost:8000/api/pharmacy/inventory/${ITEM_ID}?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 3.00
  }'
```

### 6. Delete Medicine from Inventory
```bash
PHARMACY_ID=100
ITEM_ID=4  # Metformin
curl -X DELETE "http://localhost:8000/api/pharmacy/inventory/${ITEM_ID}?user_id=${PHARMACY_ID}"
```

**Response:**
```json
{
  "message": "Inventory item deleted",
  "id": 4
}
```

---

## Inventory Statistics Testing

### 1. Get Inventory Stats
```bash
PHARMACY_ID=100
curl -X GET "http://localhost:8000/api/pharmacy/inventory/stats?user_id=${PHARMACY_ID}"
```

**Response:**
```json
{
  "total_items": 3,
  "low_stock_count": 0,
  "out_of_stock_count": 0,
  "inventory_value": 2263.75
}
```

Breaking down:
- `total_items`: 3 (Paracetamol, Amoxicillin, Atorvastatin)
- `low_stock_count`: 0 (all are at or above min_stock)
- `out_of_stock_count`: 0 (all have stock > 0)
- `inventory_value`: 500*2.5 + 200*8.75 + 50*12.5 = 1250 + 1750 + 625 = 3625

**Note:** After updating Atorvastatin from 15 to 50, inventory_value changes.

---

## Multi-Pharmacy Isolation Testing

### Test Setup
- Pharmacy A: ID 100
- Pharmacy B: ID 101

### 1. Pharmacy A Adds Inventory
```bash
PHARMACY_ID=100
curl -X POST "http://localhost:8000/api/pharmacy/inventory?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "medicine_name": "Aspirin 100mg",
    "category": "Analgesics",
    "current_stock": 300,
    "min_stock": 50,
    "price": 1.50
  }'
```

### 2. Pharmacy B Gets Empty Inventory
```bash
PHARMACY_ID=101
curl -X GET "http://localhost:8000/api/pharmacy/inventory?user_id=${PHARMACY_ID}"
```

**Expected:** Empty array `[]`

### 3. Pharmacy B Adds Own Inventory
```bash
PHARMACY_ID=101
curl -X POST "http://localhost:8000/api/pharmacy/inventory?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "medicine_name": "Ibuprofen 200mg",
    "category": "Anti-inflammatory",
    "current_stock": 400,
    "min_stock": 100,
    "price": 2.00
  }'
```

### 4. Verify Isolation
```bash
# Pharmacy A still has only Aspirin
curl -X GET "http://localhost:8000/api/pharmacy/inventory?user_id=100" | grep "medicine_name"
# Output: "medicine_name": "Aspirin 100mg"

# Pharmacy B has only Ibuprofen  
curl -X GET "http://localhost:8000/api/pharmacy/inventory?user_id=101" | grep "medicine_name"
# Output: "medicine_name": "Ibuprofen 200mg"
```

---

## UI Testing (Browser)

### Prerequisite
- All test data created via cURL above
- Both users logged in separately (use private/incognito windows)

### Test 1: Pharmacy Dashboard Prescriptions Tab

1. **Login as Pharmacy A (user_id=100)**
2. **Navigate to Pharmacy Dashboard**
3. **Verify Prescriptions Tab:**
   - Shows prescription #1 with status "pending"
   - Displays patient name "John Doe"
   - Shows doctor name "Dr. Smith"
   - Lists medicines: Lisinopril 10mg, Metoprolol 50mg
   - Has "Approve" and "Reject" buttons

4. **Click Approve:**
   - Status changes from "pending" to "approved" (blue badge)
   - Buttons change to show checkmark
   - No page refresh needed

5. **Create another prescription (as doctor)** and test rejection flow

### Test 2: Pharmacy Dashboard Inventory Tab

1. **Login as Pharmacy A (user_id=100)**
2. **Verify Stats Cards:**
   - Total Items: 3
   - Low Stock: 0
   - Out of Stock: 0
   - Inventory Value: Should match calculation

3. **Verify Inventory Table:**
   - Paracetamol: status "in-stock" (green badge)
   - Amoxicillin: status "in-stock" (green badge)
   - Atorvastatin: status "in-stock" (green badge)

4. **Test Edit:**
   - Click "Edit" on Atorvastatin
   - Change stock to 15
   - Status changes to "low-stock" (orange badge)
   - Stats update: Low Stock = 1

5. **Test Restock:**
   - Click "Restock" on low-stock item
   - Stock updates to min_stock (30)
   - Status returns to "in-stock"

6. **Add New Medicine:**
   - Click "+ Add New Item"
   - Fill form with Vitamin D3 data
   - Click Save
   - New item appears in table
   - Total Items increments

### Test 3: Real-time Updates

1. **Open Pharmacy Dashboard in Two Windows:**
   - Window A: Pharmacy A
   - Window B: Pharmacy A (same user)

2. **In Window A:**
   - Add new medicine "Vitamin C 500mg"

3. **In Window B:**
   - Should see new item within 5 seconds (polling interval)
   - Or manually refresh

---

## Error Testing

### 1. Unauthorized Access
```bash
INVALID_ID=999
curl -X GET "http://localhost:8000/api/pharmacy/inventory?user_id=${INVALID_ID}"
```

Should fail with 403 error (user not pharmacy)

### 2. Non-existent Prescription
```bash
PHARMACY_ID=100
INVALID_PRESCRIPTION_ID=99999
curl -X POST "http://localhost:8000/api/pharmacy/prescriptions/${INVALID_PRESCRIPTION_ID}/approve?user_id=${PHARMACY_ID}"
```

Should return 404 error

### 3. Duplicate Medicine
```bash
PHARMACY_ID=100
curl -X POST "http://localhost:8000/api/pharmacy/inventory?user_id=${PHARMACY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "medicine_name": "Paracetamol 500mg",
    "category": "Analgesics",
    "current_stock": 100,
    "min_stock": 20,
    "price": 2.50
  }'
```

Should return 400 error (medicine already exists)

---

## Performance Baseline

### Expected Response Times
- `GET /prescriptions`: < 100ms (small dataset)
- `GET /inventory`: < 100ms (small dataset)
- `GET /inventory/stats`: < 50ms (calculation only)
- `POST /inventory`: < 100ms (with DB commit)
- `PUT /inventory`: < 100ms (with DB commit)

### Expected Data Sizes
- Single prescription JSON: ~500 bytes
- Single inventory item JSON: ~300 bytes
- Stats JSON: ~100 bytes

---

## Cleanup

### Reset Test Data
```bash
# Delete all test inventory items
for id in {1..4}; do
  curl -X DELETE "http://localhost:8000/api/pharmacy/inventory/${id}?user_id=100"
done

# Delete test prescriptions (requires DB direct access)
# sqlite3 healthconnect.db "DELETE FROM prescriptions WHERE id > 0;"
```
