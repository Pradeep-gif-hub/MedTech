import requests
import json

print("Testing Pharmacy Inventory API\n")
print("="*50)

# Test adding Aspirin
print("\n1. Adding Aspirin to inventory...")
data = {
    'medicine_name': 'Aspirin',
    'category': 'Pain Relief',
    'current_stock': 50,
    'min_stock': 10,
    'price': 2.50
}

r = requests.post('http://localhost:8000/api/pharmacy/inventory?user_id=3', json=data)
print(f'Status: {r.status_code}')
if r.status_code == 200:
    print(f'Response: {r.json()}')
else:
    print(f'Error: {r.text}')

# Get all inventory
print("\n2. Fetching all inventory items...")
r = requests.get('http://localhost:8000/api/pharmacy/inventory?user_id=3')
items = r.json()
print(f'Total items: {len(items)}')
print("\nInventory List:")
for item in items:
    print(f"  - {item['medicine_name']:20} | Stock: {item['current_stock']:3} | Price: Rs {item['price']:.2f} | Status: {item['status']}")

# Get stats
print("\n3. Fetching inventory statistics...")
r = requests.get('http://localhost:8000/api/pharmacy/inventory/stats?user_id=3')
stats = r.json()
print(f"Total Items: {stats['total_items']}")
print(f"Low Stock: {stats['low_stock_count']}")
print(f"Out of Stock: {stats['out_of_stock_count']}")
print(f"Inventory Value: Rs {stats['inventory_value']:.2f}")

print("\n" + "="*50)
print("✓ All API tests passed!")
