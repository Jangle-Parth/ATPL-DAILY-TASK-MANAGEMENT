const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    month: {
        type: String,
        required: true
    },
    docNo: {
        type: String,
        required: true,
        trim: true
    },
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    itemCode: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    qty: {
        type: Number,
        required: true,
        min: 1
    },
    week: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: [
            'sales order received',
            'drawing approved',
            'long lead item detail given',
            'drawing/bom issued',
            'production order and purchase request prepared',
            'rm received',
            'production started',
            'production completed',
            'qc clear for dispatch',
            'dispatch clearance',
            'completed'
        ],
        default: 'sales order received'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedAt: Date
}, {
    timestamps: true
});

// Create compound unique index for docNo + itemCode combination
// This ensures that the same item code can't be duplicated within the same document
jobSchema.index({ docNo: 1, itemCode: 1 }, { unique: true });

// Other indexes for better query performance
jobSchema.index({ customerName: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ docNo: 1 }); // Keep this for searching by docNo

module.exports = mongoose.model('Job', jobSchema);