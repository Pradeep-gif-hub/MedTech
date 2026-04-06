#!/usr/bin/env python3
"""Test the matching logic directly"""

disease = "Cardiac Arrest"
specializations = [
    "General Medicine",
    "Respiratory",
    "Neurology",
    "Cardiology",
    "Dermatology"
]

print("Testing fixed matching logic (4-char prefix match):")
print(f"Disease: '{disease}'")
print()

for spec in specializations:
    matching = False
    disease_lower = disease.lower()
    spec_lower = spec.lower()
    
    disease_words = disease_lower.split()
    spec_words = spec_lower.split()
    
    print(f"Checking against: '{spec}'")
    print(f"  First disease word: '{disease_words[0] if disease_words else None}'")
    print(f"  First spec word: '{spec_words[0] if spec_words else None}'")
    
    if disease_words and spec_words:
        first_disease_word = disease_words[0]
        first_spec_word = spec_words[0]
        
        # Find common prefix length
        common_prefix_len = 0
        for i in range(min(len(first_disease_word), len(first_spec_word))):
            if first_disease_word[i] == first_spec_word[i]:
                common_prefix_len += 1
            else:
                break
        
        print(f"  Common prefix length: {common_prefix_len}")
        print(f"  Common prefix: '{first_disease_word[:common_prefix_len]}'")
        
        if common_prefix_len >= 4:
            matching = True
    
    print(f"  Result: {'MATCH' if matching else 'NO MATCH'}")
    print()
