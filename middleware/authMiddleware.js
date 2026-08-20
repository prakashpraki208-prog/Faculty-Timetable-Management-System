const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_smart_faculty_timetable_management_2026');

      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      // Attach profile info if faculty or student
      if (req.user.role === 'faculty') {
        req.facultyProfile = await Faculty.findOne({ user: req.user._id }).populate('department');
      } else if (req.user.role === 'student') {
        req.studentProfile = await Student.findOne({ user: req.user._id })
          .populate('department')
          .populate('section');
      }

      next();
    } catch (error) {
      console.error('Auth token validation error:', error.message);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
