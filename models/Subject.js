const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Subject Code is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Subject Name is required'],
      trim: true,
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
    credits: {
      type: Number,
      required: [true, 'Credits are required'],
      min: 1,
      max: 10,
      default: 3,
    },
    type: {
      type: String,
      required: [true, 'Subject Type is required'],
      enum: ['Theory', 'Laboratory', 'Elective'],
      default: 'Theory',
    },
    weeklyHours: {
      type: Number,
      default: 4,
    },
    color: {
      type: String,
      default: '#3B82F6', // modern blue default
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Subject', subjectSchema);
