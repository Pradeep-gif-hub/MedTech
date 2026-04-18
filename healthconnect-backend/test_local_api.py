#!/usr/bin/env python3
import requests
import json

print('Testing Pharmacy Inventory API (LOCAL)')
print('='*50)

# User ID from your screenshot
USER_ID = '45'

# Test 1: GET prescriptions
print('\n1. Testing GET prescriptions...')
try:
    r = requests.get(f'http://localhost:8000/api/pharmacy/prescriptions?user_id={USER_ID}')
    print(f'✓ Status: {r.status_code}')
    data = r.json()
    print(f'  Prescriptions found: {len(data)}')
except Exception as e:
    print(f'✗ Error: {e}')

# Test 2: POST inventory
print('\n2. Testing POST inventory (adding Dolo)...')
try:
    data = {
        'medicine_name': 'Dolo',
        'category': 'Medicine',
        'current_stock': 15,
        'min_stock': 5,
        'price': 20.0
    }
    r = requests.post(f'http://localhost:8000/api/pharmacy/inventory?user_id={USER_ID}', json=data)
    print(f'✓ Status: {r.status_code}')
    response = r.json()
    print(f'  Response: {response}')
except Exception as e:
    print(f'✗ Error: {e}')

# Test 3: GET inventory
print('\n3. Testing GET inventory...')
try:
    r = requests.get(f'http://localhost:8000/api/pharmacy/inventory?user_id={USER_ID}')
    print(f'✓ Status: {r.status_code}')
    items = r.json()
    print(f'  Total items: {len(items)}')
    for item in items:
        print(f'    - {item["medicine_name"]}: {item["current_stock"]} units @ Rs {item["price"]}')
except Exception as e:
    print(f'✗ Error: {e}')

# Test 4: GET stats
print('\n4. Testing GET stats...')
try:
    r = requests.get(f'http://localhost:8000/api/pharmacy/inventory/stats?user_id={USER_ID}')
    print(f'✓ Status: {r.status_code}')
    stats = r.json()
    print(f'  Total Items: {stats.get("total_items", 0)}')
    print(f'  Low Stock: {stats.get("low_stock_count", 0)}')
    print(f'  Out of Stock: {stats.get("out_of_stock_count", 0)}')
    print(f'  Inventory Value: Rs {stats.get("inventory_value", 0)}')
except Exception as e:
    print(f'✗ Error: {e}')

print('\n' + '='*50)
print('✓ All API tests completed!')
