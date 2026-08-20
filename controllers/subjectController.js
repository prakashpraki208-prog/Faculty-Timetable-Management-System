const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#84CC16', // Lime
];

// @desc    Get all subjects with search and filters
// @route   GET /api/subjects
// @access  Private
const getSubjects = async (req, res) => {
  try {
    const { search, department, semester, type } = req.query;
    const query = {};

    if (department) query.department = department;
    if (semester) query.semester = Number(semester);
    if (type) query.type = type;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const subjects = await Subject.find(query)
      .populate('department', 'name code')
      .sort({ semester: 1, code: 1 });

    res.json({ success: true, count: subjects.length, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single subject
// @route   GET /api/subjects/:id
// @access  Private
const getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('department');
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    res.json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new subject
// @route   POST /api/subjects
// @access  Private (Admin only)
const createSubject = async (req, res) => {
  try {
    const { code, name, department, semester, credits, type, weeklyHours, color } = req.body;

    if (!code || !name || !department || !semester) {
      return res.status(400).json({ success: false, message: 'Please provide Code, Name, Department, and Semester' });
    }

    const existing = await Subject.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Subject code already exists' });
    }

    // Pick random palette color if not specified
    const selectedColor = color || COLORS[Math.floor(Math.random() * COLORS.length)];

    const subject = await Subject.create({
      code: code.toUpperCase(),
      name,
      department,
      semester: Number(semester),
      credits: Number(credits) || 3,
      type: type || 'Theory',
      weeklyHours: Number(weeklyHours) || (type === 'Laboratory' ? 3 : 4),
      color: selectedColor,
    });

    const populated = await Subject.findById(subject._id).populate('department');

    res.status(201).json({ success: true, message: 'Subject created successfully', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update subject
// @route   PUT /api/subjects/:id
// @access  Private (Admin only)
const updateSubject = async (req, res) => {
  try {
    const { name, department, semester, credits, type, weeklyHours, color } = req.body;

    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    if (name) subject.name = name;
    if (department) subject.department = department;
    if (semester) subject.semester = Number(semester);
    if (credits) subject.credits = Number(credits);
    if (type) subject.type = type;
    if (weeklyHours) subject.weeklyHours = Number(weeklyHours);
    if (color) subject.color = color;

    const updated = await subject.save();
    const populated = await Subject.findById(updated._id).populate('department');

    res.json({ success: true, message: 'Subject updated successfully', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete subject
// @route   DELETE /api/subjects/:id
// @access  Private (Admin only)
const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    // Check if timetable entries use this subject
    const timetableCount = await Timetable.countDocuments({ subject: subject._id });
    if (timetableCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete subject: It is assigned to ${timetableCount} timetable periods.`,
      });
    }

    await Subject.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
};
