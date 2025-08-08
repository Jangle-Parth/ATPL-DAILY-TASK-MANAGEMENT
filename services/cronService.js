// services/cronService.js
const cron = require('node-cron');
const emailService = require('./emailService');
const User = require('../models/User');
const Task = require('../models/Task');

class CronService {
    constructor() {
        this.jobs = [];
    }

    init() {
        // Daily task report at 9:00 AM
        const dailyJob = cron.schedule('0 9 * * *', async () => {
            await this.sendDailyTaskReports();
        }, {
            scheduled: false,
            timezone: "Asia/Kolkata" // Adjust for your timezone
        });

        // Weekly performance report on Mondays at 9:00 AM
        const weeklyJob = cron.schedule('0 9 * * 1', async () => {
            await this.sendWeeklyPerformanceReports();
        }, {
            scheduled: false,
            timezone: "Asia/Kolkata"
        });

        this.jobs.push(dailyJob, weeklyJob);

        // Start all cron jobs
        this.start();
    }

    start() {
        this.jobs.forEach(job => job.start());
        console.log('Email cron jobs started');
    }

    stop() {
        this.jobs.forEach(job => job.stop());
        console.log('Email cron jobs stopped');
    }

    async sendDailyTaskReports() {
        try {
            console.log('Starting daily task report sending...');

            const users = await User.find({
                isActive: true,
                role: 'user'
            });

            for (const user of users) {
                // Get pending tasks for this user
                const pendingTasks = await Task.find({
                    assignedTo: user._id,
                    status: { $in: ['pending', 'in_progress'] }
                }).populate('assignedBy', 'username');

                if (pendingTasks.length > 0) {
                    await emailService.sendDailyTaskReport(user, pendingTasks);

                    // Small delay to avoid overwhelming email server
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log('Daily task reports sent successfully');
        } catch (error) {
            console.error('Error sending daily task reports:', error);
        }
    }

    async sendWeeklyPerformanceReports() {
        try {
            console.log('Starting weekly performance report sending...');

            const users = await User.find({
                isActive: true,
                role: 'user'
            });

            for (const user of users) {
                const performanceData = await this.calculateWeeklyPerformance(user._id);
                await emailService.sendWeeklyPerformanceReport(user, performanceData);

                // Small delay to avoid overwhelming email server
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('Weekly performance reports sent successfully');
        } catch (error) {
            console.error('Error sending weekly performance reports:', error);
        }
    }

    async calculateWeeklyPerformance(userId) {
        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            // Get tasks from the last week
            const weeklyTasks = await Task.find({
                assignedTo: userId,
                createdAt: { $gte: oneWeekAgo }
            });

            const completedTasks = weeklyTasks.filter(task =>
                task.status === 'completed' || task.status === 'approved'
            );

            const pendingTasks = weeklyTasks.filter(task =>
                task.status === 'pending' || task.status === 'in_progress'
            );

            // Calculate on-time completion percentage
            const onTimeTasks = completedTasks.filter(task => {
                if (!task.completedAt || !task.dueDate) return false;
                return new Date(task.completedAt) <= new Date(task.dueDate);
            });

            const onTimePercentage = completedTasks.length > 0
                ? Math.round((onTimeTasks.length / completedTasks.length) * 100)
                : 0;

            // Calculate average completion time
            let totalCompletionTime = 0;
            let completedTasksWithTime = 0;

            completedTasks.forEach(task => {
                if (task.completedAt && task.createdAt) {
                    const completionTime = (new Date(task.completedAt) - new Date(task.createdAt)) / (1000 * 60 * 60); // hours
                    totalCompletionTime += completionTime;
                    completedTasksWithTime++;
                }
            });

            const averageCompletionTime = completedTasksWithTime > 0
                ? Math.round(totalCompletionTime / completedTasksWithTime)
                : 0;

            // Generate performance message
            let message = '';
            if (completedTasks.length === 0) {
                message = 'No tasks were completed this week. Consider reviewing your task management approach.';
            } else if (onTimePercentage >= 80) {
                message = 'Excellent work! You maintained high performance with great on-time delivery.';
            } else if (onTimePercentage >= 60) {
                message = 'Good progress this week. Consider improving your time management for better on-time delivery.';
            } else {
                message = 'There\'s room for improvement. Focus on prioritizing tasks and meeting deadlines.';
            }

            return {
                tasksCompleted: completedTasks.length,
                pendingTasks: pendingTasks.length,
                onTimePercentage,
                averageCompletionTime,
                message
            };
        } catch (error) {
            console.error('Error calculating weekly performance:', error);
            return {
                tasksCompleted: 0,
                pendingTasks: 0,
                onTimePercentage: 0,
                averageCompletionTime: 0,
                message: 'Unable to calculate performance data for this week.'
            };
        }
    }
}

module.exports = new CronService();