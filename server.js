// server.js - Main Server File with MongoDB Integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Database connection
const connectDB = require('./config/database');
const seedDatabase = require('./config/seeder');

// Models
const User = require('./models/User');
const Task = require('./models/Task');
const Job = require('./models/Job');
const Log = require('./models/Log');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// CORS Configuration - IMPORTANT: Must be before other middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:8080',
        'http://127.0.0.1:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));



app.use((req, res, next) => {
    // Skip JSON parsing for file upload routes
    if (req.path === '/api/jobs/upload' && req.method === 'POST') {
        return next();
    }

    // Parse JSON for all other routes
    express.json({ limit: '100mb' })(req, res, next);
});



const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 * 1024, // 10MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Only allow Excel files
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'), false);
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Job Status Flow Configuration
const statusFlow = {
    'sales order received': { stage: 'sales', next: 'drawing approved', nextTask: 'Please Get the Drawing Approved' },
    'drawing approved': { stage: 'design', next: 'long lead item detail given', nextTask: 'Please provide long lead item details' },
    'long lead item detail given': { stage: 'design', next: 'drawing/bom issued', nextTask: 'Please issue drawing/BOM' },
    'drawing/bom issued': { stage: 'planning', next: 'production order and purchase request prepared', nextTask: 'Please release production order and purchase request' },
    'production order and purchase request prepared': { stage: 'purchase', next: 'rm received', nextTask: 'Please procure RM material' },
    'rm received': { stage: 'production', next: 'production started', nextTask: 'Please start production' },
    'production started': { stage: 'production', next: 'production completed', nextTask: 'Please complete production' },
    'production completed': { stage: 'quality', next: 'qc clear for dispatch', nextTask: 'Please clear QC for dispatch' },
    'qc clear for dispatch': { stage: 'sales', next: 'dispatch clearance', nextTask: 'Please provide dispatch clearance' },
    'dispatch clearance': { stage: 'production', next: 'completed', nextTask: 'Order completed' },
    'hold': { stage: 'sales', next: 'hold cleared', nextTask: 'Please clear the hold status and update next stage' },
    'hold cleared': { stage: 'sales', next: 'drawing approved', nextTask: 'Please Get the Drawing Approved' }, // Resume normal flow
    'so cancelled': { stage: 'sales', next: null, nextTask: null } // Terminal status - no next task
};

async function logActivity(action, userId, details, req = null) {
    try {
        const logData = {
            action,
            userId: userId === 'system' ? null : userId, // Allow null for system actions
            details,
            ipAddress: req ? req.ip : null,
            userAgent: req ? req.get('User-Agent') : null
        };

        await Log.create(logData);
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

// Updated logActivity function

async function getUsersByDepartment(department) {
    try {
        return await User.find({
            department: { $regex: new RegExp(department, 'i') },
            role: 'user',
            isActive: true
        });
    } catch (error) {
        console.error('Error getting users by department:', error);
        return [];
    }
}

async function createAutoTask(job, status, assignedToId) {
    try {
        const statusKey = status.toLowerCase();
        const flowInfo = statusFlow[statusKey];

        if (!flowInfo || !flowInfo.nextTask) {
            // For 'so cancelled' status, don't create any task
            if (statusKey === 'so cancelled') {
                await logActivity('JOB_CANCELLED', 'system', `Job ${job.docNo} - ${job.customerName} was cancelled`);
                return null;
            }
            return null;
        }

        const taskData = {
            title: flowInfo.nextTask,
            description: `Auto-generated task for Job ${job.docNo} - ${job.customerName} (Item Code: ${job.itemCode}) `,
            assignedTo: [assignedToId],
            assignedBy: null, // System generated
            priority: statusKey === 'hold' ? 'high' : 'medium',
            status: 'pending',
            type: 'job-auto',
            jobId: job._id,
            jobDetails: {
                docNo: job.docNo,
                customerName: job.customerName,
                itemCode: job.itemCode,
                description: job.description, // THIS IS THE KEY ADDITION
                qty: job.qty,
                currentStage: flowInfo.stage,
                nextStage: flowInfo.next
            },
            dueDate: new Date(Date.now() + (statusKey === 'hold' ? 3 : 7) * 24 * 60 * 60 * 1000)
        };

        const task = await Task.create(taskData);
        await logActivity('AUTO_TASK_CREATED', 'system', `Auto task created for ${job.docNo} - ${flowInfo.nextTask}`);
        return task;
    } catch (error) {
        console.error('Error creating auto task:', error);
        return null;
    }
}

// REPLACE requireAuth function:
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer token

    if (!token) {
        return res.status(401).json({ error: 'Authentication token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

async function requireAdmin(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        if (user.role !== 'admin' && user.role !== 'super-admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        req.userId = decoded.userId;
        req.userRole = user.role; // Use user.role instead of decoded.role
        req.user = user; // Add full user object for convenience
        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await User.findOne({
            username: username,
            isActive: true
        });

        if (!user || !user.comparePassword(password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role,
                username: user.username
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        await logActivity('LOGIN', user._id, `User ${user.username} logged in `, req);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.post('/api/logout', async (req, res) => {
    // With JWT, logout is handled client-side by removing the token
    // Optionally log the activity if you can identify the user
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            await logActivity('LOGOUT', decoded.userId, 'User logged out');
        } catch (error) {
            // Token might be expired, ignore error
        }
    }
    res.json({ success: true });
});

// User Management Routes
app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find({ isActive: true })
            .select('-password')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

app.post('/api/users', requireAdmin, async (req, res) => {
    try {
        const { username, email, password, department } = req.body;

        if (!username || !email || !password || !department) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }],
            isActive: true
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create user with plain text password
        const newUser = await User.create({
            username,
            email,
            password, // Store as plain text
            role: 'user',
            department
        });

        await logActivity('USER_CREATED', req.userId, `Created user: ${username} `, req);

        res.json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
});

// Job Management Routes
app.get('/api/jobs', requireAuth, async (req, res) => {
    try {
        const jobs = await Job.find()
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Error fetching jobs' });
    }
});

app.post('/api/jobs', requireAdmin, async (req, res) => {
    try {
        const { month, docNo, customerName, itemCode, description, qty, week, status } = req.body;

        if (!month || !docNo || !customerName || !itemCode || !description || !qty || !week || !status) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if job already exists with same docNo + itemCode
        const existingJob = await Job.findOne({
            docNo: docNo.toString(),
            itemCode: itemCode.toString()
        });

        if (existingJob) {
            return res.status(400).json({
                error: `Job with Doc No ${docNo} and Item Code ${itemCode} already exists`
            });
        }

        const jobData = {
            month,
            docNo,
            customerName,
            itemCode,
            description,
            qty: parseInt(qty),
            week,
            status: status.toLowerCase(),
            createdBy: req.userId
        };

        const job = await Job.create(jobData);

        // Auto-assign task based on status
        const statusKey = status.toLowerCase();
        const flowInfo = statusFlow[statusKey];

        if (flowInfo) {
            const departmentUsers = await getUsersByDepartment(flowInfo.stage);
            if (departmentUsers.length > 0) {
                await createAutoTask(job, status, departmentUsers[0]._id);
            }
        }

        await logActivity('JOB_CREATED', req.userId, `Created job: ${docNo} - ${customerName} - ${itemCode} `, req);
        res.json({ success: true, message: 'Job created successfully' });
    } catch (error) {
        console.error('Error creating job:', error);
        if (error.code === 11000) {
            // Handle the new compound unique constraint
            res.status(400).json({
                error: 'Job with this document number and item code combination already exists'
            });
        } else {
            res.status(500).json({ error: 'Error creating job' });
        }
    }
});


app.post('/api/jobs/upload', upload.single('excel'), async (req, res) => {
    try {
        console.log('Upload request received');
        console.log('Headers:', req.headers);
        console.log('File info:', req.file);

        // Manual authentication check for file upload route
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(401).json({ error: 'Authentication token required' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (tokenError) {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const user = await User.findById(decoded.userId);
        if (!user || (user.role !== 'admin' && user.role !== 'super-admin')) {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Set user info for logging
        req.userId = decoded.userId;
        req.userRole = decoded.role;

        if (!req.file) {
            return res.status(400).json({ error: 'Excel file required' });
        }

        // Verify file exists and is readable
        if (!fs.existsSync(req.file.path)) {
            return res.status(400).json({ error: 'Uploaded file not found' });
        }

        let workbook;
        try {
            workbook = XLSX.readFile(req.file.path);
            console.log('Excel file read successfully');
            console.log('Sheet names:', workbook.SheetNames);
        } catch (excelError) {
            console.error('Excel reading error:', excelError);
            // Clean up file
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: 'Invalid Excel file format' });
        }

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            // Clean up file
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: 'Excel file has no sheets' });
        }

        const worksheet = workbook.Sheets[sheetName];
        let data;

        try {
            data = XLSX.utils.sheet_to_json(worksheet);
            console.log('Excel data parsed:', data.length, 'rows');
            console.log('Sample row:', data[0]);
        } catch (parseError) {
            console.error('Excel parsing error:', parseError);
            // Clean up file
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: 'Error parsing Excel data' });
        }

        if (!data || data.length === 0) {
            // Clean up file
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: 'Excel file is empty' });
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            console.log(`Processing row ${i + 1}: `, row);

            try {
                // Validate required fields with flexible column names
                const month = row.month || row.Month || row.MONTH;
                const docNo = row.docNo || row.DocNo || row.DOC_NO || row['Doc No.'];
                const customerName = row.customerName || row.Customer || row['Customer Name'] || row.CUSTOMER;
                const itemCode = row.itemCode || row.ItemCode || row['Item Code'] || row.ITEM_CODE;
                const description = row.description || row.Description || row.DESCRIPTION;
                const qty = row.qty || row.Qty || row.QTY || row.Quantity || row['Qty.'];
                const week = row.week || row.Week || row.WEEK;
                const status = row.status || row.Status || row.STATUS;

                if (!month || !docNo || !customerName || !itemCode || !description || !qty || !week || !status) {
                    errorCount++;
                    errors.push(`Row ${i + 1}: Missing required fields.Found: ${Object.keys(row).join(', ')} `);
                    console.log(`Row ${i + 1} missing fields: `, {
                        month: !!month, docNo: !!docNo, customerName: !!customerName,
                        itemCode: !!itemCode, description: !!description, qty: !!qty,
                        week: !!week, status: !!status
                    });
                    continue;
                }

                // Validate data types
                const qtyNumber = parseInt(qty);
                if (isNaN(qtyNumber) || qtyNumber <= 0) {
                    errorCount++;
                    errors.push(`Row ${i + 1}: Invalid quantity value: ${qty} `);
                    continue;
                }

                // Check if job already exists
                const existingJob = await Job.findOne({
                    docNo: docNo.toString(),
                    itemCode: itemCode.toString()
                });
                if (existingJob) {
                    errorCount++;
                    errors.push(`Row ${i + 1}: Job with Doc No ${docNo} and Item Code ${itemCode} already exists`);
                    continue;
                }

                const jobData = {
                    month: month.toString(),
                    docNo: docNo.toString(),
                    customerName: customerName.toString(),
                    itemCode: itemCode.toString(),
                    description: description.toString(),
                    qty: qtyNumber,
                    week: week.toString(),
                    status: status.toString().toLowerCase(),
                    createdBy: req.userId
                };

                console.log('Creating job with data:', jobData);
                const job = await Job.create(jobData);

                // Auto-assign task based on status
                const statusKey = status.toString().toLowerCase();
                const flowInfo = statusFlow[statusKey];

                if (flowInfo) {
                    try {
                        const departmentUsers = await getUsersByDepartment(flowInfo.stage);
                        if (departmentUsers.length > 0) {
                            await createAutoTask(job, status, departmentUsers[0]._id);
                            console.log(`Auto task created for job ${docNo}`);
                        } else {
                            console.log(`No users found for department: ${flowInfo.stage} `);
                        }
                    } catch (taskError) {
                        console.error('Error creating auto task:', taskError);
                        // Don't fail the job creation if auto task fails
                    }
                }

                successCount++;
                console.log(`Successfully created job ${docNo} `);

            } catch (jobError) {
                errorCount++;
                console.error(`Error processing row ${i + 1}: `, jobError);

                if (jobError.code === 11000) {
                    errors.push(`Row ${i + 1}: Duplicate document number ${row.docNo || 'unknown'} `);
                } else {
                    errors.push(`Row ${i + 1}: ${jobError.message} `);
                }
            }
        }

        // Clean up uploaded file
        try {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
                console.log('Temporary file cleaned up');
            }
        } catch (cleanupError) {
            console.error('Error cleaning up file:', cleanupError);
        }

        await logActivity('JOBS_UPLOADED', req.userId,
            `Uploaded ${successCount} jobs, ${errorCount} errors`, req);

        const message = errorCount > 0
            ? `Successfully uploaded ${successCount} jobs.${errorCount} rows had errors.`
            : `Successfully uploaded ${successCount} jobs.`;

        res.json({
            success: true,
            message,
            successCount,
            errorCount,
            errors: errors.slice(0, 10) // Return first 10 errors for debugging
        });

    } catch (error) {
        console.error('Excel upload error:', error);

        // Clean up uploaded file in case of error
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up file after error:', cleanupError);
            }
        }

        res.status(500).json({
            error: 'Error processing Excel file',
            details: error.message
        });
    }
});

// Task Management Routes
app.get('/api/tasks', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        let query = {};

        if (user.role === 'super-admin') {
            // Super admin sees ALL tasks
            query = {};
        } else if (user.role === 'admin') {
            // Admin sees:
            // 1. All tasks assigned to users (job-auto, admin, user types)
            // 2. Tasks assigned to them
            // 3. Tasks created by them
            // But NOT super-admin tasks
            query = {
                $or: [
                    { assignedTo: user._id }, // Tasks assigned to admin
                    { assignedBy: user._id }, // Tasks created by admin
                    { type: { $in: ['job-auto', 'admin', 'user', 'manual'] } } // All non-super-admin tasks
                ]
            };
        } else {
            // Regular users see only tasks assigned to them or created by them
            query = {
                $or: [
                    { assignedTo: user._id },
                    { assignedBy: user._id }
                ]
            };
        }

        console.log('Task query for', user.role, ':', JSON.stringify(query));

        const tasks = await Task.find(query)
            .populate('assignedTo', 'username department')
            .populate('assignedBy', 'username')
            .populate('jobId', 'docNo customerName itemCode')
            .sort({ createdAt: -1 });

        console.log('Found tasks:', tasks.length);
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Error fetching tasks' });
    }
});

app.get('/api/tasks/admin', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        // Check if user has admin privileges
        if (user.role !== 'admin' && user.role !== 'super-admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        let query = {};

        if (user.role === 'super-admin') {
            // Super admin sees ALL tasks
            query = {};
        } else if (user.role === 'admin') {
            // Admin sees all tasks except super-admin tasks
            query = {
                type: { $ne: 'super-admin' }
            };
        }

        const tasks = await Task.find(query)
            .populate('assignedTo', 'username department')
            .populate('assignedBy', 'username')
            .populate('jobId', 'docNo customerName itemCode')
            .sort({
                status: 1, // pending_approval first
                createdAt: -1
            });

        console.log('Admin tasks loaded:', tasks.length);
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching admin tasks:', error);
        res.status(500).json({ error: 'Error fetching admin tasks' });
    }
});

// ADD: Task rejection endpoint
app.post('/api/tasks/:id/reject', requireAuth, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { reason } = req.body;

        if (!taskId || taskId === 'undefined' || !taskId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const user = await User.findById(req.userId);

        let canReject = false;

        if (task.type === 'super-admin' && user.role === 'super-admin') {
            canReject = true;
        } else if (task.type === 'job-auto' && (user.role === 'admin' || user.role === 'super-admin')) {
            canReject = true;
        } else if (task.assignedBy && task.assignedBy.toString() === req.userId) {
            // User can reject tasks they assigned
            canReject = true;
        } else if ((user.role === 'admin' || user.role === 'super-admin') && !task.assignedBy) {
            // Admin can reject system-generated tasks
            canReject = true;
        }

        if (!canReject) {
            return res.status(403).json({
                error: 'Not authorized to reject this task. Only the task assigner or admin can reject.'
            });
        }

        if (task.status !== 'pending_approval') {
            return res.status(400).json({ error: 'Only pending approval tasks can be rejected' });
        }

        task.status = 'pending';
        task.rejectedAt = new Date();
        task.rejectedBy = req.userId;
        task.rejectionReason = reason;
        task.completedAt = null; // Reset completion timestamp

        await task.save();

        await logActivity('TASK_REJECTED', req.userId, `Rejected task: ${task.title}.Reason: ${reason} `, req);
        res.json({ success: true, message: 'Task rejected successfully' });
    } catch (error) {
        console.error('Error rejecting task:', error);
        res.status(500).json({ error: 'Error rejecting task' });
    }
});

// ADD: Delete task endpoint
app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
        const taskId = req.params.id;

        if (!taskId || taskId === 'undefined' || !taskId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const user = await User.findById(req.userId);

        // Check delete permissions - only admin/super-admin or task creator can delete
        if (user.role !== 'admin' && user.role !== 'super-admin' &&
            task.assignedBy && task.assignedBy.toString() !== req.userId) {
            return res.status(403).json({ error: 'Not authorized to delete this task' });
        }

        await Task.findByIdAndDelete(taskId);

        await logActivity('TASK_DELETED', req.userId, `Deleted task: ${task.title} `, req);
        res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Error deleting task' });
    }
});

// IMPROVED: Get all tasks for debugging
app.get('/api/tasks/debug', requireAdmin, async (req, res) => {
    try {
        const allTasks = await Task.find()
            .populate('assignedTo', 'username department role')
            .populate('assignedBy', 'username role')
            .populate('jobId', 'docNo customerName')
            .sort({ createdAt: -1 });

        const taskSummary = allTasks.map(task => ({
            id: task._id,
            title: task.title,
            type: task.type,
            status: task.status,
            assignedTo: task.assignedTo?.username || 'Unknown',
            assignedToRole: task.assignedTo?.role || 'Unknown',
            assignedBy: task.assignedBy?.username || 'System',
            assignedByRole: task.assignedBy?.role || 'System',
            createdAt: task.createdAt,
            dueDate: task.dueDate
        }));

        res.json({
            total: allTasks.length,
            tasks: taskSummary,
            byType: {
                'job-auto': allTasks.filter(t => t.type === 'job-auto').length,
                'admin': allTasks.filter(t => t.type === 'admin').length,
                'user': allTasks.filter(t => t.type === 'user').length,
                'manual': allTasks.filter(t => t.type === 'manual').length,
                'super-admin': allTasks.filter(t => t.type === 'super-admin').length
            },
            byStatus: {
                'pending': allTasks.filter(t => t.status === 'pending').length,
                'pending_approval': allTasks.filter(t => t.status === 'pending_approval').length,
                'completed': allTasks.filter(t => t.status === 'completed').length,
                'rejected': allTasks.filter(t => t.status === 'rejected').length
            }
        });
    } catch (error) {
        console.error('Error fetching debug tasks:', error);
        res.status(500).json({ error: 'Error fetching debug tasks' });
    }
});

// In server.js - Update ONLY manual task creation to support multiple assignees

app.post('/api/tasks', requireAuth, async (req, res) => {
    try {
        const { title, description, assignedTo, priority, dueDate, type = 'manual' } = req.body;
        const user = await User.findById(req.userId);

        if (!title || !description || !assignedTo || !priority || !dueDate) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Handle multiple assignees ONLY for manual tasks
        let assigneeIds = [];
        if (Array.isArray(assignedTo)) {
            assigneeIds = assignedTo.map(id => id === 'self' ? req.userId : id);
        } else {
            assigneeIds = [assignedTo === 'self' ? req.userId : assignedTo];
        }

        const taskData = {
            title,
            description,
            assignedTo: assigneeIds, // Multiple assignees for manual tasks
            assignedBy: req.userId,
            priority,
            status: 'pending',
            type: user.role === 'super-admin' ? 'super-admin' : (user.role === 'admin' ? 'admin' : 'user'),
            dueDate: new Date(dueDate),
            attachments: [],
            individualCompletions: assigneeIds.length > 1 ? [] : undefined // Only for multi-assignee
        };

        const task = await Task.create(taskData);

        const assignedUsers = await User.find({ _id: { $in: assigneeIds } });
        const usernames = assignedUsers.map(u => u.username).join(', ');
        await logActivity('TASK_CREATED', req.userId, `Created task: ${title} for ${usernames}`, req);

        res.json({ success: true, message: 'Task created successfully' });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Error creating task' });
    }
});

// In server.js - Update task completion

app.post('/api/tasks/:id/complete', requireAuth, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { remarks, attachments } = req.body;

        if (!taskId || taskId === 'undefined' || !taskId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if user is assigned to this task
        const isAssigned = task.assignedTo.some(id => id.toString() === req.userId);
        if (!isAssigned) {
            return res.status(403).json({ error: 'Not authorized to complete this task' });
        }

        // For job-auto tasks (single assignee) - original logic
        if (task.type === 'job-auto') {
            task.status = 'pending_approval';
            task.completedAt = new Date();
            task.completionRemarks = remarks;
            if (attachments) task.completionAttachments = attachments;

            await task.save();

            // Create next task in job flow if needed
            if (task.jobId && task.jobDetails.nextStage && task.jobDetails.nextStage !== 'completed') {
                const job = await Job.findById(task.jobId);
                if (job) {
                    const flowInfo = statusFlow[task.jobDetails.nextStage];
                    if (flowInfo) {
                        const departmentUsers = await getUsersByDepartment(flowInfo.stage);
                        if (departmentUsers.length > 0) {
                            await createAutoTask(job, task.jobDetails.nextStage, departmentUsers[0]._id);
                        }
                    }
                }
            }

            await logActivity('TASK_COMPLETED', req.userId, `Completed task: ${task.title} `, req);
            return res.json({ success: true, message: 'Task submitted for approval' });
        }

        // For manual tasks with multiple assignees
        if (task.assignedTo.length > 1) {
            // Check if user already completed
            const existingCompletion = task.individualCompletions.find(
                comp => comp.userId.toString() === req.userId
            );

            if (existingCompletion) {
                return res.status(400).json({ error: 'You have already completed this task' });
            }

            // Add individual completion
            task.individualCompletions.push({
                userId: req.userId,
                completedAt: new Date(),
                remarks: remarks,
                attachments: attachments || []
            });

            // Check if all assignees have completed
            const allCompleted = task.assignedTo.length === task.individualCompletions.length;

            if (allCompleted) {
                task.status = 'pending_approval';
                task.completedAt = new Date();
                task.completionRemarks = task.individualCompletions
                    .map(comp => comp.remarks)
                    .filter(Boolean)
                    .join('; ');
            }

            await task.save();

            const message = allCompleted ?
                'Task submitted for approval (all assignees completed)' :
                'Your completion recorded. Waiting for other assignees.';

            await logActivity('TASK_COMPLETED', req.userId, `Completed task: ${task.title} `, req);
            return res.json({ success: true, message });
        }

        // For single assignee manual tasks
        task.status = 'pending_approval';
        task.completedAt = new Date();
        task.completionRemarks = remarks;
        if (attachments) task.completionAttachments = attachments;

        await task.save();

        await logActivity('TASK_COMPLETED', req.userId, `Completed task: ${task.title} `, req);
        res.json({ success: true, message: 'Task submitted for approval' });

    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ error: 'Error completing task' });
    }
});

app.post('/api/tasks/assign-peer', requireAuth, async (req, res) => {
    try {
        const { title, description, assignedTo, priority, dueDate } = req.body;
        const assignerUser = await User.findById(req.userId);

        console.log('Received task assignment request:', { title, assignedTo, priority });
        console.log('Assigner user:', assignerUser.username, 'Department:', assignerUser.department, 'Role:', assignerUser.role);

        if (!title || !description || !assignedTo || !priority || !dueDate) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // IMPORTANT: Ensure assignedTo is always treated as an array
        let assigneeIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo];

        console.log('Processing assignee IDs:', assigneeIds);

        // Validate that assignee IDs are valid ObjectIds
        assigneeIds = assigneeIds.filter(id => id && id.match(/^[0-9a-fA-F]{24}$/));

        if (assigneeIds.length === 0) {
            return res.status(400).json({ error: 'No valid assignees provided' });
        }

        // Validate assignees exist and are active
        const assignees = await User.find({
            _id: { $in: assigneeIds },
            isActive: true
        });

        console.log('Found assignees:', assignees.map(u => ({
            username: u.username,
            department: u.department,
            role: u.role
        })));

        if (assignees.length !== assigneeIds.length) {
            return res.status(400).json({ error: 'Some assignees were not found or are inactive' });
        }

        // REMOVED: Department validation - Allow cross-department task assignment
        // All users can now assign tasks to colleagues from any department
        console.log('Cross-department assignment allowed for all users');

        const taskData = {
            title,
            description,
            assignedTo: assigneeIds, // Array of user IDs
            assignedBy: req.userId,
            priority,
            status: 'pending',
            type: 'user',
            dueDate: new Date(dueDate),
            individualCompletions: assigneeIds.length > 1 ? [] : undefined // Only for multi-assignee
        };

        console.log('Creating task with data:', {
            ...taskData,
            assignedTo: taskData.assignedTo.length + ' users'
        });

        const task = await Task.create(taskData);

        const usernames = assignees.map(u => u.username).join(', ');
        await logActivity('PEER_TASK_ASSIGNED', req.userId, `Assigned task: ${title} to ${usernames} `, req);

        console.log('Task created successfully:', task._id);

        res.json({
            success: true,
            message: `Task assigned successfully to ${assignees.length} colleague(s): ${usernames} `,
            taskId: task._id
        });
    } catch (error) {
        console.error('Error assigning task:', error);
        res.status(500).json({ error: 'Error assigning task: ' + error.message });
    }
});

// ALSO FIX: Colleagues endpoint to handle department issues better
app.get('/api/users/colleagues', requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.userId);

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('Current user:', currentUser.username, 'Department:', currentUser.department, 'Role:', currentUser.role);

        // Build query to get colleagues from ALL departments
        let query = {
            isActive: true,
            role: 'user',
            _id: { $ne: req.userId } // Exclude current user
        };

        // REMOVED: Department filtering - Show all colleagues regardless of department
        console.log('Showing all colleagues from all departments');

        console.log('Query for colleagues:', JSON.stringify(query));

        const colleagues = await User.find(query)
            .select('username email department role')
            .sort({ department: 1, username: 1 });

        console.log('Found colleagues:', colleagues.length);

        res.json(colleagues);
    } catch (error) {
        console.error('Error fetching colleagues:', error);
        res.status(500).json({ error: 'Error fetching colleagues: ' + error.message });
    }
});

// DEBUGGING: Add endpoint to check user departments
app.get('/api/debug/users', requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.userId);
        const allUsers = await User.find({ isActive: true })
            .select('username department role')
            .sort({ department: 1, username: 1 });

        res.json({
            currentUser: {
                username: currentUser.username,
                department: currentUser.department,
                role: currentUser.role
            },
            allUsers: allUsers.map(u => ({
                id: u._id,
                username: u.username,
                department: u.department,
                role: u.role
            })),
            departmentCounts: allUsers.reduce((acc, user) => {
                const dept = user.department || 'No Department';
                acc[dept] = (acc[dept] || 0) + 1;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Error in debug endpoint:', error);
        res.status(500).json({ error: 'Debug error: ' + error.message });
    }
});

app.post('/api/tasks/:id/approve', requireAuth, async (req, res) => {
    try {
        const taskId = req.params.id;

        // Validate task ID
        if (!taskId || taskId === 'undefined' || !taskId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const user = await User.findById(req.userId);
        let canApprove = false;

        // Check approval permissions
        if (task.type === 'super-admin' && user.role !== 'super-admin') {
            return res.status(403).json({ error: 'Only super-admin can approve super-admin tasks' });
        } else if (task.type === 'job-auto' && (user.role === 'admin' || user.role === 'super-admin')) {
            canApprove = true;
        } else if (task.assignedBy && task.assignedBy.toString() === req.userId) {
            // User can approve tasks they assigned
            canApprove = true;
        } else if ((user.role === 'admin' || user.role === 'super-admin') && !task.assignedBy) {
            // Admin can approve system-generated tasks
            canApprove = true;
        }

        if (!canApprove) {
            return res.status(403).json({
                error: 'Not authorized to approve this task. Only the task assigner or admin can approve.'
            });
        }

        if (task.status !== 'pending_approval') {
            return res.status(400).json({ error: 'Only pending approval tasks can be approved' });
        }


        if (task.assignedBy && task.assignedBy.toString() !== req.userId && user.role !== 'admin' && user.role !== 'super-admin') {
            return res.status(403).json({ error: 'Not authorized to approve this task' });
        }

        task.status = 'completed';
        task.approvedAt = new Date();
        task.approvedBy = req.userId;

        await task.save();

        await logActivity('TASK_APPROVED', req.userId, `Approved task: ${task.title} `, req);
        res.json({ success: true, message: 'Task approved successfully' });
    } catch (error) {
        console.error('Error approving task:', error);
        res.status(500).json({ error: 'Error approving task' });
    }
});

// Analytics Routes
app.get('/api/analytics/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find({ role: 'user', isActive: true });
        const analytics = [];

        for (const user of users) {
            const userTasks = await Task.find({ assignedTo: user._id });
            const completedTasks = userTasks.filter(t => t.status === 'completed');
            const pendingTasks = userTasks.filter(t => t.status === 'pending');
            const overdueTasks = userTasks.filter(t => t.status === 'pending' && new Date(t.dueDate) < new Date());

            analytics.push({
                user: {
                    id: user._id,
                    username: user.username,
                    department: user.department
                },
                metrics: {
                    totalTasks: userTasks.length,
                    completedTasks: completedTasks.length,
                    pendingTasks: pendingTasks.length,
                    overdueTasks: overdueTasks.length,
                    completionRate: userTasks.length > 0 ? (completedTasks.length / userTasks.length * 100).toFixed(2) : 0
                }
            });
        }

        res.json(analytics);
    } catch (error) {
        console.error('Error generating analytics:', error);
        res.status(500).json({ error: 'Error generating analytics' });
    }
});

// Search Routes
app.get('/api/search', requireAuth, async (req, res) => {
    try {
        const { query, type } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const searchRegex = new RegExp(query, 'i');
        let results = [];

        if (!type || type === 'tasks') {
            const taskResults = await Task.find({
                $or: [
                    { title: searchRegex },
                    { description: searchRegex },
                    { docNo: searchRegex },
                    { customerName: searchRegex }
                ]
            })
                .populate('assignedTo', 'username')
                .populate('assignedBy', 'username');

            results = results.concat(taskResults.map(task => ({ ...task.toObject(), resultType: 'task' })));
        }

        if (!type || type === 'jobs') {
            const jobResults = await Job.find({
                $or: [
                    { docNo: searchRegex },
                    { customerName: searchRegex },
                    { itemCode: searchRegex },
                    { description: searchRegex }
                ]
            });

            results = results.concat(jobResults.map(job => ({ ...job.toObject(), resultType: 'job' })));
        }

        res.json(results);
    } catch (error) {
        console.error('Error performing search:', error);
        res.status(500).json({ error: 'Error performing search' });
    }
});

// Dashboard Routes
app.get('/api/dashboard/user', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const userTasks = await Task.find({ assignedTo: userId });

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const thisWeekEnd = new Date(today);
        thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);

        const thisMonthEnd = new Date(today);
        thisMonthEnd.setMonth(thisMonthEnd.getMonth() + 1);

        const dashboard = {
            totalTasks: userTasks.length,
            pendingTasks: userTasks.filter(t => t.status === 'pending').length,
            completedTasks: userTasks.filter(t => t.status === 'completed').length,
            dueToday: userTasks.filter(t => t.status === 'pending' && new Date(t.dueDate).toDateString() === today.toDateString()).length,
            dueTomorrow: userTasks.filter(t => t.status === 'pending' && new Date(t.dueDate).toDateString() === tomorrow.toDateString()).length,
            dueThisWeek: userTasks.filter(t => t.status === 'pending' && new Date(t.dueDate) <= thisWeekEnd).length,
            dueThisMonth: userTasks.filter(t => t.status === 'pending' && new Date(t.dueDate) <= thisMonthEnd).length,
            overdue: userTasks.filter(t => t.status === 'pending' && new Date(t.dueDate) < today).length
        };

        res.json(dashboard);
    } catch (error) {
        console.error('Error generating dashboard:', error);
        res.status(500).json({ error: 'Error generating dashboard' });
    }
});

app.put('/api/tasks/:id/status', requireAuth, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { status, reason } = req.body;

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const user = await User.findById(req.userId);

        // Check permissions
        if (task.assignedTo.toString() !== req.userId &&
            (task.assignedBy && task.assignedBy.toString() !== req.userId) &&
            user.role !== 'admin' &&
            user.role !== 'super-admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const oldStatus = task.status;
        task.status = status;
        task.statusChangedAt = new Date();
        task.statusChangeReason = reason;

        await task.save();

        await logActivity('TASK_STATUS_CHANGED', req.userId,
            `Changed task ${task._id} status from ${oldStatus} to ${status}.Reason: ${reason} `, req);

        res.json({ success: true, message: 'Task status updated' });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ error: 'Error updating task status' });
    }
});

// Get Task Details Route
app.get('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
        const taskId = req.params.id;

        // Validate task ID
        if (!taskId || taskId === 'undefined' || !taskId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }

        const task = await Task.findById(taskId)
            .populate('assignedTo', 'username department')
            .populate('assignedBy', 'username')
            .populate('approvedBy', 'username')
            .populate('jobId', 'docNo customerName itemCode');

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(task);
    } catch (error) {
        console.error('Error fetching task details:', error);
        res.status(500).json({ error: 'Error fetching task details' });
    }
});

// Bulk Task Operations Route
app.post('/api/tasks/bulk', requireAdmin, async (req, res) => {
    try {
        const { taskIds, action, reason } = req.body;

        if (!taskIds || !Array.isArray(taskIds) || !action) {
            return res.status(400).json({ error: 'Task IDs and action required' });
        }

        let updatedCount = 0;

        for (const taskId of taskIds) {
            try {
                const task = await Task.findById(taskId);
                if (task) {
                    switch (action) {
                        case 'approve':
                            if (task.status === 'pending_approval') {
                                task.status = 'completed';
                                task.approvedAt = new Date();
                                task.approvedBy = req.userId;
                                await task.save();
                                updatedCount++;
                            }
                            break;
                        case 'reject':
                            if (task.status === 'pending_approval') {
                                task.status = 'pending';
                                task.rejectedAt = new Date();
                                task.rejectedBy = req.userId;
                                task.rejectionReason = reason;
                                await task.save();
                                updatedCount++;
                            }
                            break;
                        case 'delete':
                            await Task.findByIdAndDelete(taskId);
                            updatedCount++;
                            break;
                    }
                }
            } catch (error) {
                console.error(`Error processing task ${taskId}: `, error);
            }
        }

        await logActivity('BULK_TASK_ACTION', req.userId,
            `Performed ${action} on ${updatedCount} tasks.Reason: ${reason || 'N/A'} `, req);

        res.json({ success: true, message: `${action} applied to ${updatedCount} tasks` });
    } catch (error) {
        console.error('Error performing bulk action:', error);
        res.status(500).json({ error: 'Error performing bulk action' });
    }
});

// Advanced Analytics Route
app.get('/api/analytics/advanced', requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate, department, userId } = req.query;

        let taskQuery = {};
        let jobQuery = {};

        // Apply filters
        if (startDate) {
            const start = new Date(startDate);
            taskQuery.createdAt = { ...taskQuery.createdAt, $gte: start };
            jobQuery.createdAt = { ...jobQuery.createdAt, $gte: start };
        }

        if (endDate) {
            const end = new Date(endDate);
            taskQuery.createdAt = { ...taskQuery.createdAt, $lte: end };
            jobQuery.createdAt = { ...jobQuery.createdAt, $lte: end };
        }

        if (department) {
            const departmentUsers = await User.find({
                department: { $regex: new RegExp(department, 'i') }
            }).select('_id');
            const userIds = departmentUsers.map(u => u._id);
            taskQuery.assignedTo = { $in: userIds };
        }

        if (userId) {
            taskQuery.assignedTo = userId;
        }

        const [filteredTasks, filteredJobs] = await Promise.all([
            Task.find(taskQuery).populate('assignedTo', 'department'),
            Job.find(jobQuery)
        ]);

        // Calculate metrics
        const analytics = {
            overview: {
                totalTasks: filteredTasks.length,
                completedTasks: filteredTasks.filter(t => t.status === 'completed').length,
                pendingTasks: filteredTasks.filter(t => t.status === 'pending').length,
                overdueTasks: filteredTasks.filter(t => t.status === 'pending' && new Date(t.dueDate) < new Date()).length,
                totalJobs: filteredJobs.length
            },
            departmentPerformance: await calculateDepartmentPerformance(filteredTasks),
            taskTypeDistribution: calculateTaskTypeDistribution(filteredTasks),
            averageCompletionTime: calculateAverageCompletionTime(filteredTasks),
            topPerformers: await calculateTopPerformers(filteredTasks),
            jobStatusFlow: calculateJobStatusFlow(filteredJobs),
            weeklyTrends: calculateWeeklyTrends(filteredTasks)
        };

        res.json(analytics);
    } catch (error) {
        console.error('Error generating advanced analytics:', error);
        res.status(500).json({ error: 'Error generating advanced analytics' });
    }
});

async function calculateDepartmentPerformance(tasks) {
    const departments = {};

    for (const task of tasks) {
        if (task.assignedTo && task.assignedTo.department) {
            const dept = task.assignedTo.department;
            if (!departments[dept]) {
                departments[dept] = { total: 0, completed: 0, pending: 0, overdue: 0 };
            }

            departments[dept].total++;
            if (task.status === 'completed') departments[dept].completed++;
            if (task.status === 'pending') departments[dept].pending++;
            if (task.status === 'pending' && new Date(task.dueDate) < new Date()) departments[dept].overdue++;
        }
    }

    return Object.entries(departments).map(([dept, stats]) => ({
        department: dept,
        ...stats,
        completionRate: stats.total > 0 ? (stats.completed / stats.total * 100).toFixed(2) : 0
    }));
}

function calculateTaskTypeDistribution(tasks) {
    const types = {};
    tasks.forEach(task => {
        types[task.type] = (types[task.type] || 0) + 1;
    });
    return types;
}

function calculateAverageCompletionTime(tasks) {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.createdAt && t.approvedAt);

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
        return sum + (new Date(task.approvedAt) - new Date(task.createdAt));
    }, 0);

    return Math.round(totalTime / completedTasks.length / (1000 * 60 * 60 * 24)); // Days
}

async function calculateTopPerformers(tasks) {
    const userPerformance = {};

    tasks.forEach(task => {
        const userId = task.assignedTo._id || task.assignedTo;
        if (!userPerformance[userId]) {
            userPerformance[userId] = { total: 0, completed: 0, onTime: 0, user: task.assignedTo };
        }

        userPerformance[userId].total++;
        if (task.status === 'completed') {
            userPerformance[userId].completed++;
            if (task.approvedAt && new Date(task.approvedAt) <= new Date(task.dueDate)) {
                userPerformance[userId].onTime++;
            }
        }
    });

    return Object.values(userPerformance)
        .map(stats => ({
            user: stats.user,
            total: stats.total,
            completed: stats.completed,
            onTime: stats.onTime,
            completionRate: stats.total > 0 ? (stats.completed / stats.total * 100).toFixed(2) : 0,
            onTimeRate: stats.completed > 0 ? (stats.onTime / stats.completed * 100).toFixed(2) : 0
        }))
        .sort((a, b) => parseFloat(b.completionRate) - parseFloat(a.completionRate))
        .slice(0, 10);
}

function calculateJobStatusFlow(jobs) {
    const statusCounts = {};
    jobs.forEach(job => {
        statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    });
    return statusCounts;
}

function calculateWeeklyTrends(tasks) {
    const weeks = {};
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekKey = weekStart.toLocaleDateString();
        weeks[weekKey] = {
            created: 0,
            completed: 0
        };

        tasks.forEach(task => {
            const createdDate = new Date(task.createdAt);
            if (createdDate >= weekStart && createdDate <= weekEnd) {
                weeks[weekKey].created++;
            }

            if (task.approvedAt) {
                const completedDate = new Date(task.approvedAt);
                if (completedDate >= weekStart && completedDate <= weekEnd) {
                    weeks[weekKey].completed++;
                }
            }
        });
    }

    return weeks;
}

// Job Status Update Route
app.put('/api/jobs/:id/status', requireAdmin, async (req, res) => {
    try {
        const jobId = req.params.id;
        const { status } = req.body;

        const job = await Job.findById(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const oldStatus = job.status;
        job.status = status.toLowerCase();
        job.updatedAt = new Date();

        await job.save();

        // Create auto-task for new status
        const statusKey = status.toLowerCase();
        const flowInfo = statusFlow[statusKey];

        if (flowInfo) {
            const departmentUsers = await getUsersByDepartment(flowInfo.stage);
            if (departmentUsers.length > 0) {
                await createAutoTask(job, status, departmentUsers[0]._id);
            }
        }

        await logActivity('JOB_STATUS_UPDATED', req.userId,
            `Updated job ${job.docNo} status from ${oldStatus} to ${status} `, req);

        res.json({ success: true, message: 'Job status updated' });
    } catch (error) {
        console.error('Error updating job status:', error);
        res.status(500).json({ error: 'Error updating job status' });
    }
});

// Get System Logs Route (Super Admin only)
app.get('/api/logs', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (user.role !== 'super-admin') {
            return res.status(403).json({ error: 'Super admin access required' });
        }

        const { page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            Log.find()
                .populate('userId', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Log.countDocuments()
        ]);

        res.json({
            logs,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Error fetching logs' });
    }
});

// Export Data Route
app.get('/api/export/:type', requireAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        let data = [];
        let filename = '';

        switch (type) {
            case 'tasks':
                data = await Task.find()
                    .populate('assignedTo', 'username')
                    .populate('assignedBy', 'username')
                    .lean();
                filename = `tasks_export_${Date.now()}.json`;
                break;
            case 'jobs':
                data = await Job.find()
                    .populate('createdBy', 'username')
                    .lean();
                filename = `jobs_export_${Date.now()}.json`;
                break;
            case 'users':
                data = await User.find({ role: 'user', isActive: true })
                    .select('-password')
                    .lean();
                filename = `users_export_${Date.now()}.json`;
                break;
            default:
                return res.status(400).json({ error: 'Invalid export type' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename = ${filename} `);
        res.json(data);

        await logActivity('DATA_EXPORTED', req.userId, `Exported ${type} data`, req);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Error exporting data' });
    }
});

// Add this route to your server.js file after the login route

// REPLACE the verify-session route:
app.get('/api/verify-token', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'User not found or inactive'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
});



function sanitizeInput(req, res, next) {
    // Skip sanitization for file uploads
    if (req.path === '/api/jobs/upload' && req.method === 'POST') {
        return next();
    }

    // Basic input sanitization for other routes
    for (let key in req.body) {
        if (typeof req.body[key] === 'string') {
            req.body[key] = req.body[key].trim();
            // Remove potentially dangerous characters
            req.body[key] = req.body[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
    }
    next();
}

// Rate limiting middleware
const requestCounts = {};
function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!requestCounts[ip]) {
        requestCounts[ip] = { count: 1, resetTime: now + 60000 }; // 1 minute window
    } else if (now > requestCounts[ip].resetTime) {
        requestCounts[ip] = { count: 1, resetTime: now + 60000 };
    } else {
        requestCounts[ip].count++;
        if (requestCounts[ip].count > 100) { // 100 requests per minute
            return res.status(429).json({ error: 'Too many requests' });
        }
    }
    next();
}
// Apply security middleware
app.use(sanitizeInput);
app.use(rateLimit);

// Additional Error Handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Static Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/user', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`ATPL Task Management System running on port ${PORT} `);
});