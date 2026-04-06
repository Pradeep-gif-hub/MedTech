"""
Disease-to-Specialization Mapping
This ensures consistent matching between diseases selected by patients
and available doctor specializations
"""

DISEASE_SPECIALIZATION_MAP = {
    # Cardiology (Doctor 34)
    "Cardiac Arrest": "Cardiology",
    "Cardiomyopathy": "Cardiology",
    "Heart Attack": "Cardiology",
    "Arrhythmia": "Cardiology",
    "Hypertension": "Cardiology",
    "Angina": "Cardiology",
    "Heart Block": "Cardiology",
    "Valve Disease": "Cardiology",
    
    # Respiratory (Doctor 22)
    "Respiratory Failure": "Respiratory",
    "Respiratory Infection": "Respiratory",
    "Asthma": "Respiratory",
    "COPD": "Respiratory",
    "Pneumonia": "Respiratory",
    "Bronchitis": "Respiratory",
    "Lung Disease": "Respiratory",
    "Shortness of Breath": "Respiratory",
    
    # Neurology (Doctor 30)
    "Neurological Disorder": "Neurology",
    "Neuralgic Pain": "Neurology",
    "Migraine": "Neurology",
    "Epilepsy": "Neurology",
    "Stroke": "Neurology",
    "Parkinson": "Neurology",
    "Alzheimer": "Neurology",
    "Neuropathy": "Neurology",
    
    # Dermatology (Doctor 35)
    "Dermatological Issue": "Dermatology",
    "Dermatitis": "Dermatology",
    "Eczema": "Dermatology",
    "Psoriasis": "Dermatology",
    "Acne": "Dermatology",
    "Fungal Infection": "Dermatology",
    "Skin Allergy": "Dermatology",
    "Rash": "Dermatology",
    
    # General Medicine (Doctor 2)
    "General Checkup": "General Medicine",
    "Fever": "General Medicine",
    "Cold": "General Medicine",
    "Flu": "General Medicine",
    "Infection": "General Medicine",
    "Weakness": "General Medicine",
    "Fatigue": "General Medicine",
    "Other": "General Medicine",
}

# Reverse mapping: Specialization -> List of diseases
SPECIALIZATION_DISEASE_MAP = {}
for disease, specialization in DISEASE_SPECIALIZATION_MAP.items():
    if specialization not in SPECIALIZATION_DISEASE_MAP:
        SPECIALIZATION_DISEASE_MAP[specialization] = []
    SPECIALIZATION_DISEASE_MAP[specialization].append(disease)

# List of all valid disease options for dropdown
VALID_DISEASE_OPTIONS = sorted(list(DISEASE_SPECIALIZATION_MAP.keys()))

# Specialization -> Doctor ID mapping
SPECIALIZATION_DOCTOR_MAP = {
    "General Medicine": 2,
    "Respiratory": 22,
    "Neurology": 30,
    "Cardiology": 34,
    "Dermatology": 35,
}
