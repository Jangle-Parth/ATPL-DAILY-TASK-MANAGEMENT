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
    // CHANGE: Support both single and multiple assignees
    assignedTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
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
    // ADD: Job details for easier access (for job-auto tasks only)
    jobDetails: {
        docNo: String,
        customerName: String,
        itemCode: String,
        description: String, // Job description - THIS IS THE MAIN ADDITION
        qty: Number,
        currentStage: String,
        nextStage: String
    },
    // EXISTING fields...
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
    attachments: [String],
    // ADD: Individual completion tracking (only used for manual multi-assignee tasks)
    individualCompletions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        completedAt: Date,
        remarks: String,
        attachments: [String]
    }]
}, {
    timestamps: true
});

// Index for better query performance
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ docNo: 1 });
taskSchema.index({ customerName: 1 });
taskSchema.index({ createdAt: -1 });
// In Task model
taskSchema.index({
    jobId: 1,
    'jobDetails.currentStage': 1,
    'jobDetails.nextStage': 1,
    status: 1
}, {
    unique: true,
    partialFilterExpression: {
        status: { $in: ['pending', 'pending_approval'] },
        type: 'job-auto'
    }
});

module.exports = mongoose.model('Task', taskSchema);