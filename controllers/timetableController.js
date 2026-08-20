const Timetable = require('../models/Timetable');
const TimeSlot = require('../models/TimeSlot');
const Notification = require('../models/Notification');
const { checkTimetableConflict } = require('../utils/conflictChecker');

// @desc    Get timetable entries with comprehensive filters
// @route   GET /api/timetable
// @access  Private
const getTimetableEntries = async (req, res) => {
  try {
    const { department, semester, section, faculty, room, day, academicYear } = req.query;
    const query = {};

    if (department) query.department = department;
    if (semester) query.semester = Number(semester);
    if (section) query.section = section;
    if (faculty) query.faculty = faculty;
    if (room) query.room = room;
    if (day) query.day = day;
    if (academicYear) query.academicYear = academicYear;

    const entries = await Timetable.find(query)
      .populate('department', 'name code')
      .populate('section', 'name semester')
      .populate('subject', 'name code credits type color')
      .populate('faculty', 'name facultyId designation')
      .populate('room', 'roomNumber building type capacity')
      .populate('timeSlot')
      .sort({ day: 1, 'timeSlot.slotOrder': 1 });

    res.json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get structured weekly grid (Days x TimeSlots)
// @route   GET /api/timetable/grid
// @access  Private
const getTimetableGrid = async (req, res) => {
  try {
    const { section, faculty, room, department, semester } = req.query;

    const query = {};
    if (section) query.section = section;
    if (faculty) query.faculty = faculty;
    if (room) query.room = room;
    if (department) query.department = department;
    if (semester) query.semester = Number(semester);

    const entries = await Timetable.find(query)
      .populate('department', 'name code')
      .populate('section', 'name semester')
      .populate('subject', 'name code credits type color')
      .populate('faculty', 'name facultyId designation')
      .populate('room', 'roomNumber building type capacity')
      .populate('timeSlot');

    // Get all standard timeslot slots
    const allSlots = await TimeSlot.find().sort({ slotOrder: 1, startTime: 1 });

    // Distinct time intervals for grid columns (e.g. 09:00 - 10:00)
    const timeLabels = [];
    const seenTimes = new Set();
    allSlots.forEach((slot) => {
      const label = `${slot.startTime} - ${slot.endTime}`;
      if (!seenTimes.has(label)) {
        seenTimes.add(label);
        timeLabels.push({
          label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotOrder: slot.slotOrder,
          isBreak: slot.isBreak,
        });
      }
    });
    timeLabels.sort((a, b) => a.slotOrder - b.slotOrder || a.startTime.localeCompare(b.startTime));

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Construct grid matrix: { [day]: { [timeLabel]: Entry } }
    const grid = {};
    days.forEach((d) => {
      grid[d] = {};
      timeLabels.forEach((t) => {
        grid[d][t.label] = null;
      });
    });

    entries.forEach((entry) => {
      if (entry.timeSlot && grid[entry.day]) {
        const label = `${entry.timeSlot.startTime} - ${entry.timeSlot.endTime}`;
        grid[entry.day][label] = entry;
      }
    });

    res.json({
      success: true,
      data: {
        timeLabels,
        days,
        grid,
        rawEntries: entries,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single timetable entry
// @route   GET /api/timetable/:id
// @access  Private
const getTimetableById = async (req, res) => {
  try {
    const entry = await Timetable.findById(req.params.id)
      .populate('department')
      .populate('section')
      .populate('subject')
      .populate('faculty')
      .populate('room')
      .populate('timeSlot');

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Live conflict verification endpoint (Pre-submit check)
// @route   POST /api/timetable/check-conflict
// @access  Private
const checkConflictEndpoint = async (req, res) => {
  try {
    const { faculty, room, section, timeSlot, day, subject, excludeId } = req.body;

    if (!timeSlot || !day) {
      return res.status(400).json({ success: false, message: 'TimeSlot and Day are required to check conflicts' });
    }

    const result = await checkTimetableConflict({
      faculty,
      room,
      section,
      timeSlot,
      day,
      subject,
      excludeId,
    });

    res.json({
      success: true,
      hasConflict: result.hasConflict,
      conflicts: result.conflicts,
      message: result.firstErrorMessage || 'No conflicts detected. Slot is available!',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create timetable entry with conflict prevention
// @route   POST /api/timetable
// @access  Private (Admin only)
const createTimetableEntry = async (req, res) => {
  try {
    const {
      department,
      semester,
      section,
      subject,
      faculty,
      room,
      timeSlot,
      day,
      academicYear,
      notes,
    } = req.body;

    if (!department || !semester || !section || !subject || !faculty || !room || !timeSlot || !day) {
      return res.status(400).json({ success: false, message: 'Please provide all required timetable fields' });
    }

    // 1. Conflict Check
    const conflictResult = await checkTimetableConflict({
      faculty,
      room,
      section,
      timeSlot,
      day,
      subject,
    });

    if (conflictResult.hasConflict) {
      return res.status(409).json({
        success: false,
        conflict: true,
        message: conflictResult.firstErrorMessage,
        conflicts: conflictResult.conflicts,
      });
    }

    // 2. Create entry
    const entry = await Timetable.create({
      department,
      semester: Number(semester),
      section,
      subject,
      faculty,
      room,
      timeSlot,
      day,
      academicYear: academicYear || '2025-2026',
      notes: notes || '',
    });

    const populated = await Timetable.findById(entry._id)
      .populate('department', 'name code')
      .populate('section', 'name semester')
      .populate('subject', 'name code credits type color')
      .populate('faculty', 'name facultyId')
      .populate('room', 'roomNumber building type')
      .populate('timeSlot');

    // Create Notification for the timetable update
    await Notification.create({
      role: 'all',
      title: 'Timetable Scheduled',
      message: `New class for ${populated.subject.name} (${populated.section.name}) scheduled on ${day} with ${populated.faculty.name} in Room ${populated.room.roomNumber}.`,
      type: 'timetable_change',
    });

    res.status(201).json({
      success: true,
      message: 'Timetable entry created successfully without conflicts',
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update timetable entry with conflict prevention
// @route   PUT /api/timetable/:id
// @access  Private (Admin only)
const updateTimetableEntry = async (req, res) => {
  try {
    const {
      department,
      semester,
      section,
      subject,
      faculty,
      room,
      timeSlot,
      day,
      academicYear,
      notes,
    } = req.body;

    const entry = await Timetable.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    const updatedFaculty = faculty || entry.faculty;
    const updatedRoom = room || entry.room;
    const updatedSection = section || entry.section;
    const updatedTimeSlot = timeSlot || entry.timeSlot;
    const updatedDay = day || entry.day;
    const updatedSubject = subject || entry.subject;

    // Check conflict excluding this entry
    const conflictResult = await checkTimetableConflict({
      faculty: updatedFaculty,
      room: updatedRoom,
      section: updatedSection,
      timeSlot: updatedTimeSlot,
      day: updatedDay,
      subject: updatedSubject,
      excludeId: entry._id,
    });

    if (conflictResult.hasConflict) {
      return res.status(409).json({
        success: false,
        conflict: true,
        message: conflictResult.firstErrorMessage,
        conflicts: conflictResult.conflicts,
      });
    }

    if (department) entry.department = department;
    if (semester) entry.semester = Number(semester);
    if (section) entry.section = section;
    if (subject) entry.subject = subject;
    if (faculty) entry.faculty = faculty;
    if (room) entry.room = room;
    if (timeSlot) entry.timeSlot = timeSlot;
    if (day) entry.day = day;
    if (academicYear) entry.academicYear = academicYear;
    if (notes !== undefined) entry.notes = notes;

    const saved = await entry.save();

    const populated = await Timetable.findById(saved._id)
      .populate('department', 'name code')
      .populate('section', 'name semester')
      .populate('subject', 'name code credits type color')
      .populate('faculty', 'name facultyId')
      .populate('room', 'roomNumber building')
      .populate('timeSlot');

    // Notify about the change
    await Notification.create({
      role: 'all',
      title: 'Timetable Updated',
      message: `Timetable updated: ${populated.subject.name} on ${populated.day} rescheduled/moved to Room ${populated.room.roomNumber}.`,
      type: 'timetable_change',
    });

    res.json({
      success: true,
      message: 'Timetable entry updated successfully',
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete timetable entry
// @route   DELETE /api/timetable/:id
// @access  Private (Admin only)
const deleteTimetableEntry = async (req, res) => {
  try {
    const entry = await Timetable.findById(req.params.id)
      .populate('subject', 'name')
      .populate('section', 'name')
      .populate('faculty', 'name');

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    await Timetable.findByIdAndDelete(req.params.id);

    // Notify
    await Notification.create({
      role: 'all',
      title: 'Class Cancelled / Period Removed',
      message: `A period for ${entry.subject?.name || 'Class'} (${entry.section?.name || ''}) on ${entry.day} has been removed from the schedule.`,
      type: 'warning',
    });

    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTimetableEntries,
  getTimetableGrid,
  getTimetableById,
  checkConflictEndpoint,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
};
