const TimeSlot = require('../models/TimeSlot');
const Timetable = require('../models/Timetable');

const STANDARD_PERIODS = [
  { startTime: '09:00', endTime: '10:00', label: '09:00 - 10:00', slotOrder: 1, isBreak: false },
  { startTime: '10:00', endTime: '11:00', label: '10:00 - 11:00', slotOrder: 2, isBreak: false },
  { startTime: '11:15', endTime: '12:15', label: '11:15 - 12:15', slotOrder: 3, isBreak: false },
  { startTime: '12:15', endTime: '01:15', label: '12:15 - 01:15', slotOrder: 4, isBreak: false },
  { startTime: '02:00', endTime: '03:00', label: '02:00 - 03:00', slotOrder: 5, isBreak: false },
  { startTime: '03:00', endTime: '04:00', label: '03:00 - 04:00', slotOrder: 6, isBreak: false },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// @desc    Get all time slots
// @route   GET /api/timeslots
// @access  Private
const getTimeSlots = async (req, res) => {
  try {
    const { day } = req.query;
    const query = {};
    if (day) query.day = day;

    const slots = await TimeSlot.find(query).sort({ day: 1, slotOrder: 1, startTime: 1 });
    res.json({ success: true, count: slots.length, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single time slot
// @route   GET /api/timeslots/:id
// @access  Private
const getTimeSlotById = async (req, res) => {
  try {
    const slot = await TimeSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'TimeSlot not found' });
    }
    res.json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create time slot
// @route   POST /api/timeslots
// @access  Private (Admin only)
const createTimeSlot = async (req, res) => {
  try {
    const { day, startTime, endTime, label, slotOrder, isBreak } = req.body;

    if (!day || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Please provide Day, Start Time, and End Time' });
    }

    const existing = await TimeSlot.findOne({ day, startTime, endTime });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Time slot already exists for this day and time' });
    }

    const slot = await TimeSlot.create({
      day,
      startTime,
      endTime,
      label: label || `${startTime} - ${endTime}`,
      slotOrder: slotOrder || 1,
      isBreak: isBreak || false,
    });

    res.status(201).json({ success: true, message: 'Time slot created successfully', data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update time slot
// @route   PUT /api/timeslots/:id
// @access  Private (Admin only)
const updateTimeSlot = async (req, res) => {
  try {
    const { day, startTime, endTime, label, slotOrder, isBreak } = req.body;

    const slot = await TimeSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Time slot not found' });
    }

    if (day) slot.day = day;
    if (startTime) slot.startTime = startTime;
    if (endTime) slot.endTime = endTime;
    if (label) slot.label = label;
    if (slotOrder !== undefined) slot.slotOrder = slotOrder;
    if (isBreak !== undefined) slot.isBreak = isBreak;

    const updated = await slot.save();
    res.json({ success: true, message: 'Time slot updated successfully', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete time slot
// @route   DELETE /api/timeslots/:id
// @access  Private (Admin only)
const deleteTimeSlot = async (req, res) => {
  try {
    const slot = await TimeSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Time slot not found' });
    }

    const count = await Timetable.countDocuments({ timeSlot: slot._id });
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete time slot: ${count} timetable entries are using it.`,
      });
    }

    await TimeSlot.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Time slot deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate standard time slots for all days
// @route   POST /api/timeslots/generate-standard
// @access  Private (Admin only)
const generateStandardSlots = async (req, res) => {
  try {
    let createdCount = 0;

    for (const day of DAYS) {
      for (const p of STANDARD_PERIODS) {
        const existing = await TimeSlot.findOne({ day, startTime: p.startTime, endTime: p.endTime });
        if (!existing) {
          await TimeSlot.create({
            day,
            startTime: p.startTime,
            endTime: p.endTime,
            label: p.label,
            slotOrder: p.slotOrder,
            isBreak: p.isBreak,
          });
          createdCount++;
        }
      }
    }

    const allSlots = await TimeSlot.find().sort({ day: 1, slotOrder: 1 });
    res.json({
      success: true,
      message: `Generated standard time slots. Added ${createdCount} new slots.`,
      data: allSlots,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTimeSlots,
  getTimeSlotById,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  generateStandardSlots,
};
