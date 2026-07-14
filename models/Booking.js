const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  startTime: {
    type: String, // HH:MM (e.g. 08:00)
    required: true,
  },
  endTime: {
    type: String, // HH:MM (e.g. 10:00)
    required: true,
  },
  totalCost: {
    type: Number,
    required: true,
  },
  specialNote: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled'],
    default: 'confirmed',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Booking', BookingSchema);
