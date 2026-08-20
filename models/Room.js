const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, 'Room Number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      required: [true, 'Room Type is required'],
      enum: ['Classroom', 'Laboratory', 'Seminar Hall'],
      default: 'Classroom',
    },
    building: {
      type: String,
      required: [true, 'Building name is required'],
      trim: true,
    },
    floor: {
      type: String,
      default: '1st Floor',
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: 1,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Room', roomSchema);
