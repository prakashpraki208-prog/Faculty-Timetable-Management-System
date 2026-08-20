const Student = require('../models/Student');
const User = require('../models/User');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');

// @desc    Get all students with search & filters
// @route   GET /api/students
// @access  Private
const getStudents = async (req, res) => {
  try {
    const { search, department, semester, section } = req.query;
    const query = {};

    if (department) query.department = department;
    if (semester) query.semester = semester;
    if (section) query.section = section;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { rollNo: { $regex: search, $options: 'i' } },
      ];
    }

    const students = await Student.find(query)
      .populate('department', 'name code')
      .populate('section', 'name semester')
      .populate('user', 'email role isActive')
      .sort({ studentId: 1 });

    res.json({ success: true, count: students.length, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('department')
      .populate('section')
      .populate('user', 'email role isActive');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new student & user account
// @route   POST /api/students
// @access  Private (Admin only)
const createStudent = async (req, res) => {
  try {
    const {
      studentId,
      name,
      email,
      phone,
      department,
      semester,
      section,
      rollNo,
      password,
    } = req.body;

    if (!studentId || !name || !email || !phone || !department || !semester || !section) {
      return res.status(400).json({ success: false, message: 'Please provide all required student fields' });
    }

    // Check duplicate
    const existing = await Student.findOne({
      $or: [{ studentId: studentId.toUpperCase() }, { email: email.toLowerCase() }],
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Student with this ID or Email already exists' });
    }

    // Create User
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: password || 'Student@123',
      role: 'student',
    });

    const student = await Student.create({
      studentId: studentId.toUpperCase(),
      user: user._id,
      name,
      email: email.toLowerCase(),
      phone,
      department,
      semester,
      section,
      rollNo: rollNo || studentId.toUpperCase(),
    });

    const populated = await Student.findById(student._id)
      .populate('department')
      .populate('section');

    res.status(201).json({
      success: true,
      message: 'Student created successfully with user account',
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private (Admin only)
const updateStudent = async (req, res) => {
  try {
    const { name, phone, department, semester, section, rollNo, password } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (name) student.name = name;
    if (phone) student.phone = phone;
    if (department) student.department = department;
    if (semester) student.semester = semester;
    if (section) student.section = section;
    if (rollNo) student.rollNo = rollNo;

    const updated = await student.save();

    if (password) {
      const user = await User.findById(student.user);
      if (user) {
        user.password = password;
        await user.save();
      }
    }

    const populated = await Student.findById(updated._id)
      .populate('department')
      .populate('section');

    res.json({ success: true, message: 'Student updated successfully', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private (Admin only)
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await User.findByIdAndDelete(student.user);
    await Student.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get section timetable for student
// @route   GET /api/students/:id/timetable
// @access  Private
const getStudentTimetable = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const entries = await Timetable.find({
      section: student.section,
    })
      .populate('subject', 'name code credits type color')
      .populate('faculty', 'name facultyId designation')
      .populate('room', 'roomNumber building type capacity')
      .populate('timeSlot')
      .populate('department', 'name code')
      .sort({ 'timeSlot.slotOrder': 1 });

    res.json({
      success: true,
      count: entries.length,
      student,
      data: entries,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get subjects for student's department and semester
// @route   GET /api/students/:id/subjects
// @access  Private
const getStudentSubjects = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('section');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const subjects = await Subject.find({
      department: student.department,
      semester: student.semester,
    }).populate('department', 'name code');

    // Find assigned faculty for each subject in this student's section
    const enrichedSubjects = await Promise.all(
      subjects.map(async (subj) => {
        const timetableEntry = await Timetable.findOne({
          section: student.section,
          subject: subj._id,
        })
          .populate('faculty', 'name designation email')
          .populate('room', 'roomNumber building');

        return {
          ...subj.toObject(),
          assignedFaculty: timetableEntry ? timetableEntry.faculty : null,
          assignedRoom: timetableEntry ? timetableEntry.room : null,
        };
      })
    );

    res.json({ success: true, count: enrichedSubjects.length, data: enrichedSubjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentTimetable,
  getStudentSubjects,
};
