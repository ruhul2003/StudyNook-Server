const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/rooms
// @desc    Get all rooms with search, filter, and sorting
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { search, amenities, floor, minRate, maxRate, limit } = req.query;
    let query = {};

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Filter by amenities (using $in)
    if (amenities) {
      const amenitiesList = Array.isArray(amenities) ? amenities : amenities.split(',');
      if (amenitiesList.length > 0) {
        query.amenities = { $in: amenitiesList };
      }
    }

    // Filter by floor
    if (floor) {
      query.floor = floor;
    }

    // Filter by hourly rate range
    if (minRate || maxRate) {
      query.hourlyRate = {};
      if (minRate) query.hourlyRate.$gte = Number(minRate);
      if (maxRate) query.hourlyRate.$lte = Number(maxRate);
    }

    // Sort by latest (createdAt: -1)
    let roomsQuery = Room.find(query).sort({ createdAt: -1 });

    if (limit) {
      roomsQuery = roomsQuery.limit(Number(limit));
    }

    const rooms = await roomsQuery;
    res.json(rooms);
  } catch (error) {
    console.error('Fetch rooms error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/rooms/:id
// @desc    Get specific room by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.id || req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Fetch room by ID error:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/rooms
// @desc    Add a new room
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, image, floor, capacity, hourlyRate, amenities } = req.body;

    if (!name || !description || !image || !floor || !capacity || !hourlyRate) {
      return res.status(400).json({ message: 'Please enter all required fields' });
    }

    const newRoom = new Room({
      name,
      description,
      image,
      floor,
      capacity: Number(capacity),
      hourlyRate: Number(hourlyRate),
      amenities: Array.isArray(amenities) ? amenities : [],
      ownerId: req.user.id,
    });

    const room = await newRoom.save();
    res.status(201).json({ message: 'Room added successfully', room });
  } catch (error) {
    console.error('Add room error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rooms/:id
// @desc    Update an existing room (owner only)
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description, image, floor, capacity, hourlyRate, amenities } = req.body;
    let room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check ownership
    if (room.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized. You do not own this room.' });
    }

    const updatedData = {
      name: name || room.name,
      description: description || room.description,
      image: image || room.image,
      floor: floor || room.floor,
      capacity: capacity ? Number(capacity) : room.capacity,
      hourlyRate: hourlyRate ? Number(hourlyRate) : room.hourlyRate,
      amenities: Array.isArray(amenities) ? amenities : room.amenities,
    };

    room = await Room.findByIdAndUpdate(
      req.params.id,
      { $set: updatedData },
      { new: true }
    );

    res.json({ message: 'Room updated successfully', room });
  } catch (error) {
    console.error('Update room error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/rooms/:id
// @desc    Delete a room (owner only)
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check ownership
    if (room.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized. You do not own this room.' });
    }

    // Find all bookings referencing this room
    const bookings = await Booking.find({ roomId: req.params.id });
    const bookingIds = bookings.map(b => b._id);

    // Pull booking IDs from user profiles
    if (bookingIds.length > 0) {
      await User.updateMany(
        { bookings: { $in: bookingIds } },
        { $pull: { bookings: { $in: bookingIds } } }
      );
      // Delete the bookings associated with the room
      await Booking.deleteMany({ roomId: req.params.id });
    }

    // Delete the room
    await Room.findByIdAndDelete(req.params.id);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
