const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'pending_approval', 'completed', 'rejected'],
        default: 'pending'
    },
    type: {
        type: String,
        enum: ['manual', 'job-auto', 'admin', 'super-admin', 'user'],
        default: 'manual'
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        default: null
    },
    docNo: String,
    customerName: String,
    itemCode: String,
    qty: Number,
    currentStage: String,
    nextStage: String,
    dueDate: {
        type: Date,
        required: true
    },
    completedAt: Date,
    approvedAt: Date,
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectedAt: Date,
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    completionRemarks: String,
    rejectionReason: String,
    statusChangeReason: String,
    statusChangedAt: Date,
    completionAttachments: [String],
    attachments: [String]
}, {
    timestamps: true
});

// Index for better query performance
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ docNo: 1 });
taskSchema.index({ customerName: 1 });
taskSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Task', taskSchema);