const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Timetable = require('../models/Timetable');
const TimeSlot = require('../models/TimeSlot');

// @desc    Get all faculty members with search and department filter
// @route   GET /api/faculty
// @access  Private
const getFaculty = async (req, res) => {
  try {
    const { search, department, designation } = req.query;
    const query = {};

    if (department) {
      query.department = department;
    }

    if (designation) {
      query.designation = designation;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { facultyId: { $regex: search, $options: 'i' } },
        { qualification: { $regex: search, $options: 'i' } },
      ];
    }

    const facultyList = await Faculty.find(query)
      .populate('department', 'name code')
      .populate('user', 'email role isActive')
      .sort({ name: 1 });

    // Calculate weekly assigned periods for each faculty
    const enrichedFaculty = await Promise.all(
      facultyList.map(async (fac) => {
        const totalAssignedClasses = await Timetable.countDocuments({ faculty: fac._id });
        return {
          ...fac.toObject(),
          totalAssignedClasses,
        };
      })
    );

    res.json({ success: true, count: enrichedFaculty.length, data: enrichedFaculty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single faculty member
// @route   GET /api/faculty/:id
// @access  Private
const getFacultyById = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate('department')
      .populate('user', 'email role isActive');

    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    res.json({ success: true, data: faculty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new faculty member & user account
// @route   POST /api/faculty
// @access  Private (Admin only)
const createFaculty = async (req, res) => {
  try {
    const {
      facultyId,
      name,
      email,
      phone,
      department,
      designation,
      qualification,
      password,
      maxWeeklyHours,
      specialization,
      availableDays,
    } = req.body;

    if (!facultyId || !name || !email || !phone || !department || !qualification) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Check duplicate
    const existingFaculty = await Faculty.findOne({
      $or: [{ email: email.toLowerCase() }, { facultyId: facultyId.toUpperCase() }],
    });

    if (existingFaculty) {
      return res.status(400).json({ success: false, message: 'Faculty with this ID or email already exists' });
    }

    // Check existing User
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      return res.status(400).json({ success: false, message: 'User account with this email already exists' });
    }

    // Create User credentials
    user = await User.create({
      name,
      email: email.toLowerCase(),
      password: password || 'Faculty@123',
      role: 'faculty',
    });

    // Create Faculty Profile
    const faculty = await Faculty.create({
      facultyId: facultyId.toUpperCase(),
      user: user._id,
      name,
      email: email.toLowerCase(),
      phone,
      department,
      designation: designation || 'Assistant Professor',
      qualification,
      maxWeeklyHours: maxWeeklyHours || 20,
      specialization: specialization || '',
      availableDays: availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    });

    const populated = await Faculty.findById(faculty._id).populate('department');

    res.status(201).json({
      success: true,
      message: 'Faculty created successfully with user account',
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update faculty member
// @route   PUT /api/faculty/:id
// @access  Private (Admin only)
const updateFaculty = async (req, res) => {
  try {
    const {
      name,
      phone,
      department,
      designation,
      qualification,
      maxWeeklyHours,
      specialization,
      availableDays,
      password,
    } = req.body;

    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    if (name) faculty.name = name;
    if (phone) faculty.phone = phone;
    if (department) faculty.department = department;
    if (designation) faculty.designation = designation;
    if (qualification) faculty.qualification = qualification;
    if (maxWeeklyHours) faculty.maxWeeklyHours = maxWeeklyHours;
    if (specialization !== undefined) faculty.specialization = specialization;
    if (availableDays) faculty.availableDays = availableDays;

    const updatedFaculty = await faculty.save();

    // Update associated user if name or password changed
    const user = await User.findById(faculty.user);
    if (user) {
      if (name) user.name = name;
      if (password) user.password = password;
      await user.save();
    }

    const populated = await Faculty.findById(updatedFaculty._id).populate('department');
    res.json({ success: true, message: 'Faculty updated successfully', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete faculty member
// @route   DELETE /api/faculty/:id
// @access  Private (Admin only)
const deleteFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    // Delete associated timetable entries and user account
    await Timetable.deleteMany({ faculty: faculty._id });
    await User.findByIdAndDelete(faculty.user);
    await Faculty.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Faculty and associated user/timetable records removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get personal timetable for faculty
// @route   GET /api/faculty/:id/timetable
// @access  Private
const getFacultyTimetable = async (req, res) => {
  try {
    const facultyId = req.params.id;

    const entries = await Timetable.find({ faculty: facultyId })
      .populate('subject', 'name code credits type color')
      .populate('room', 'roomNumber building type capacity')
      .populate('section', 'name semester academicYear')
      .populate('department', 'name code')
      .populate('timeSlot')
      .sort({ 'timeSlot.slotOrder': 1 });

    res.json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get workload analytics for faculty member
// @route   GET /api/faculty/:id/workload
// @access  Private
const getFacultyWorkload = async (req, res) => {
  try {
    const facultyId = req.params.id;
    const faculty = await Faculty.findById(facultyId).populate('department');

    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    const entries = await Timetable.find({ faculty: facultyId })
      .populate('subject')
      .populate('timeSlot')
      .populate('section');

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const totalSlotsPerDay = await TimeSlot.countDocuments({ isBreak: false });
    // If timeslots are configured per day, get max slots
    const uniqueTimeSlotCount = (await TimeSlot.distinct('startTime')).length || 6;
    const totalWeeklyPossiblePeriods = uniqueTimeSlotCount * 6; // 6 teaching days

    const dailyWorkload = {};
    days.forEach((day) => {
      dailyWorkload[day] = 0;
    });

    entries.forEach((entry) => {
      if (dailyWorkload[entry.day] !== undefined) {
        dailyWorkload[entry.day] += 1;
      }
    });

    const totalWeeklyClasses = entries.length;
    const maxHours = faculty.maxWeeklyHours || 20;
    const freePeriods = Math.max(0, totalWeeklyPossiblePeriods - totalWeeklyClasses);

    // Group assigned subjects
    const subjectsMap = {};
    entries.forEach((entry) => {
      if (entry.subject) {
        const subId = entry.subject._id.toString();
        if (!subjectsMap[subId]) {
          subjectsMap[subId] = {
            subject: entry.subject,
            sections: new Set(),
            classesCount: 0,
          };
        }
        subjectsMap[subId].classesCount += 1;
        if (entry.section) {
          subjectsMap[subId].sections.add(entry.section.name);
        }
      }
    });

    const subjects = Object.values(subjectsMap).map((item) => ({
      subject: item.subject,
      sections: Array.from(item.sections),
      classesCount: item.classesCount,
    }));

    res.json({
      success: true,
      data: {
        faculty,
        totalWeeklyClasses,
        maxWeeklyHours: maxHours,
        freePeriods,
        utilizationPercentage: Math.round((totalWeeklyClasses / maxHours) * 100),
        dailyWorkload,
        dailyWorkloadArray: Object.entries(dailyWorkload).map(([day, count]) => ({ day, count })),
        subjects,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get subjects taught by faculty
// @route   GET /api/faculty/:id/subjects
// @access  Private
const getFacultySubjects = async (req, res) => {
  try {
    const facultyId = req.params.id;

    const entries = await Timetable.find({ faculty: facultyId })
      .populate('subject')
      .populate('department')
      .populate('section');

    const uniqueSubjects = [];
    const seen = new Set();

    entries.forEach((e) => {
      if (e.subject && !seen.has(e.subject._id.toString())) {
        seen.add(e.subject._id.toString());
        uniqueSubjects.push({
          ...e.subject.toObject(),
          section: e.section ? e.section.name : '',
          semester: e.semester,
        });
      }
    });

    res.json({ success: true, count: uniqueSubjects.length, data: uniqueSubjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  getFacultyTimetable,
  getFacultyWorkload,
  getFacultySubjects,
};
