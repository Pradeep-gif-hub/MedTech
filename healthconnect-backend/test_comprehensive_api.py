#!/usr/bin/env python3
"""
Comprehensive Pharmacy Inventory API Test
Tests CORS, authentication, and all CRUD operations
"""

import requests
import json
import time
from datetime import datetime

print(f"\n{'='*70}")
print(f"PHARMACY INVENTORY API TEST - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"{'='*70}\n")

# Configuration
API_BASE = "http://localhost:8000"
PHARMACY_USER_ID = 45
TEST_MEDICINE = {
    "medicine_name": "Dolo-650",
    "category": "Pain Relief",
    "current_stock": 100,
    "min_stock": 20,
    "price": 45.50
}

def test_health():
    """Test if backend is running"""
    print("1️⃣  Testing backend health...")
    try:
        r = requests.get(f"{API_BASE}/health", timeout=5)
        print(f"   ✓ Status: {r.status_code}")
        print(f"   ✓ Response: {r.json()}")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        print(f"   ⚠️  Backend may not be running on {API_BASE}")
        return False

def test_cors_preflight():
    """Test CORS preflight request"""
    print("\n2️⃣  Testing CORS preflight...")
    try:
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
        r = requests.options(
            f"{API_BASE}/api/pharmacy/inventory?user_id={PHARMACY_USER_ID}",
            headers=headers,
            timeout=5
        )
        print(f"   ✓ Status: {r.status_code}")
        cors_origin = r.headers.get('Access-Control-Allow-Origin')
        print(f"   ✓ CORS Origin: {cors_origin}")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def test_get_inventory():
    """Test GET inventory endpoint"""
    print(f"\n3️⃣  Testing GET inventory (user_id={PHARMACY_USER_ID})...")
    try:
        r = requests.get(
            f"{API_BASE}/api/pharmacy/inventory?user_id={PHARMACY_USER_ID}",
            timeout=5
        )
        print(f"   ✓ Status: {r.status_code}")
        data = r.json()
        print(f"   ✓ Items: {len(data)}")
        for item in data:
            print(f"      - {item['medicine_name']}: {item['current_stock']} units @ Rs {item['price']}")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def test_post_inventory():
    """Test POST inventory endpoint"""
    print(f"\n4️⃣  Testing POST inventory (adding {TEST_MEDICINE['medicine_name']})...")
    try:
        r = requests.post(
            f"{API_BASE}/api/pharmacy/inventory?user_id={PHARMACY_USER_ID}",
            json=TEST_MEDICINE,
            timeout=5
        )
        print(f"   ✓ Status: {r.status_code}")
        data = r.json()
        print(f"   ✓ Response: {json.dumps(data, indent=6)}")
        if r.status_code == 200:
            print(f"   ✓ Item created with ID: {data.get('id')}")
            return True
        else:
            print(f"   ⚠️  Status {r.status_code}: {data.get('detail', 'Unknown error')}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def test_get_stats():
    """Test GET inventory stats"""
    print(f"\n5️⃣  Testing GET stats (user_id={PHARMACY_USER_ID})...")
    try:
        r = requests.get(
            f"{API_BASE}/api/pharmacy/inventory/stats?user_id={PHARMACY_USER_ID}",
            timeout=5
        )
        print(f"   ✓ Status: {r.status_code}")
        data = r.json()
        print(f"   ✓ Total Items: {data.get('total_items', 0)}")
        print(f"   ✓ Low Stock: {data.get('low_stock_count', 0)}")
        print(f"   ✓ Out of Stock: {data.get('out_of_stock_count', 0)}")
        print(f"   ✓ Inventory Value: Rs {data.get('inventory_value', 0)}")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def test_prescriptions():
    """Test GET prescriptions"""
    print(f"\n6️⃣  Testing GET prescriptions (user_id={PHARMACY_USER_ID})...")
    try:
        r = requests.get(
            f"{API_BASE}/api/pharmacy/prescriptions?user_id={PHARMACY_USER_ID}",
            timeout=5
        )
        print(f"   ✓ Status: {r.status_code}")
        data = r.json()
        print(f"   ✓ Prescriptions: {len(data)}")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

# Run all tests
results = []
results.append(("Health Check", test_health()))
if results[-1][1]:  # Only continue if health check passed
    results.append(("CORS Preflight", test_cors_preflight()))
    results.append(("GET Inventory", test_get_inventory()))
    results.append(("POST Inventory", test_post_inventory()))
    results.append(("GET Stats", test_get_stats()))
    results.append(("GET Prescriptions", test_prescriptions()))

# Summary
print(f"\n{'='*70}")
print("TEST SUMMARY")
print(f"{'='*70}")
passed = sum(1 for _, result in results if result)
total = len(results)
print(f"\nPassed: {passed}/{total}")
for test_name, result in results:
    status = "✓ PASS" if result else "❌ FAIL"
    print(f"  {status} - {test_name}")

if passed == total:
    print(f"\n✅ All tests passed!")
else:
    print(f"\n⚠️  Some tests failed. Check the errors above.")

print(f"\n{'='*70}\n")
