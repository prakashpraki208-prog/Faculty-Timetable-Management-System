const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Department = require('../models/Department');
const Room = require('../models/Room');
const Section = require('../models/Section');
const Timetable = require('../models/Timetable');
const TimeSlot = require('../models/TimeSlot');

// @desc    Get overall dashboard analytics & stats
// @route   GET /api/reports/dashboard-stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalFaculty,
      totalStudents,
      totalSubjects,
      totalDepartments,
      totalRooms,
      totalSections,
      totalTimetableEntries,
    ] = await Promise.all([
      Faculty.countDocuments(),
      Student.countDocuments(),
      Subject.countDocuments(),
      Department.countDocuments(),
      Room.countDocuments(),
      Section.countDocuments(),
      Timetable.countDocuments(),
    ]);

    // Workload breakdown by faculty
    const facultyList = await Faculty.find().populate('department', 'code');
    const facultyWorkloadData = await Promise.all(
      facultyList.map(async (fac) => {
        const count = await Timetable.countDocuments({ faculty: fac._id });
        return {
          name: fac.name.split(' ')[0] + ' ' + (fac.name.split(' ')[1] || ''),
          fullName: fac.name,
          department: fac.department?.code || 'N/A',
          assignedClasses: count,
          maxHours: fac.maxWeeklyHours || 20,
        };
      })
    );

    // Room utilization breakdown
    const roomList = await Room.find();
    const totalSlots = (await TimeSlot.distinct('startTime')).length * 6 || 36; // 6 slots x 6 days
    const roomUtilizationData = await Promise.all(
      roomList.map(async (rm) => {
        const count = await Timetable.countDocuments({ room: rm._id });
        return {
          roomNumber: rm.roomNumber,
          type: rm.type,
          capacity: rm.capacity,
          bookedHours: count,
          utilizationRate: Math.min(100, Math.round((count / totalSlots) * 100)),
        };
      })
    );

    // Subject breakdown by type
    const subjectsByType = await Subject.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    // Timetable distribution across days
    const dayDistribution = await Timetable.aggregate([
      {
        $group: {
          _id: '$day',
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          totalFaculty,
          totalStudents,
          totalSubjects,
          totalDepartments,
          totalRooms,
          totalSections,
          totalTimetableEntries,
          conflictsCount: 0, // Since conflict detection strictly prevents saving invalid states
        },
        facultyWorkload: facultyWorkloadData,
        roomUtilization: roomUtilizationData,
        subjectsByType,
        dayDistribution,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Faculty Workload Detailed Report
// @route   GET /api/reports/faculty-workload
// @access  Private
const getFacultyWorkloadReport = async (req, res) => {
  try {
    const faculty = await Faculty.find().populate('department', 'name code').sort({ name: 1 });

    const report = await Promise.all(
      faculty.map(async (fac) => {
        const entries = await Timetable.find({ faculty: fac._id })
          .populate('subject', 'name code type')
          .populate('section', 'name semester')
          .populate('room', 'roomNumber');

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayWise = {};
        days.forEach((d) => (dayWise[d] = 0));

        const subjectSet = new Set();
        entries.forEach((e) => {
          if (dayWise[e.day] !== undefined) dayWise[e.day]++;
          if (e.subject) subjectSet.add(e.subject.name);
        });

        const totalAssigned = entries.length;
        const maxHours = fac.maxWeeklyHours || 20;

        return {
          facultyId: fac.facultyId,
          name: fac.name,
          email: fac.email,
          designation: fac.designation,
          department: fac.department ? fac.department.name : 'N/A',
          departmentCode: fac.department ? fac.department.code : 'N/A',
          maxWeeklyHours: maxHours,
          assignedHours: totalAssigned,
          freeHours: Math.max(0, 36 - totalAssigned),
          loadPercentage: Math.round((totalAssigned / maxHours) * 100),
          dayWise,
          subjectsTaught: Array.from(subjectSet),
        };
      })
    );

    res.json({ success: true, count: report.length, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Room Utilization Detailed Report
// @route   GET /api/reports/room-utilization
// @access  Private
const getRoomUtilizationReport = async (req, res) => {
  try {
    const rooms = await Room.find().sort({ roomNumber: 1 });
    const totalWeeklySlots = 36; // 6 slots per day * 6 days

    const report = await Promise.all(
      rooms.map(async (rm) => {
        const entries = await Timetable.find({ room: rm._id })
          .populate('subject', 'name code')
          .populate('faculty', 'name')
          .populate('section', 'name');

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayWise = {};
        days.forEach((d) => (dayWise[d] = 0));

        entries.forEach((e) => {
          if (dayWise[e.day] !== undefined) dayWise[e.day]++;
        });

        const totalBooked = entries.length;
        const utilizationRate = Math.round((totalBooked / totalWeeklySlots) * 100);

        return {
          roomNumber: rm.roomNumber,
          type: rm.type,
          building: rm.building,
          floor: rm.floor,
          capacity: rm.capacity,
          isAvailable: rm.isAvailable,
          bookedHours: totalBooked,
          availableHours: Math.max(0, totalWeeklySlots - totalBooked),
          utilizationRate,
          dayWise,
        };
      })
    );

    res.json({ success: true, count: report.length, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Department Timetable Summary Report
// @route   GET /api/reports/department-summary
// @access  Private
const getDepartmentReport = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });

    const report = await Promise.all(
      departments.map(async (dept) => {
        const [facultyCount, studentCount, subjectCount, sectionCount, timetableCount] =
          await Promise.all([
            Faculty.countDocuments({ department: dept._id }),
            Student.countDocuments({ department: dept._id }),
            Subject.countDocuments({ department: dept._id }),
            Section.countDocuments({ department: dept._id }),
            Timetable.countDocuments({ department: dept._id }),
          ]);

        return {
          departmentId: dept.departmentId,
          name: dept.name,
          code: dept.code,
          facultyCount,
          studentCount,
          subjectCount,
          sectionCount,
          scheduledClassesCount: timetableCount,
        };
      })
    );

    res.json({ success: true, count: report.length, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Subject Allocation Report
// @route   GET /api/reports/subject-allocation
// @access  Private
const getSubjectAllocationReport = async (req, res) => {
  try {
    const subjects = await Subject.find().populate('department', 'name code').sort({ semester: 1, name: 1 });

    const report = await Promise.all(
      subjects.map(async (sub) => {
        const entries = await Timetable.find({ subject: sub._id })
          .populate('faculty', 'name designation')
          .populate('section', 'name semester')
          .populate('room', 'roomNumber');

        const facultySet = new Set();
        const sectionSet = new Set();

        entries.forEach((e) => {
          if (e.faculty) facultySet.add(e.faculty.name);
          if (e.section) sectionSet.add(e.section.name);
        });

        return {
          code: sub.code,
          name: sub.name,
          department: sub.department ? sub.department.code : 'N/A',
          semester: sub.semester,
          credits: sub.credits,
          type: sub.type,
          weeklyRequiredHours: sub.weeklyHours,
          weeklyScheduledHours: entries.length,
          fulfillmentPercentage: Math.min(100, Math.round((entries.length / (sub.weeklyHours || 4)) * 100)),
          assignedFaculty: Array.from(facultySet),
          assignedSections: Array.from(sectionSet),
        };
      })
    );

    res.json({ success: true, count: report.length, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getFacultyWorkloadReport,
  getRoomUtilizationReport,
  getDepartmentReport,
  getSubjectAllocationReport,
};
