const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    departmentId: {
      type: String,
      required: [true, 'Department ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Department Name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Department Code is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
       required: [true, ' dec Code is required'],
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Department', departmentSchema);
