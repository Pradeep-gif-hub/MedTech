const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dose: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    patient: {
      id: { type: String, required: true, trim: true, index: true },
      name: { type: String, required: true, trim: true, index: true },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
      },
    },
    doctor: {
      name: { type: String, required: true, trim: true, index: true },
      specialization: { type: String, required: true, trim: true },
    },
    diagnosis: { type: String, required: true, trim: true },
    medicines: {
      type: [medicineSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0 && arr.length <= 20,
        message: 'Medicines must contain between 1 and 20 items.',
      },
    },
    date: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'prescriptions',
  }
);

prescriptionSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Prescription || mongoose.model('Prescription', prescriptionSchema);
