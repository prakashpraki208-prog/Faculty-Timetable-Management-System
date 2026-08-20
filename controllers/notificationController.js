const Notification = require('../models/Notification');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getUserNotifications = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;

    const notifications = await Notification.find({
      $or: [
        { recipient: userId },
        { recipient: null, role: 'all' },
        { recipient: null, role: userRole },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = notifications.filter(
      (n) => !n.isReadBy || !n.isReadBy.includes(userId)
    ).length;

    res.json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications.map((n) => ({
        ...n.toObject(),
        isRead: n.isReadBy ? n.isReadBy.some((id) => id.toString() === userId.toString()) : false,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (!notification.isReadBy.includes(req.user._id)) {
      notification.isReadBy.push(req.user._id);
      await notification.save();
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    await Notification.updateMany(
      {
        $or: [
          { recipient: userId },
          { recipient: null, role: 'all' },
          { recipient: null, role: userRole },
        ],
        isReadBy: { $ne: userId },
      },
      {
        $addToSet: { isReadBy: userId },
      }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create manual notification (Admin broadcast)
// @route   POST /api/notifications
// @access  Private (Admin only)
const createNotification = async (req, res) => {
  try {
    const { title, message, role, type } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const notification = await Notification.create({
      title,
      message,
      role: role || 'all',
      type: type || 'info',
    });

    res.status(201).json({ success: true, message: 'Notification broadcasted successfully', data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
};
