// services/emailService.js
const nodemailer = require('nodemailer');

// Email configuration - add these to your .env file
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, // your email
        pass: process.env.EMAIL_PASS  // your app password
    }
});

// Email templates
const emailTemplates = {
    taskAssigned: (user, task) => ({
        subject: `New Task Assigned: ${task.title}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #3b82f6;">New Task Assigned</h2>
                <p>Dear ${user.username},</p>
                <p>You have been assigned a new task:</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1e40af;">${task.title}</h3>
                    <p style="margin: 5px 0;"><strong>Description:</strong> ${task.description}</p>
                    <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="color: ${task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'};">${task.priority.toUpperCase()}</span></p>
                    <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>
                    ${task.assignedBy ? `<p style="margin: 5px 0;"><strong>Assigned by:</strong> ${task.assignedBy.username}</p>` : ''}
                </div>
                <p>Please log in to the system to view and complete this task.</p>
                <p style="color: #64748b; font-size: 12px;">This is an automated email from ATPL Task Management System.</p>
            </div>
        `
    }),

    dailyPendingTasks: (user, tasks) => ({
        subject: `Daily Report: ${tasks.length} Pending Tasks`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #3b82f6;">Daily Task Report</h2>
                <p>Good morning ${user.username},</p>
                <p>You have <strong>${tasks.length}</strong> pending tasks:</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    ${tasks.map(task => `
                        <div style="border-bottom: 1px solid #e2e8f0; padding: 10px 0;">
                            <h4 style="margin: 0 0 5px 0; color: #1e40af;">${task.title}</h4>
                            <p style="margin: 0; color: #64748b; font-size: 14px;">${task.description}</p>
                            <p style="margin: 5px 0 0 0; font-size: 12px;">
                                <span style="color: ${task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'};">
                                    ${task.priority.toUpperCase()} PRIORITY
                                </span> | 
                                Due: ${new Date(task.dueDate).toLocaleDateString()}
                            </p>
                        </div>
                    `).join('')}
                </div>
                <p>Please prioritize high-priority tasks and plan your day accordingly.</p>
                <p style="color: #64748b; font-size: 12px;">This is an automated daily report from ATPL Task Management System.</p>
            </div>
        `
    }),

    weeklyPerformanceReport: (user, report) => ({
        subject: `Weekly Performance Report - ${user.username}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #3b82f6;">Weekly Performance Report</h2>
                <p>Dear ${user.username},</p>
                <p>Here's your performance summary for this week:</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 15px 0;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div style="text-align: center; padding: 15px; background: white; border-radius: 6px;">
                            <h3 style="margin: 0; color: #10b981; font-size: 24px;">${report.tasksCompleted}</h3>
                            <p style="margin: 5px 0 0 0; color: #64748b;">Tasks Completed</p>
                        </div>
                        <div style="text-align: center; padding: 15px; background: white; border-radius: 6px;">
                            <h3 style="margin: 0; color: #3b82f6; font-size: 24px;">${report.onTimePercentage}%</h3>
                            <p style="margin: 5px 0 0 0; color: #64748b;">On-Time Completion</p>
                        </div>
                        <div style="text-align: center; padding: 15px; background: white; border-radius: 6px;">
                            <h3 style="margin: 0; color: ${report.pendingTasks > 5 ? '#ef4444' : '#f59e0b'}; font-size: 24px;">${report.pendingTasks}</h3>
                            <p style="margin: 5px 0 0 0; color: #64748b;">Pending Tasks</p>
                        </div>
                        <div style="text-align: center; padding: 15px; background: white; border-radius: 6px;">
                            <h3 style="margin: 0; color: #8b5cf6; font-size: 24px;">${report.averageCompletionTime}h</h3>
                            <p style="margin: 5px 0 0 0; color: #64748b;">Avg. Completion Time</p>
                        </div>
                    </div>
                </div>
                <p>${report.message}</p>
                <p style="color: #64748b; font-size: 12px;">This is an automated weekly report from ATPL Task Management System.</p>
            </div>
        `
    }),

    jobStatusAlert: (departments, job, status) => ({
        subject: `Job Status Alert: ${job.docNo} - ${status.toUpperCase()}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: ${status === 'so cancelled' ? '#ef4444' : '#f59e0b'};">Job Status Alert</h2>
                <p>Dear Team,</p>
                <p>Job status has been updated:</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${status === 'so cancelled' ? '#ef4444' : '#f59e0b'};">
                    <h3 style="margin: 0 0 15px 0; color: #1e40af;">Job Details</h3>
                    <p style="margin: 5px 0;"><strong>Document No:</strong> ${job.docNo}</p>
                    <p style="margin: 5px 0;"><strong>Customer:</strong> ${job.customerName}</p>
                    <p style="margin: 5px 0;"><strong>Item Code:</strong> ${job.itemCode}</p>
                    <p style="margin: 5px 0;"><strong>Description:</strong> ${job.description}</p>
                    <p style="margin: 5px 0;"><strong>Quantity:</strong> ${job.qty}</p>
                    <p style="margin: 15px 0 5px 0;"><strong>New Status:</strong> 
                        <span style="color: ${status === 'so cancelled' ? '#ef4444' : '#f59e0b'}; font-weight: bold;">
                            ${status.toUpperCase()}
                        </span>
                    </p>
                </div>
                <p>${status === 'so cancelled' ? 'This job has been cancelled. Please stop all related activities.' : 'This job is currently on hold. Please review and take necessary action.'}</p>
                <p style="color: #64748b; font-size: 12px;">This alert was sent to: Sales, Design, Planning, Purchase, Production, and Quality departments.</p>
            </div>
        `
    }),
    taskCompletionRequest: (admin, task, user) => ({
        subject: `Task Completion Request: ${task.title}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Task Completion Request</h2>
            <p>Dear ${admin.username},</p>
            <p><strong>${user.username}</strong> has submitted a task for your approval:</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #3b82f6;">
                <h3 style="margin: 0 0 15px 0; color: #1e40af;">${task.title}</h3>
                <p style="margin: 5px 0;"><strong>Description:</strong> ${task.description}</p>
                <p style="margin: 5px 0;"><strong>Assigned to:</strong> ${Array.isArray(task.assignedTo) ?
                task.assignedTo.map(u => u.username || 'Unknown').join(', ') :
                (task.assignedTo.username || 'Unknown')}</p>
                <p style="margin: 5px 0;"><strong>Priority:</strong> 
                    <span style="color: ${task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'};">
                        ${task.priority.toUpperCase()}
                    </span>
                </p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Completed At:</strong> ${new Date(task.completedAt).toLocaleString()}</p>
                ${task.completionRemarks ? `<p style="margin: 15px 0 5px 0;"><strong>Completion Remarks:</strong></p>
                <div style="background: white; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb;">
                    ${task.completionRemarks}
                </div>` : ''}
                ${task.individualCompletions && task.individualCompletions.length > 0 ? `
                <div style="margin: 15px 0;">
                    <strong>Individual Completions:</strong>
                    ${task.individualCompletions.map((completion, index) => `
                        <div style="background: white; padding: 8px; margin: 5px 0; border-radius: 4px; border: 1px solid #e5e7eb;">
                            <strong>User ${index + 1}:</strong> Completed at ${new Date(completion.completedAt).toLocaleString()}
                            ${completion.remarks ? `<br><em>Remarks: ${completion.remarks}</em>` : ''}
                        </div>
                    `).join('')}
                </div>` : ''}
            </div>
            <div style="text-align: center; margin: 20px 0;">
                <p style="margin-bottom: 15px;">Please review and take action:</p>
                <div style="margin: 10px 0;">
                    <span style="display: inline-block; padding: 8px 16px; background: #10b981; color: white; border-radius: 4px; margin: 5px;">
                        ✓ APPROVE
                    </span>
                    <span style="display: inline-block; padding: 8px 16px; background: #ef4444; color: white; border-radius: 4px; margin: 5px;">
                        ✗ REJECT
                    </span>
                </div>
                <p style="font-size: 12px; color: #64748b; margin-top: 10px;">
                    Log in to the admin dashboard to approve or reject this task
                </p>
            </div>
            <p style="color: #64748b; font-size: 12px;">This is an automated notification from ATPL Task Management System.</p>
        </div>
    `
    }),

};


// 2. ADD this function to emailService object in services/emailService.js:




// Email sending functions
const emailService = {
    async sendTaskAssignmentEmail(user, task, assignedByUser) {
        try {
            const taskWithAssignedBy = {
                ...task,
                assignedBy: assignedByUser
            };
            const template = emailTemplates.taskAssigned(user, taskWithAssignedBy);

            await transporter.sendMail({
                from: `"ATPL Task Management" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: template.subject,
                html: template.html
            });

            console.log(`Task assignment email sent to ${user.email}`);
        } catch (error) {
            console.error('Error sending task assignment email:', error);
        }
    },

    async sendTaskCompletionRequestEmail(task, completedByUser) {
        try {
            // Get admins and task assigner
            const User = require('../models/User');

            let notificationRecipients = [];

            // If task has an assigner, notify them
            if (task.assignedBy) {
                const assigner = await User.findById(task.assignedBy);
                if (assigner && assigner.isActive) {
                    notificationRecipients.push(assigner);
                }
            }

            // Also notify all admins and super-admins
            const admins = await User.find({
                role: { $in: ['admin', 'super-admin'] },
                isActive: true
            });

            // Combine and remove duplicates
            const allRecipients = [...notificationRecipients, ...admins];
            const uniqueRecipients = allRecipients.filter((user, index, arr) =>
                arr.findIndex(u => u._id.toString() === user._id.toString()) === index
            );

            if (uniqueRecipients.length === 0) {
                console.log('No recipients found for task completion notification');
                return;
            }

            const template = emailTemplates.taskCompletionRequest(
                { username: 'Admin/Manager' }, // Generic greeting since we're sending to multiple recipients
                task,
                completedByUser
            );

            // Send email to all recipients
            for (const recipient of uniqueRecipients) {
                await transporter.sendMail({
                    from: `"ATPL Task Management" <${process.env.EMAIL_USER}>`,
                    to: recipient.email,
                    subject: template.subject,
                    html: template.html
                });

                console.log(`Task completion request email sent to ${recipient.email} (${recipient.role})`);
            }

        } catch (error) {
            console.error('Error sending task completion request email:', error);
        }
    },

    async sendDailyTaskReport(user, pendingTasks) {
        try {
            if (pendingTasks.length === 0) return; // Don't send if no pending tasks

            const template = emailTemplates.dailyPendingTasks(user, pendingTasks);

            await transporter.sendMail({
                from: `"ATPL Task Management" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: template.subject,
                html: template.html
            });

            console.log(`Daily report email sent to ${user.email}`);
        } catch (error) {
            console.error('Error sending daily report email:', error);
        }
    },

    async sendWeeklyPerformanceReport(user, performanceData) {
        try {
            const template = emailTemplates.weeklyPerformanceReport(user, performanceData);

            await transporter.sendMail({
                from: `"ATPL Task Management" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: template.subject,
                html: template.html
            });

            console.log(`Weekly performance report sent to ${user.email}`);
        } catch (error) {
            console.error('Error sending weekly performance report:', error);
        }
    },

    async sendJobStatusAlertToAllDepartments(job, status) {
        try {
            const User = require('../models/User');
            const targetDepartments = ['sales', 'design', 'planning', 'purchase', 'production', 'quality'];

            const users = await User.find({
                department: { $in: targetDepartments },
                isActive: true
            });

            const template = emailTemplates.jobStatusAlert(targetDepartments, job, status);

            for (const user of users) {
                await transporter.sendMail({
                    from: `"ATPL Task Management" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: template.subject,
                    html: template.html
                });
            }

            console.log(`Job status alert sent to ${users.length} users across all departments`);
        } catch (error) {
            console.error('Error sending job status alert:', error);
        }
    }
};

module.exports = emailService;