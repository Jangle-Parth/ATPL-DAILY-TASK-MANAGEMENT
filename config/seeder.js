const mongoose = require('mongoose');
const User = require('../models/User');

const seedDatabase = async () => {
    try {
        // Check if super admin exists
        const existingSuperAdmin = await User.findOne({ role: 'super-admin' });

        if (!existingSuperAdmin) {
            // Create default users
            const defaultUsers = [
                {
                    username: 'superadmin',
                    email: 'superadmin@atpl.com',
                    password: 'admin123',
                    role: 'super-admin',
                    department: 'management'
                },
                {
                    username: 'admin',
                    email: 'admin@atpl.com',
                    password: 'admin123',
                    role: 'admin',
                    department: 'administration'
                }
            ];

            await User.insertMany(defaultUsers);
            console.log('Default users created successfully');
        } else {
            console.log('Default users already exist');
        }
    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

module.exports = seedDatabase;