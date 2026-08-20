const Room = require('../models/Room');
const Timetable = require('../models/Timetable');

// @desc    Get all rooms with search & filter
// @route   GET /api/rooms
// @access  Private
const getRooms = async (req, res) => {
  try {
    const { search, type, building } = req.query;
    const query = {};

    if (type) query.type = type;
    if (building) query.building = { $regex: building, $options: 'i' };

    if (search) {
      query.$or = [
        { roomNumber: { $regex: search, $options: 'i' } },
        { building: { $regex: search, $options: 'i' } },
      ];
    }

    const rooms = await Room.find(query).sort({ roomNumber: 1 });

    // Calculate weekly assigned periods for each room
    const enrichedRooms = await Promise.all(
      rooms.map(async (rm) => {
        const assignedClasses = await Timetable.countDocuments({ room: rm._id });
        return {
          ...rm.toObject(),
          assignedClasses,
        };
      })
    );

    res.json({ success: true, count: enrichedRooms.length, data: enrichedRooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Private
const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new room
// @route   POST /api/rooms
// @access  Private (Admin only)
const createRoom = async (req, res) => {
  try {
    const { roomNumber, type, building, floor, capacity, isAvailable } = req.body;

    if (!roomNumber || !building || !capacity) {
      return res.status(400).json({ success: false, message: 'Please provide Room Number, Building, and Capacity' });
    }

    const existing = await Room.findOne({ roomNumber: roomNumber.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Room number already exists' });
    }

    const room = await Room.create({
      roomNumber: roomNumber.toUpperCase(),
      type: type || 'Classroom',
      building,
      floor: floor || '1st Floor',
      capacity: Number(capacity),
      isAvailable: isAvailable !== undefined ? isAvailable : true,
    });

    res.status(201).json({ success: true, message: 'Room created successfully', data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private (Admin only)
const updateRoom = async (req, res) => {
  try {
    const { type, building, floor, capacity, isAvailable } = req.body;

    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (type) room.type = type;
    if (building) room.building = building;
    if (floor) room.floor = floor;
    if (capacity) room.capacity = Number(capacity);
    if (isAvailable !== undefined) room.isAvailable = isAvailable;

    const updated = await room.save();
    res.json({ success: true, message: 'Room updated successfully', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete room
// @route   DELETE /api/rooms/:id
// @access  Private (Admin only)
const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const count = await Timetable.countDocuments({ room: room._id });
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete room: It is currently booked for ${count} timetable periods.`,
      });
    }

    await Room.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
};
