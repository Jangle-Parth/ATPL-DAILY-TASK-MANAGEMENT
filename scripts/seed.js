require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const Task = require('../models/Task');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

const seedData = async () => {
    try {
        // Clear existing data
        await User.deleteMany({});
        await Job.deleteMany({});
        await Task.deleteMany({});

        console.log('Cleared existing data');

        // Create default users
        const users = await User.insertMany([
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
            },
            {
                username: 'john_sales',
                email: 'john@atpl.com',
                password: 'user123',
                role: 'user',
                department: 'sales'
            },
            {
                username: 'sarah_design',
                email: 'sarah@atpl.com',
                password: 'user123',
                role: 'user',
                department: 'design'
            },
            {
                username: 'mike_production',
                email: 'mike@atpl.com',
                password: 'user123',
                role: 'user',
                department: 'production'
            },
            {
                username: 'lisa_quality',
                email: 'lisa@atpl.com',
                password: 'user123',
                role: 'user',
                department: 'quality'
            }
        ]);

        console.log('Created default users');

        // Create sample jobs
        const jobs = await Job.insertMany([
            {
                month: 'Jan-2025',
                docNo: 'SO-2025-001',
                customerName: 'ABC Manufacturing',
                itemCode: 'ITEM-001',
                description: 'Custom Steel Component',
                qty: 100,
                week: 'Week-1',
                status: 'sales order received',
                createdBy: users[1]._id // admin
            },
            {
                month: 'Jan-2025',
                docNo: 'SO-2025-002',
                customerName: 'XYZ Industries',
                itemCode: 'ITEM-002',
                description: 'Precision Machine Part',
                qty: 50,
                week: 'Week-1',
                status: 'drawing approved',
                createdBy: users[1]._id // admin
            }
        ]);

        console.log('Created sample jobs');

        // Create sample tasks
        const tasks = await Task.insertMany([
            {
                title: 'Review customer specifications',
                description: 'Review and validate customer requirements for SO-2025-001',
                assignedTo: users[2]._id, // john_sales
                assignedBy: users[1]._id, // admin
                priority: 'high',
                status: 'pending',
                type: 'admin',
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
                jobId: jobs[0]._id,
                docNo: jobs[0].docNo,
                customerName: jobs[0].customerName
            },
            {
                title: 'Design review for precision part',
                description: 'Complete design review and technical specifications for XYZ Industries order',
                assignedTo: users[3]._id, // sarah_design
                assignedBy: users[1]._id, // admin
                priority: 'medium',
                status: 'pending',
                type: 'admin',
                dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
                jobId: jobs[1]._id,
                docNo: jobs[1].docNo,
                customerName: jobs[1].customerName
            },
            {
                title: 'Quality inspection checklist',
                description: 'Prepare quality inspection checklist for upcoming production run',
                assignedTo: users[5]._id, // lisa_quality
                assignedBy: users[0]._id, // superadmin
                priority: 'medium',
                status: 'pending',
                type: 'super-admin',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            },
            {
                title: 'Production planning meeting',
                description: 'Attend weekly production planning meeting and update schedules',
                assignedTo: users[4]._id, // mike_production
                assignedBy: users[4]._id, // self-assigned
                priority: 'low',
                status: 'completed',
                type: 'user',
                dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // yesterday
                completedAt: new Date(),
                approvedAt: new Date(),
                approvedBy: users[4]._id
            }
        ]);

        console.log('Created sample tasks');
        console.log('\nSeed data created successfully!');
        console.log('\nDefault login credentials:');
        console.log('Super Admin: superadmin / admin123');
        console.log('Admin: admin / admin123');
        console.log('Users: john_sales, sarah_design, mike_production, lisa_quality / user123');

    } catch (error) {
        console.error('Error seeding data:', error);
    } finally {
        mongoose.connection.close();
    }
};

const main = async () => {
    await connectDB();
    await seedData();
};

main();