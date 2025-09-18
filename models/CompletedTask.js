const mongoose = require('mongoose');

const completedTaskSchema = new mongoose.Schema({
    // Original task data
    originalTaskId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
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
    jobDetails: {
        docNo: String,
        customerName: String,
        itemCode: String,
        description: String,
        qty: Number,
        currentStage: String,
        nextStage: String
    },

    // Completion data
    completedAt: {
        type: Date,
        required: true
    },
    approvedAt: {
        type: Date,
        required: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    completionRemarks: String,
    completionAttachments: [String],

    // Original task metadata
    originalDueDate: Date,
    originalCreatedAt: Date,

    // Completion performance metrics
    completionDays: Number, // Days taken to complete
    wasOnTime: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

completedTaskSchema.index({ assignedTo: 1, approvedAt: -1 });
completedTaskSchema.index({ type: 1, approvedAt: -1 });
completedTaskSchema.index({ approvedAt: -1 });

module.exports = mongoose.model('CompletedTask', completedTaskSchema);