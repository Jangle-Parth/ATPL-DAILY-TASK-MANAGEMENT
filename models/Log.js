const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    details: {
        type: String,
        required: true
    },
    ipAddress: String,
    userAgent: String
}, {
    timestamps: true
});

// Index for better query performance
logSchema.index({ createdAt: -1 });
logSchema.index({ userId: 1 });
logSchema.index({ action: 1 });

module.exports = mongoose.model('Log', logSchema);