const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'super-admin', 'system'], // Added 'system'
        default: 'user'
    },
    department: {
        type: String,
        enum: ['sales', 'design', 'planning', 'purchase', 'production', 'quality', 'management', 'administration', 'system'], // Added 'system'
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return candidatePassword === this.password;
};

module.exports = mongoose.model('User', userSchema);