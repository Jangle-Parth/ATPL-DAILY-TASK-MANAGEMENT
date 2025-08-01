document.addEventListener('DOMContentLoaded', function () {
    let currentUser = null;
    let users = [];
    let jobs = [];
    let tasks = [];
    const API_URL = 'http://localhost:3000/api';

    // Check authentication
    checkAuth();

    // Navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const targetSection = this.dataset.section;

            navButtons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            this.classList.add('active');
            document.getElementById(targetSection).classList.add('active');

            // Load section data
            loadSectionData(targetSection);
        });
    });

    // Modal functionality
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');


    closeButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('addUserBtn').addEventListener('click', () => openModal('addUserModal'));
    document.getElementById('addJobBtn').addEventListener('click', () => openModal('addJobModal'));
    document.getElementById('uploadJobsBtn').addEventListener('click', () => openModal('uploadJobsModal'));
    document.getElementById('addTaskBtn').addEventListener('click', () => openModal('addTaskModal'));

    // Form submissions
    document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    document.getElementById('addJobForm').addEventListener('submit', handleAddJob);
    document.getElementById('uploadJobsForm').addEventListener('submit', handleUploadJobs);
    document.getElementById('addTaskForm').addEventListener('submit', handleAddTask);

    // Search functionality
    document.getElementById('userSearch').addEventListener('input', filterUsers);
    document.getElementById('jobSearch').addEventListener('input', filterJobs);
    document.getElementById('taskSearch').addEventListener('input', filterTasks);

    // REPLACE the checkAuth function:
    async function checkAuth() {
        try {
            const token = localStorage.getItem('atpl_auth_token');
            if (!token) {
                window.location.href = '/';
                return;
            }

            const response = await fetch(`${API_URL}/verify-token`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                localStorage.removeItem('atpl_auth_token');
                localStorage.removeItem('atpl_user_info');
                window.location.href = '/';
                return;
            }

            const result = await response.json();
            if (result.success) {
                // Update user info display
                const userInfoElement = document.getElementById('userInfo');
                if (userInfoElement) {
                    userInfoElement.textContent = `${result.user.username} (${result.user.role})`;
                }
                loadDashboard();
            }
        } catch (error) {
            console.error('Auth check error:', error);
            localStorage.removeItem('atpl_auth_token');
            localStorage.removeItem('atpl_user_info');
            window.location.href = '/';
        }
    }

    async function loadDashboard() {
        try {
            await Promise.all([
                loadUsers(),
                loadJobs(),
                loadTasks()
            ]);
            updateDashboardStats();
        } catch (error) {
            showMessage('Error loading dashboard', 'error');
        }
    }

    // Helper function to get auth headers
    function getAuthHeaders() {
        const token = localStorage.getItem('atpl_auth_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // UPDATE all fetch calls like this example:
    async function loadUsers() {
        try {
            const response = await fetch(`${API_URL}/users`, {
                headers: getAuthHeaders()
            });
            users = await response.json();
            renderUsersTable();
            populateUserDropdowns();
        } catch (error) {
            showMessage('Error loading users', 'error');
        }
    }

    async function loadJobs() {
        try {
            const response = await fetch(`${API_URL}/jobs`, {
                headers: getAuthHeaders()
            });
            jobs = await response.json();
            renderJobsTable();
        } catch (error) {
            showMessage('Error loading jobs', 'error');
        }
    }

    async function loadTasks() {
        try {
            const response = await fetch(`${API_URL}/tasks`, {
                headers: getAuthHeaders()
            });
            tasks = await response.json();
            renderTasksContainer();
        } catch (error) {
            showMessage('Error loading tasks', 'error');
        }
    }

    function updateDashboardStats() {
        document.getElementById('totalUsers').textContent = users.filter(u => u.role === 'user').length;
        document.getElementById('totalJobs').textContent = jobs.length;
        document.getElementById('activeTasks').textContent = tasks.filter(t => t.status === 'pending').length;
        document.getElementById('pendingApprovals').textContent = tasks.filter(t => t.status === 'pending_approval').length;
    }

    function renderUsersTable() {
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';

        users.forEach(user => {
            if (user.role === 'user') {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td> ${user.username}</td >
                    <td>${user.email}</td>
                    <td>${user.department}</td>
                    <td><span class="task-status status-completed">${user.role}</span></td>
                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-small btn-primary" onclick="editUser('${user._id}')">Edit</button>
                        <button class="btn-small btn-danger" onclick="deleteUser('${user._id}')">Delete</button>
                    </td>
                `;
                tbody.appendChild(row);
            }
        });
    }

    function renderJobsTable() {
        const tbody = document.querySelector('#jobsTable tbody');
        tbody.innerHTML = '';

        jobs.forEach(job => {
            const row = document.createElement('tr');
            row.innerHTML = `
                < td > ${job.docNo}</td >
                <td>${job.customerName}</td>
                <td>${job.itemCode}</td>
                <td>${job.description}</td>
                <td>${job.qty}</td>
                <td>${job.month}</td>
                <td>${job.week}</td>
                <td><span class="task-status status-pending">${job.status}</span></td>
                <td>
                    <button class="btn-small btn-primary" onclick="editJob('${job._id}')">Edit</button>
                    <button class="btn-small btn-warning" onclick="viewJobTasks('${job._id}')">Tasks</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function renderTasksContainer() {
        const container = document.getElementById('tasksContainer');
        container.innerHTML = '';

        // Group tasks by type
        const taskGroups = {
            'admin': tasks.filter(t => t.type === 'admin'),
            'job-auto': tasks.filter(t => t.type === 'job-auto'),
            'user': tasks.filter(t => t.type === 'user'),
            'super-admin': tasks.filter(t => t.type === 'super-admin')
        };

        Object.entries(taskGroups).forEach(([type, typeTasks]) => {
            if (typeTasks.length > 0) {
                const typeHeader = document.createElement('h4');
                typeHeader.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Tasks(${typeTasks.length})`;
                typeHeader.style.marginBottom = '15px';
                typeHeader.style.color = '#1e293b';
                container.appendChild(typeHeader);

                const typeContainer = document.createElement('div');
                typeContainer.className = 'tasks-container';

                typeTasks.forEach(task => {
                    typeContainer.appendChild(createTaskCard(task));
                });

                container.appendChild(typeContainer);
            }
        });
    }

    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task - card priority - ${task.priority}`;

        const dueDate = new Date(task.dueDate);
        const today = new Date();
        const isOverdue = task.status === 'pending' && dueDate < today;

        // Handle populated user objects from MongoDB
        const assignedUserName = task.assignedTo?.username || 'Unknown';
        const assignedByUserName = task.assignedBy?.username || 'System';

        card.innerHTML = `
            <div class= "task-header" >
                <div>
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        Assigned to: ${assignedUserName} | 
                        By: ${assignedByUserName} |
                        Priority: ${task.priority.toUpperCase()}
                    </div>
                </div>
                <span class="task-status ${isOverdue ? 'status-overdue' : 'status-' + task.status}">
                    ${isOverdue ? 'Overdue' : task.status.replace('_', ' ').toUpperCase()}
                </span>
            </div >
            <div class="task-description">${task.description}</div>
            <div class="task-footer">
                <small>Due: ${dueDate.toLocaleDateString()}</small>
                <div class="task-actions">
                    ${task.status === 'pending_approval' ?
                `<button class="btn-small btn-success" onclick="approveTask('${task._id}')">Approve</button>` : ''}
                    <button class="btn-small btn-primary" onclick="editTask('${task._id}')">Edit</button>
                    <button class="btn-small btn-danger" onclick="deleteTask('${task._id}')">Delete</button>
                </div>
            </div>
            `;

        return card;
    }

    function populateUserDropdowns() {
        const dropdown = document.getElementById('taskAssignTo');
        dropdown.innerHTML = '<option value="">Select User</option><option value="self">Self</option>';

        users.filter(u => u.role === 'user').forEach(user => {
            const option = document.createElement('option');
            option.value = user._id;
            option.textContent = `${user.username} (${user.department})`;
            dropdown.appendChild(option);
        });
    }

    async function handleAddUser(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const userData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (result.success) {
                showMessage('User created successfully', 'success');
                closeModal('addUserModal');
                e.target.reset();
                loadUsers();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            showMessage('Error creating user', 'error');
        }
    }

    async function handleAddJob(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const jobData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`${API_URL}/jobs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(jobData)
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Job created successfully', 'success');
                closeModal('addJobModal');
                e.target.reset();
                loadJobs();
                loadTasks(); // Reload tasks as auto-tasks may be created
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            showMessage('Error creating job', 'error');
        }
    }

    async function handleUploadJobs(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const fileInput = document.getElementById('excelFile');

        if (!fileInput.files[0]) {
            showMessage('Please select an Excel file', 'error');
            return;
        }

        // Validate file type
        const file = fileInput.files[0];
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        const validExtensions = ['.xlsx', '.xls'];

        const isValidType = validTypes.includes(file.type) ||
            validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!isValidType) {
            showMessage('Please select a valid Excel file (.xlsx or .xls)', 'error');
            return;
        }

        try {
            // Get auth token
            const token = localStorage.getItem('atpl_auth_token');
            if (!token) {
                showMessage('Authentication required', 'error');
                return;
            }

            showMessage('Uploading file...', 'info');

            const response = await fetch(`${API_URL}/jobs/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`

                },
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showMessage(result.message, 'success');
                closeModal('uploadJobsModal');
                e.target.reset();
                loadJobs();
                loadTasks();

                // Show detailed results if there were errors
                if (result.errorCount > 0) {
                    console.log('Upload errors:', result.errors);
                    setTimeout(() => {
                        showMessage(`Upload completed: ${result.successCount} successful, ${result.errorCount} errors. Check console for details.`, 'warning');
                    }, 2000);
                }
            } else {
                showMessage(result.error || 'Upload failed', 'error');
                if (result.details) {
                    console.error('Upload error details:', result.details);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            showMessage('Error uploading jobs: ' + error.message, 'error');
        }
    }

    async function handleAddTask(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const taskData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task created successfully', 'success');
                closeModal('addTaskModal');
                e.target.reset();
                loadTasks();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            showMessage('Error creating task', 'error');
        }
    }

    // Global functions for inline event handlers
    window.approveTask = async function (taskId) {
        if (!confirm('Are you sure you want to approve this task?')) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task approved successfully', 'success');
                loadTasks();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            showMessage('Error approving task', 'error');
        }
    };

    window.editTask = function (taskId) {
        showMessage('Edit functionality coming soon', 'info');
    };

    window.deleteTask = function (taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            showMessage('Delete functionality coming soon', 'info');
        }
    };

    window.editUser = function (userId) {
        showMessage('Edit user functionality coming soon', 'info');
    };

    window.deleteUser = function (userId) {
        if (confirm('Are you sure you want to delete this user?')) {
            showMessage('Delete user functionality coming soon', 'info');
        }
    };

    window.editJob = function (jobId) {
        showMessage('Edit job functionality coming soon', 'info');
    };

    window.viewJobTasks = function (jobId) {
        const jobTasks = tasks.filter(t => t.jobId === jobId || (t.jobId && t.jobId._id === jobId));
        if (jobTasks.length === 0) {
            showMessage('No tasks found for this job', 'info');
            return;
        }
        showMessage(`Found ${jobTasks.length} tasks for this job`, 'info');
    };

    function filterUsers() {
        const searchTerm = document.getElementById('userSearch').value.toLowerCase();
        const rows = document.querySelectorAll('#usersTable tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    function filterJobs() {
        const searchTerm = document.getElementById('jobSearch').value.toLowerCase();
        const rows = document.querySelectorAll('#jobsTable tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    function filterTasks() {
        const searchTerm = document.getElementById('taskSearch').value.toLowerCase();
        const taskCards = document.querySelectorAll('#tasksContainer .task-card');

        taskCards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    function loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                updateDashboardStats();
                break;
            case 'users':
                loadUsers();
                break;
            case 'jobs':
                loadJobs();
                break;
            case 'tasks':
                loadTasks();
                break;
            case 'analytics':
                loadAnalytics();
                break;
        }
    }

    async function loadAnalytics() {
        try {
            const response = await fetch(`${API_URL}/analytics/users`, {
                headers: getAuthHeaders()
            });
            const analytics = await response.json();
            renderAnalytics(analytics);
        } catch (error) {
            showMessage('Error loading analytics', 'error');
        }
    }

    function renderAnalytics(analytics) {
        // Simple analytics rendering
        const charts = document.querySelectorAll('.chart-container');
        charts.forEach(chart => {
            chart.innerHTML = `
                <div style = "text-align: center;" >
                    <p>Analytics data loaded</p>
                    <p>${analytics.length} users analyzed</p>
                </div >
                `;
        });
    }

    async function logout() {
        try {
            const token = localStorage.getItem('atpl_auth_token');
            if (token) {
                await fetch(`${API_URL}/logout`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
            }
        } catch (error) {
            console.log('Logout error:', error);
        } finally {
            localStorage.removeItem('atpl_auth_token');
            localStorage.removeItem('atpl_user_info');
            window.location.href = '/';
        }
    }

    function openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    window.closeModal = function (modalId) {
        document.getElementById(modalId).style.display = 'none';
    };

    function showMessage(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast - ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border - radius: 8px;
            box - shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z - index: 1001;
            max - width: 300px;
            `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
});