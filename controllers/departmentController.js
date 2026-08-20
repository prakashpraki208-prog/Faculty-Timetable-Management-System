const Department = require('../models/Department');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Section = require('../models/Section');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });

    // Attach counts for faculty, students, subjects, sections
    const enriched = await Promise.all(
      departments.map(async (dept) => {
        const [facultyCount, studentCount, subjectCount, sectionCount] = await Promise.all([
          Faculty.countDocuments({ department: dept._id }),
          Student.countDocuments({ department: dept._id }),
          Subject.countDocuments({ department: dept._id }),
          Section.countDocuments({ department: dept._id }),
        ]);

        return {
          ...dept.toObject(),
          facultyCount,
          studentCount,
          subjectCount,
          sectionCount,
        };
      })
    );

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single department
// @route   GET /api/departments/:id
// @access  Private
const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create department
// @route   POST /api/departments
// @access  Private (Admin only)
const createDepartment = async (req, res) => {
  try {
    const { departmentId, name, code, description } = req.body;

    if (!departmentId || !name || !code) {
      return res.status(400).json({ success: false, message: 'Please provide Department ID, Name, and Code' });
    }

    const existing = await Department.findOne({
      $or: [{ departmentId: departmentId.toUpperCase() }, { code: code.toUpperCase() }],
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Department ID or Code already exists' });
    }

    const department = await Department.create({
      departmentId: departmentId.toUpperCase(),
      name,
      code: code.toUpperCase(),
      description,
    });

    res.status(201).json({ success: true, message: 'Department created successfully', data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private (Admin only)
const updateDepartment = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    let department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    if (code && code.toUpperCase() !== department.code) {
      const codeExists = await Department.findOne({ code: code.toUpperCase(), _id: { $ne: department._id } });
      if (codeExists) {
        return res.status(400).json({ success: false, message: 'Department Code already in use' });
      }
      department.code = code.toUpperCase();
    }

    if (name) department.name = name;
    if (description !== undefined) department.description = description;

    const updatedDept = await department.save();
    res.json({ success: true, message: 'Department updated successfully', data: updatedDept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete department
// @route   DELETE /api/departments/:id
// @access  Private (Admin only)
const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Check if references exist
    const [facultyCount, studentCount] = await Promise.all([
      Faculty.countDocuments({ department: department._id }),
      Student.countDocuments({ department: department._id }),
    ]);

    if (facultyCount > 0 || studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department: ${facultyCount} faculty and ${studentCount} students are still assigned to it.`,
      });
    }

    await Department.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
