const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: [true, 'Day is required'],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    startTime: {
      type: String,
      required: [true, 'Start Time is required (e.g. 09:00)'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End Time is required (e.g. 10:00)'],
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    slotOrder: {
      type: Number,
      default: 1,
    },
    isBreak: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for slot order per day
timeSlotSchema.index({ day: 1, startTime: 1, endTime: 1 }, { unique: true });

module.exports = mongoose.model('TimeSlot', timeSlotSchema);
