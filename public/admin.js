// REPLACE the entire admin.js content with this fixed version:
document.addEventListener('DOMContentLoaded', function () {
    let currentUser = null;
    let users = [];
    let jobs = [];
    let tasks = [];
    let filteredTasks = [];
    let filteredJobs = [];
    const API_URL = 'https://atpl-daily-task-management.onrender.com/api';
    // const API_URL = 'http://localhost:3000/api';

    // Check authentication
    checkAuth();



    // Navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');
    const pageTitle = document.getElementById('pageTitle');

    navButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const targetSection = this.dataset.section;

            navButtons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            this.classList.add('active');
            const targetSectionElement = document.getElementById(targetSection);
            if (targetSectionElement) {
                targetSectionElement.classList.add('active');
            }
            const titles = {
                dashboard: 'Dashboard Overview',
                tasks: 'Task Management',
                analytics: 'Analytics & Reports',
                users: 'User Management',
                jobs: 'Job Management'
            };
            if (pageTitle) {
                pageTitle.textContent = titles[targetSection] || 'Dashboard';
            }

            // Load section data using existing function
            if (typeof loadSectionData === 'function') {
                loadSectionData(targetSection);
            }
        });
    });

    setTimeout(() => {
        const applyFiltersBtn = document.getElementById('applyFilters');
        const clearFiltersBtn = document.getElementById('clearFilters');

        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', applyTaskFilters);
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', clearAllFilters);
        }

        // Add auto-filter on input change
        const filterInputs = ['taskSearch', 'userFilter', 'statusFilter', 'typeFilter', 'priorityFilter', 'departmentFilter'];
        filterInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', applyTaskFilters);
                if (element.type === 'text') {
                    element.addEventListener('input', debounce(applyTaskFilters, 300));
                }
            }
        });
    }, 100);

    setTimeout(() => {
        // Job filter event listeners
        const applyJobFiltersBtn = document.getElementById('applyJobFilters');
        const clearJobFiltersBtn = document.getElementById('clearJobFilters');

        if (applyJobFiltersBtn) {
            applyJobFiltersBtn.addEventListener('click', applyJobFilters);
        }

        if (clearJobFiltersBtn) {
            clearJobFiltersBtn.addEventListener('click', clearJobFilters);
        }

        // Add auto-filter on input change for jobs
        const jobFilterInputs = [
            'docNoFilter', 'customerFilter', 'itemCodeFilter', 'descriptionFilter',
            'qtyFilter', 'monthFilter', 'weekFilter', 'statusJobFilter', 'dueDateFilter'
        ];

        jobFilterInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'text' || element.type === 'number') {
                    element.addEventListener('input', debounce(applyJobFilters, 300));
                } else {
                    element.addEventListener('change', applyJobFilters);
                }
            }
        });
    }, 100);


    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Modal background click handler
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });

    window.openModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    };

    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    };


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

    function populateFilterDropdowns() {
        // Populate user dropdown
        const userFilter = document.getElementById('userFilter');
        if (userFilter && users.length > 0) {
            userFilter.innerHTML = '<option value="">All Users</option>';
            const userOptions = [...new Set(users.map(u => u.username))];
            userOptions.forEach(username => {
                const option = document.createElement('option');
                option.value = username;
                option.textContent = username;
                userFilter.appendChild(option);
            });
        }
    }

    function calculateJobDueDate(job) {
        // Calculate due date based on status and creation date
        const createdDate = new Date(job.createdAt || Date.now());
        const statusDays = {
            'sales order received': 7,
            'drawing approved': 14,
            'long lead item detail given': 10,
            'drawing/bom issued': 7,
            'production order and purchase request prepared': 5,
            'rm received': 21,
            'production started': 14,
            'production completed': 7,
            'qc clear for dispatch': 3,
            'dispatch clearance': 2,
            'completed': 0,
            'hold': 3,
            'hold cleared': 7,
            'so cancelled': 0
        };

        const daysToAdd = statusDays[job.status] || 7;
        const dueDate = new Date(createdDate);
        dueDate.setDate(dueDate.getDate() + daysToAdd);

        return dueDate;
    }

    function applyTaskFilters() {
        const searchTerm = document.getElementById('taskSearch')?.value.toLowerCase() || '';
        const userFilter = document.getElementById('userFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const typeFilter = document.getElementById('typeFilter')?.value || '';
        const priorityFilter = document.getElementById('priorityFilter')?.value || '';
        const departmentFilter = document.getElementById('departmentFilter')?.value || '';

        filteredTasks = tasks.filter(task => {
            // Search filter
            if (searchTerm && !task.title.toLowerCase().includes(searchTerm) &&
                !task.description.toLowerCase().includes(searchTerm) &&
                !(task.docNo && task.docNo.toLowerCase().includes(searchTerm)) &&
                !(task.customerName && task.customerName.toLowerCase().includes(searchTerm))) {
                return false;
            }

            // User filter
            if (userFilter) {
                const assignedUsernames = Array.isArray(task.assignedTo)
                    ? task.assignedTo.map(user => user?.username || '').filter(Boolean)
                    : [task.assignedTo?.username || ''];
                if (!assignedUsernames.includes(userFilter)) {
                    return false;
                }
            }

            // Status filter
            if (statusFilter && task.status !== statusFilter) {
                return false;
            }

            // Type filter
            if (typeFilter && task.type !== typeFilter) {
                return false;
            }

            // Priority filter
            if (priorityFilter && task.priority !== priorityFilter) {
                return false;
            }

            // Department filter
            if (departmentFilter) {
                const assignedDepartments = Array.isArray(task.assignedTo)
                    ? task.assignedTo.map(user => user?.department || '').filter(Boolean)
                    : [task.assignedTo?.department || ''];
                if (!assignedDepartments.includes(departmentFilter)) {
                    return false;
                }
            }

            return true;
        });

        renderFilteredTasks();
        updateFilterResultsInfo();
    }

    function renderFilteredTasks() {
        const container = document.getElementById('tasksContainer');
        container.innerHTML = '';

        if (filteredTasks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No tasks match the current filters</p>';
            return;
        }

        // Sort tasks by status priority
        const sortedTasks = [...filteredTasks].sort((a, b) => {
            const statusOrder = {
                'pending_approval': 0,
                'pending': 1,
                'completed': 2,
                'rejected': 3
            };
            return statusOrder[a.status] - statusOrder[b.status];
        });

        // Create grid container
        const gridContainer = document.createElement('div');
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
    }

    function updateFilterResultsInfo() {
        const resultInfo = document.getElementById('filterResultsInfo');
        if (resultInfo) {
            const totalTasks = tasks.length;
            const filteredCount = filteredTasks.length;

            resultInfo.textContent = `Showing ${filteredCount} of ${totalTasks} tasks`;
            resultInfo.style.display = 'block';
        }
    }

    function clearAllFilters() {
        document.getElementById('taskSearch').value = '';
        document.getElementById('userFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('typeFilter').value = '';
        document.getElementById('priorityFilter').value = '';
        document.getElementById('departmentFilter').value = '';

        filteredTasks = [...tasks];
        renderFilteredTasks();

        const resultInfo = document.getElementById('filterResultsInfo');
        if (resultInfo) {
            resultInfo.style.display = 'none';
        }
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

            // Initialize filtered jobs
            filteredJobs = [];

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

            if (!Array.isArray(tasks)) {
                tasks = [];
            }

            // Initialize filtered tasks
            filteredTasks = [...tasks];

            // Populate filter dropdowns
            populateFilterDropdowns();

            // Render tasks
            renderFilteredTasks();

        } catch (error) {
            console.error('Error loading tasks:', error);
            tasks = [];
            filteredTasks = [];
            renderFilteredTasks();
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

        // Use filtered jobs or all jobs
        const jobsToRender = filteredJobs.length > 0 || isFilterActive() ? filteredJobs : jobs;

        if (jobsToRender.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
            <td colspan="10" style="text-align: center; padding: 2rem; color: #64748b;">
                ${isFilterActive() ? 'No jobs match the current filters' : 'No jobs found'}
            </td>
        `;
            tbody.appendChild(row);
            return;
        }

        jobsToRender.forEach(job => {
            const row = document.createElement('tr');
            const dueDate = calculateJobDueDate(job);
            const isOverdue = new Date() > dueDate && job.status !== 'completed' && job.status !== 'so cancelled';

            // Status color coding
            const getStatusClass = (status) => {
                if (status === 'completed') return 'status-completed';
                if (status === 'so cancelled') return 'status-rejected';
                if (status === 'hold') return 'status-overdue';
                if (isOverdue) return 'status-overdue';
                return 'status-pending';
            };

            row.innerHTML = `
            <td><strong>${job.docNo}</strong></td>
            <td>${job.customerName}</td>
            <td><code>${job.itemCode}</code></td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${job.description}">
                ${job.description}
            </td>
            <td style="text-align: center;"><strong>${job.qty}</strong></td>
            <td>${job.month}</td>
            <td>${job.week}</td>
            <td>
                <span class="task-status ${getStatusClass(job.status)}">
                    ${job.status.toUpperCase()}
                </span>
            </td>
            <td style="color: ${isOverdue ? '#ef4444' : '#64748b'};">
                ${dueDate.toLocaleDateString()}
                ${isOverdue ? '<br><small style="color: #ef4444;">⚠️ Overdue</small>' : ''}
            </td>
            <td>
                <button class="btn-small btn-primary" onclick="editJob('${job._id}')" title="Edit Job">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-small btn-warning" onclick="viewJobTasks('${job._id}')" title="View Tasks">
                    <i class="fas fa-tasks"></i>
                </button>
            </td>
        `;
            tbody.appendChild(row);
        });

        // Update results info
        updateJobFilterResults();
    }

    // FIXED: Render all tasks as individual cards in a grid
    function renderTasksContainer() {
        const container = document.getElementById('tasksContainer');
        container.innerHTML = '';

        if (!Array.isArray(tasks)) {
            tasks = [];
        }


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

    function isFilterActive() {
        const filters = [
            'docNoFilter', 'customerFilter', 'itemCodeFilter', 'descriptionFilter',
            'qtyFilter', 'monthFilter', 'weekFilter', 'statusJobFilter', 'dueDateFilter'
        ];

        return filters.some(filterId => {
            const element = document.getElementById(filterId);
            return element && element.value.trim() !== '';
        });
    }

    function applyJobFilters() {
        const filters = {
            docNo: document.getElementById('docNoFilter')?.value.toLowerCase().trim() || '',
            customer: document.getElementById('customerFilter')?.value.toLowerCase().trim() || '',
            itemCode: document.getElementById('itemCodeFilter')?.value.toLowerCase().trim() || '',
            description: document.getElementById('descriptionFilter')?.value.toLowerCase().trim() || '',
            qty: document.getElementById('qtyFilter')?.value || '',
            month: document.getElementById('monthFilter')?.value.toLowerCase().trim() || '',
            week: document.getElementById('weekFilter')?.value.toLowerCase().trim() || '',
            status: document.getElementById('statusJobFilter')?.value || '',
            dueDate: document.getElementById('dueDateFilter')?.value || ''
        };

        filteredJobs = jobs.filter(job => {
            // Doc No filter
            if (filters.docNo && !job.docNo.toLowerCase().includes(filters.docNo)) {
                return false;
            }

            // Customer filter
            if (filters.customer && !job.customerName.toLowerCase().includes(filters.customer)) {
                return false;
            }

            // Item Code filter
            if (filters.itemCode && !job.itemCode.toLowerCase().includes(filters.itemCode)) {
                return false;
            }

            // Description filter
            if (filters.description && !job.description.toLowerCase().includes(filters.description)) {
                return false;
            }

            // Quantity filter (minimum quantity)
            if (filters.qty && job.qty < parseInt(filters.qty)) {
                return false;
            }

            // Month filter
            if (filters.month && !job.month.toLowerCase().includes(filters.month)) {
                return false;
            }

            // Week filter
            if (filters.week && !job.week.toLowerCase().includes(filters.week)) {
                return false;
            }

            // Status filter
            if (filters.status && job.status !== filters.status) {
                return false;
            }

            // Due Date filter
            if (filters.dueDate) {
                const jobDueDate = calculateJobDueDate(job);
                const filterDate = new Date(filters.dueDate);
                if (jobDueDate.toDateString() !== filterDate.toDateString()) {
                    return false;
                }
            }

            return true;
        });

        renderJobsTable();
    }

    function clearJobFilters() {
        const filterIds = [
            'docNoFilter', 'customerFilter', 'itemCodeFilter', 'descriptionFilter',
            'qtyFilter', 'monthFilter', 'weekFilter', 'statusJobFilter', 'dueDateFilter'
        ];

        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
            }
        });

        filteredJobs = [];
        renderJobsTable();
    }

    function updateJobFilterResults() {
        const resultElement = document.getElementById('jobFilterResults');
        if (resultElement) {
            if (isFilterActive()) {
                const total = jobs.length;
                const filtered = filteredJobs.length;
                resultElement.textContent = `Showing ${filtered} of ${total} jobs`;
            } else {
                resultElement.textContent = `Total: ${jobs.length} jobs`;
            }
        }
    }


    // OPTIMIZED: Compact task card creation with better space utilization
    function createTaskCard(task) {
        const card = document.createElement('div');

        const dueDate = new Date(task.dueDate);
        const today = new Date();
        const isOverdue = (task.status === 'pending' || task.status === 'pending_approval') && dueDate < today;

        // FIXED: Handle populated user objects from MongoDB properly
        let assignedUserName = 'Unknown';
        let assignedUserDept = 'Unknown';

        if (task.assignedTo) {
            if (Array.isArray(task.assignedTo)) {
                // Multiple assignees
                assignedUserName = task.assignedTo
                    .map(user => user?.username || 'Unknown')
                    .join(', ');
                assignedUserDept = task.assignedTo
                    .map(user => user?.department || 'Unknown')
                    .join(', ');
            } else {
                // Single assignee
                assignedUserName = task.assignedTo.username || 'Unknown';
                assignedUserDept = task.assignedTo.department || 'Unknown';
            }
        }

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
        margin-bottom: 12px;
    `;

        card.onmouseenter = () => {
            card.style.transform = 'translateY(-1px)';
            card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
        };

        card.onmouseleave = () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
        };

        // UPDATED: Compact job information - show customer name instead of auto-generated text
        const jobInfo = task.docNo ? `
        <div style="background: #f1f5f9; padding: 8px 10px; border-radius: 4px; margin: 8px 0; font-size: 0.8rem; line-height: 1.3;">
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
                    <span>👤 <strong>${assignedUserName}</strong> (${assignedUserDept})</span>
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