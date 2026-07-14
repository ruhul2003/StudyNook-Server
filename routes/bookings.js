const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// @route   POST /api/bookings
// @desc    Book a room (Private)
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, specialNote } = req.body;

    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Missing booking details.' });
    }

    // Verify room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    // Calculate total cost
    const startHour = parseInt(startTime.split(':')[0], 10);
    const endHour = parseInt(endTime.split(':')[0], 10);
    
    if (endHour <= startHour) {
      return res.status(400).json({ message: 'End time must be after start time.' });
    }

    const totalCost = (endHour - startHour) * room.hourlyRate;

    // Booking Conflict Check
    // Overlap condition: (request.startTime < existing.endTime) AND (request.endTime > existing.startTime)
    const conflict = await Booking.findOne({
      roomId,
      date,
      status: 'confirmed',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });

    if (conflict) {
      return res.status(400).json({
        message: 'Booking conflict! This room is already booked during the selected time slot.',
      });
    }

    // Create booking
    const booking = new Booking({
      roomId,
      userId: req.user.id,
      date,
      startTime,
      endTime,
      totalCost,
      specialNote: specialNote || '',
      status: 'confirmed',
    });

    const savedBooking = await booking.save();

    // 1. Push booking ID to user's bookings array
    await User.findByIdAndUpdate(req.user.id, {
      $push: { bookings: savedBooking._id },
    });

    // 2. Increment room's booking count
    await Room.findByIdAndUpdate(roomId, {
      $inc: { bookingCount: 1 },
    });

    res.status(201).json({
      message: 'Room booked successfully!',
      booking: savedBooking,
    });
  } catch (error) {
    console.error('Booking creation error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bookings/my
// @desc    Get bookings of the logged-in user (Private)
// @access  Private
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .populate('roomId', 'name image hourlyRate floor')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    console.error('Fetch my bookings error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/bookings/:id/cancel
// @desc    Cancel a booking (Private)
// @access  Private
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Check if the booking belongs to the user
    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized action.' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled.' });
    }

    // Update status to cancelled
    booking.status = 'cancelled';
    await booking.save();

    // Remove booking ID from user's bookings array
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { bookings: booking._id },
    });

    // Decrement room's booking count
    await Room.findByIdAndUpdate(booking.roomId, {
      $inc: { bookingCount: -1 },
    });

    res.json({ message: 'Booking cancelled successfully.' });
  } catch (error) {
    console.error('Cancel booking error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
