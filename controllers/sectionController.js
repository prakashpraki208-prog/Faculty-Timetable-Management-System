const Section = require('../models/Section');
const Student = require('../models/Student');
const Timetable = require('../models/Timetable');

// @desc    Get all sections with filter
// @route   GET /api/sections
// @access  Private
const getSections = async (req, res) => {
  try {
    const { department, semester } = req.query;
    const query = {};

    if (department) query.department = department;
    if (semester) query.semester = Number(semester);

    const sections = await Section.find(query)
      .populate('department', 'name code')
      .sort({ semester: 1, name: 1 });

    const enriched = await Promise.all(
      sections.map(async (sec) => {
        const studentCount = await Student.countDocuments({ section: sec._id });
        const timetableCount = await Timetable.countDocuments({ section: sec._id });
        return {
          ...sec.toObject(),
          actualStudentCount: studentCount,
          timetableCount,
        };
      })
    );

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single section
// @route   GET /api/sections/:id
// @access  Private
const getSectionById = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id).populate('department');
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    res.json({ success: true, data: section });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create section
// @route   POST /api/sections
// @access  Private (Admin only)
const createSection = async (req, res) => {
  try {
    const { name, department, semester, academicYear, studentCount } = req.body;

    if (!name || !department || !semester) {
      return res.status(400).json({ success: false, message: 'Please provide Section Name, Department, and Semester' });
    }

    const existing = await Section.findOne({
      name: name.toUpperCase(),
      department,
      semester: Number(semester),
      academicYear: academicYear || '2025-2026',
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Section already exists for this department, semester and year' });
    }

    const section = await Section.create({
      name: name.toUpperCase(),
      department,
      semester: Number(semester),
      academicYear: academicYear || '2025-2026',
      studentCount: Number(studentCount) || 60,
    });

    const populated = await Section.findById(section._id).populate('department');

    res.status(201).json({ success: true, message: 'Section created successfully', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update section
// @route   PUT /api/sections/:id
// @access  Private (Admin only)
const updateSection = async (req, res) => {
  try {
    const { name, department, semester, academicYear, studentCount } = req.body;

    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    if (name) section.name = name.toUpperCase();
    if (department) section.department = department;
    if (semester) section.semester = Number(semester);
    if (academicYear) section.academicYear = academicYear;
    if (studentCount) section.studentCount = Number(studentCount);

    const updated = await section.save();
    const populated = await Section.findById(updated._id).populate('department');

    res.json({ success: true, message: 'Section updated successfully', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete section
// @route   DELETE /api/sections/:id
// @access  Private (Admin only)
const deleteSection = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const students = await Student.countDocuments({ section: section._id });
    if (students > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete section: ${students} students are enrolled in this section.`,
      });
    }

    await Timetable.deleteMany({ section: section._id });
    await Section.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
};
