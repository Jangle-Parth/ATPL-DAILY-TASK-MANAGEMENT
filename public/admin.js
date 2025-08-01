// REPLACE the entire admin.js content with this fixed version:
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

    // Search functionality - ADD support for task search
    document.getElementById('userSearch').addEventListener('input', filterUsers);
    document.getElementById('jobSearch').addEventListener('input', filterJobs);

    // Add task search functionality when the element is available
    setTimeout(() => {
        const taskSearchInput = document.getElementById('taskSearch');
        if (taskSearchInput) {
            taskSearchInput.addEventListener('input', filterTasks);
        }
    }, 100);

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
                currentUser = result.user;
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
            const response = await fetch(`${API_URL}/tasks/admin`, {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                tasks = await response.json();
            } else if (response.status === 404 || response.status === 403) {
                // Fall back to regular tasks endpoint
                const fallbackResponse = await fetch(`${API_URL}/tasks`, {
                    headers: getAuthHeaders()
                });
                if (fallbackResponse.ok) {
                    tasks = await fallbackResponse.json();
                } else {
                    throw new Error('Failed to load tasks');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Ensure tasks is always an array
            if (!Array.isArray(tasks)) {
                tasks = [];
            }

            console.log('Loaded tasks:', tasks.length);
            renderTasksContainer();
        } catch (error) {
            console.error('Error loading tasks:', error);
            tasks = []; // Ensure tasks is an empty array on error
            renderTasksContainer(); // Still render to show "no tasks" message
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
                    <td>${user.username}</td>
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
                <td>${job.docNo}</td>
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

    // FIXED: Render all tasks as individual cards in a grid
    function renderTasksContainer() {
        const container = document.getElementById('tasksContainer');
        container.innerHTML = '';

        if (!Array.isArray(tasks)) {
            tasks = [];
        }

        console.log('Rendering tasks:', tasks.length);

        if (tasks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No tasks found</p>';
            return;
        }


        // Sort tasks by priority: pending_approval first, then by due date
        const sortedTasks = [...tasks].sort((a, b) => {
            // Priority order: pending_approval > pending > completed
            const statusOrder = {
                'pending_approval': 0,
                'pending': 1,
                'completed': 2,
                'rejected': 3
            };

            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }

            // Then sort by due date
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        // Create a more compact grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'admin-tasks-grid';
        gridContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 16px;
            margin-top: 15px;
        `;

        sortedTasks.forEach(task => {
            gridContainer.appendChild(createTaskCard(task));
        });

        container.appendChild(gridContainer);

        // Compact summary stats at the top
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = `
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        `;

        const stats = [
            { label: 'Pending Approval', count: tasks.filter(t => t.status === 'pending_approval').length, color: '#ef4444', icon: '⏳' },
            { label: 'Pending', count: tasks.filter(t => t.status === 'pending').length, color: '#f59e0b', icon: '📋' },
            { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length, color: '#10b981', icon: '✅' },
            { label: 'Total', count: tasks.length, color: '#667eea', icon: '📊' }
        ];

        stats.forEach(stat => {
            const statCard = document.createElement('div');
            statCard.style.cssText = `
                background: white;
                padding: 12px 16px;
                border-radius: 6px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                text-align: center;
                min-width: 100px;
                flex: 1;
                max-width: 150px;
            `;
            statCard.innerHTML = `
                <div style="font-size: 1.25rem; font-weight: bold; color: ${stat.color}; margin-bottom: 2px;">
                    ${stat.icon} ${stat.count}
                </div>
                <div style="font-size: 0.75rem; color: #64748b; line-height: 1.2;">${stat.label}</div>
            `;
            statsContainer.appendChild(statCard);
        });

        container.insertBefore(statsContainer, gridContainer);
    }

    // OPTIMIZED: Compact task card creation with better space utilization
    function createTaskCard(task) {
        const card = document.createElement('div');

        const dueDate = new Date(task.dueDate);
        const today = new Date();
        const isOverdue = (task.status === 'pending' || task.status === 'pending_approval') && dueDate < today;

        // Handle populated user objects from MongoDB
        const assignedUserName = task.assignedTo?.username || 'Unknown';
        const assignedUserDept = task.assignedTo?.department || 'Unknown';
        const assignedByUserName = task.assignedBy?.username || 'System';

        // Priority colors
        const priorityColors = {
            'low': '#10b981',
            'medium': '#f59e0b',
            'high': '#ef4444',
            'urgent': '#dc2626'
        };

        // Status colors
        const statusColors = {
            'pending': '#f59e0b',
            'pending_approval': '#3b82f6',
            'completed': '#10b981',
            'rejected': '#ef4444'
        };

        const priorityColor = priorityColors[task.priority] || '#64748b';
        const statusColor = statusColors[task.status] || '#64748b';

        card.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
            border-left: 3px solid ${priorityColor};
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
        `;

        card.onmouseenter = () => {
            card.style.transform = 'translateY(-1px)';
            card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
        };

        card.onmouseleave = () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
        };

        // Compact job information
        const jobInfo = task.docNo ? `
            <div style="background: #f1f5f9; padding: 6px 8px; border-radius: 4px; margin: 8px 0; font-size: 0.8rem; line-height: 1.3;">
                <strong>📋 ${task.docNo}</strong> • ${task.customerName} • <strong>${task.itemCode}</strong> (${task.qty})
                ${task.currentStage ? ` • Stage: ${task.currentStage}` : ''}
            </div>
        ` : '';

        // Compact completion/rejection info
        const statusInfo = (() => {
            if (task.status === 'completed' && task.completedAt) {
                return `<div style="background: #f0fdf4; padding: 4px 8px; border-radius: 4px; margin: 6px 0; font-size: 0.75rem; color: #065f46;">
                    ✅ Completed: ${new Date(task.completedAt).toLocaleDateString()}
                    ${task.completionRemarks ? ` • ${task.completionRemarks}` : ''}
                </div>`;
            } else if (task.status === 'rejected' && task.rejectionReason) {
                return `<div style="background: #fef2f2; padding: 4px 8px; border-radius: 4px; margin: 6px 0; font-size: 0.75rem; color: #991b1b;">
                    ❌ Rejected: ${task.rejectionReason}
                </div>`;
            }
            return '';
        })();

        card.innerHTML = `
            <!-- Compact Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div style="flex: 1; min-width: 0;">
                    <h4 style="color: #1e293b; margin: 0 0 4px 0; font-size: 1rem; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis;">
                        ${task.title}
                    </h4>
                    <div style="font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>👤 <strong>${assignedUserName}</strong></span>
                        <span style="color: ${priorityColor}; font-weight: 600;">🏷️ ${task.priority.toUpperCase()}</span>
                        <span>📁 ${task.type.toUpperCase()}</span>
                    </div>
                </div>
                <div style="flex-shrink: 0; margin-left: 10px;">
                    <span style="
                        padding: 3px 8px; 
                        border-radius: 12px; 
                        font-size: 0.7rem; 
                        font-weight: 600;
                        background: ${statusColor}15;
                        color: ${statusColor};
                        border: 1px solid ${statusColor}30;
                        white-space: nowrap;
                        display: inline-block;
                    ">
                        ${isOverdue ? '⚠️ OVERDUE' : task.status.replace('_', ' ').toUpperCase()}
                    </span>
                </div>
            </div>

            <!-- Compact Description -->
            <div style="color: #475569; margin-bottom: 10px; font-size: 0.85rem; line-height: 1.4; 
                        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${task.description}
            </div>

            ${jobInfo}
            ${statusInfo}

            <!-- Compact Footer -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid #f1f5f9;">
                <div style="font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 10px;">
                    <span>📅 ${dueDate.toLocaleDateString()}</span>
                    ${isOverdue ? '<span style="color: #ef4444; font-weight: 600;">⚠️ Overdue</span>' : ''}
                </div>
                <div style="display: flex; gap: 4px;">
                    ${task.status === 'pending_approval' ? `
                        <button onclick="approveTask('${task._id}')" 
                                style="background: #10b981; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 500;">
                            ✓
                        </button>
                        <button onclick="rejectTask('${task._id}')" 
                                style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 500;">
                            ✗
                        </button>
                    ` : ''}
                    <button onclick="viewTaskDetails('${task._id}')" 
                            style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 500;">
                        👁️
                    </button>
                    <button onclick="editTask('${task._id}')" 
                            style="background: #8b5cf6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 500;">
                        ✏️
                    </button>
                    <button onclick="deleteTask('${task._id}')" 
                            style="background: #6b7280; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 500;">
                        🗑️
                    </button>
                </div>
            </div>
        `;

        return card;
    }

    function populateUserDropdowns() {
        const dropdown = document.getElementById('taskAssignTo');
        if (!dropdown) return;

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
                headers: getAuthHeaders(),
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
                headers: getAuthHeaders(),
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

        try {
            showMessage('Uploading file...', 'info');

            const response = await fetch(`${API_URL}/jobs/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('atpl_auth_token')}`
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
                headers: getAuthHeaders(),
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

    // FIXED: Improved task approval function
    window.approveTask = async function (taskId) {
        if (!confirm('Are you sure you want to approve this task?')) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task approved successfully', 'success');
                loadTasks(); // Reload to update UI
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            console.error('Error approving task:', error);
            showMessage('Error approving task', 'error');
        }
    };

    // NEW: Add reject task function
    window.rejectTask = async function (taskId) {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/reject`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ reason })
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task rejected successfully', 'success');
                loadTasks();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            console.error('Error rejecting task:', error);
            showMessage('Error rejecting task', 'error');
        }
    };

    window.editTask = function (taskId) {
        showMessage('Edit functionality coming soon', 'info');
    };

    // IMPROVED: Better task details view
    window.viewTaskDetails = async function (taskId) {
        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}`, {
                headers: getAuthHeaders()
            });

            const task = await response.json();

            if (task.error) {
                showMessage(task.error, 'error');
                return;
            }

            // Create a detailed modal or popup
            const details = `
                Task: ${task.title}
                Description: ${task.description}
                Assigned To: ${task.assignedTo?.username || 'Unknown'}
                Priority: ${task.priority}
                Status: ${task.status}
                Due Date: ${new Date(task.dueDate).toLocaleDateString()}
                ${task.completionRemarks ? '\nRemarks: ' + task.completionRemarks : ''}
            `;

            alert(details); // Simple popup for now
        } catch (error) {
            showMessage('Error loading task details', 'error');
        }
    };

    window.deleteTask = async function (taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task deleted successfully', 'success');
                loadTasks();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            showMessage('Error deleting task', 'error');
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
        const jobTasks = tasks.filter(t =>
            t.jobId === jobId ||
            (t.jobId && t.jobId._id === jobId) ||
            (t.jobId && t.jobId.toString() === jobId)
        );

        if (jobTasks.length === 0) {
            showMessage('No tasks found for this job', 'info');
            return;
        }

        console.log('Job tasks:', jobTasks);
        showMessage(`Found ${jobTasks.length} tasks for this job. Check console for details.`, 'info');
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

    // Enhanced task filtering with multiple options
    function filterTasks() {
        const searchInput = document.getElementById('taskSearch');
        if (!searchInput) {
            console.log('Task search input not found');
            return;
        }

        const searchTerm = searchInput.value.toLowerCase();
        const taskCards = document.querySelectorAll('.admin-tasks-grid > div');

        let visibleCount = 0;

        taskCards.forEach(card => {
            const text = card.textContent.toLowerCase();
            const isVisible = text.includes(searchTerm);
            card.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++;
        });

        // Update search results info
        updateSearchResultsInfo(searchTerm, visibleCount, tasks.length);
    }

    // Add search results information
    function updateSearchResultsInfo(searchTerm, visibleCount, totalCount) {
        let resultInfo = document.getElementById('searchResultInfo');

        if (!resultInfo) {
            resultInfo = document.createElement('div');
            resultInfo.id = 'searchResultInfo';
            resultInfo.style.cssText = `
                background: #f8fafc;
                padding: 10px 15px;
                border-radius: 6px;
                margin: 10px 0;
                font-size: 0.9rem;
                color: #64748b;
                border-left: 3px solid #3b82f6;
            `;

            const searchBar = document.querySelector('#tasks .search-bar');
            if (searchBar) {
                searchBar.appendChild(resultInfo);
            }
        }

        if (searchTerm) {
            resultInfo.textContent = `Showing ${visibleCount} of ${totalCount} tasks matching "${searchTerm}"`;
            resultInfo.style.display = 'block';
        } else {
            resultInfo.style.display = 'none';
        }
    }

    // Add compact task filtering buttons
    function addTaskFilters() {
        const tasksSection = document.getElementById('tasks');
        const existingFilters = document.getElementById('taskFilters');

        if (existingFilters) {
            existingFilters.remove();
        }

        const filtersContainer = document.createElement('div');
        filtersContainer.id = 'taskFilters';
        filtersContainer.style.cssText = `
            display: flex;
            gap: 6px;
            margin: 10px 0;
            flex-wrap: wrap;
            align-items: center;
        `;

        const filterLabel = document.createElement('span');
        filterLabel.textContent = 'Filter by:';
        filterLabel.style.cssText = 'font-weight: 600; color: #374151; margin-right: 8px; font-size: 0.9rem;';
        filtersContainer.appendChild(filterLabel);

        const filters = [
            { label: 'All', value: 'all' },
            { label: 'Pending Approval', value: 'pending_approval' },
            { label: 'Pending', value: 'pending' },
            { label: 'Completed', value: 'completed' },
            { label: 'Job Auto', value: 'job-auto' },
            { label: 'Admin Tasks', value: 'admin' },
            { label: 'User Tasks', value: 'user' }
        ];

        filters.forEach((filter, index) => {
            const button = document.createElement('button');
            button.textContent = filter.label;
            button.onclick = () => filterTasksByType(filter.value, button);
            button.style.cssText = `
                padding: 4px 10px;
                border: 1px solid #d1d5db;
                background: ${index === 0 ? '#667eea' : 'white'};
                color: ${index === 0 ? 'white' : '#374151'};
                border-radius: 16px;
                cursor: pointer;
                font-size: 0.75rem;
                font-weight: 500;
                transition: all 0.2s;
            `;

            if (index === 0) {
                button.classList.add('active');
            }

            button.onmouseenter = () => {
                if (!button.classList.contains('active')) {
                    button.style.background = '#f3f4f6';
                }
            };

            button.onmouseleave = () => {
                if (!button.classList.contains('active')) {
                    button.style.background = 'white';
                }
            };

            filtersContainer.appendChild(button);
        });

        const searchBar = document.querySelector('#tasks .search-bar');
        if (searchBar) {
            searchBar.parentNode.insertBefore(filtersContainer, searchBar.nextSibling);
        }
    }

    // Filter tasks by type/status
    function filterTasksByType(filterValue, activeButton) {
        // Update active button styling
        const allFilterButtons = document.querySelectorAll('#taskFilters button');
        allFilterButtons.forEach(btn => {
            btn.style.background = 'white';
            btn.style.color = '#374151';
            btn.classList.remove('active');
        });

        activeButton.style.background = '#667eea';
        activeButton.style.color = 'white';
        activeButton.classList.add('active');

        // Filter task cards
        const taskCards = document.querySelectorAll('.admin-tasks-grid > div');
        let visibleCount = 0;

        taskCards.forEach(card => {
            const taskText = card.textContent.toLowerCase();
            let isVisible = true;

            if (filterValue !== 'all') {
                if (filterValue === 'pending_approval') {
                    isVisible = taskText.includes('pending approval');
                } else if (filterValue === 'pending') {
                    isVisible = taskText.includes('pending') && !taskText.includes('pending approval');
                } else if (filterValue === 'completed') {
                    isVisible = taskText.includes('completed');
                } else if (filterValue === 'job-auto') {
                    isVisible = taskText.includes('job-auto');
                } else if (filterValue === 'admin') {
                    isVisible = taskText.includes('type: admin');
                } else if (filterValue === 'user') {
                    isVisible = taskText.includes('type: user') || taskText.includes('type: manual');
                }
            }

            card.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++;
        });

        // Update filter results info
        updateFilterResultsInfo(filterValue, visibleCount, tasks.length);
    }

    function updateFilterResultsInfo(filterValue, visibleCount, totalCount) {
        let resultInfo = document.getElementById('filterResultInfo');

        if (!resultInfo) {
            resultInfo = document.createElement('div');
            resultInfo.id = 'filterResultInfo';
            resultInfo.style.cssText = `
                background: #eff6ff;
                padding: 8px 12px;
                border-radius: 6px;
                margin: 10px 0;
                font-size: 0.85rem;
                color: #1e40af;
                border-left: 3px solid #3b82f6;
            `;

            const filtersContainer = document.getElementById('taskFilters');
            if (filtersContainer) {
                filtersContainer.parentNode.insertBefore(resultInfo, filtersContainer.nextSibling);
            }
        }

        if (filterValue !== 'all') {
            resultInfo.textContent = `📊 Showing ${visibleCount} ${filterValue.replace('_', ' ')} tasks of ${totalCount} total`;
            resultInfo.style.display = 'block';
        } else {
            resultInfo.style.display = 'none';
        }
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
                // Add task filters after loading tasks
                setTimeout(() => {
                    addTaskFilters();
                }, 100);
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
        const charts = document.querySelectorAll('.chart-container');
        charts.forEach(chart => {
            chart.innerHTML = `
                <div style="text-align: center;">
                    <p>Analytics data loaded</p>
                    <p>${analytics.length} users analyzed</p>
                </div>
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
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1001;
            max-width: 300px;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    async function handleAddTask(e) {
        e.preventDefault();

        const formData = new FormData(e.target);

        // Get selected users from the multiple select
        const assignToSelect = document.getElementById('taskAssignTo');
        const selectedUsers = Array.from(assignToSelect.selectedOptions).map(option => option.value);

        if (selectedUsers.length === 0) {
            showMessage('Please select at least one user to assign the task', 'error');
            return;
        }

        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            assignedTo: selectedUsers.includes('self') ?
                selectedUsers.map(id => id === 'self' ? currentUser.id : id) :
                selectedUsers,
            priority: formData.get('priority'),
            dueDate: formData.get('dueDate')
        };

        try {
            const response = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: getAuthHeaders(),
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
}); 