const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Section name is required (e.g. A, B, C)'],
      trim: true,
      uppercase: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic Year is required (e.g. 2025-2026)'],
      default: '2025-2026',
    },
    studentCount: {
      type: Number,
      default: 60,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique section per department and semester
sectionSchema.index({ department: 1, semester: 1, name: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);
