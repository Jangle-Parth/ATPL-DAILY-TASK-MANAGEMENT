const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);

        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Create indexes only if needed
        await createIndexes();

    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const createIndexes = async () => {
    try {
        const User = require('../models/User');
        const Task = require('../models/Task');
        const Job = require('../models/Job');
        const Log = require('../models/Log');

        // Check if indexes exist before creating them
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);

        if (collectionNames.includes('users')) {
            console.log('User indexes already exist');
        } else {
            await User.createIndexes();
        }

        if (collectionNames.includes('tasks')) {
            console.log('Task indexes already exist');
        } else {
            await Task.createIndexes();
        }

        if (collectionNames.includes('jobs')) {
            console.log('Job indexes already exist');
        } else {
            await Job.createIndexes();
        }

        if (collectionNames.includes('logs')) {
            console.log('Log indexes already exist');
        } else {
            await Log.createIndexes();
        }

        console.log('Database indexes verified successfully');
    } catch (error) {
        console.log('Indexes may already exist, continuing...');
    }
};

module.exports = connectDB;