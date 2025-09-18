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

    startAnalyticsUpdates();


    // Add export button to analytics section if admin
    setTimeout(() => {
        const user = getCurrentUser();
        if (user && (user.role === 'admin' || user.role === 'super-admin')) {
            const analyticsSection = document.getElementById('analytics');
            const sectionHeader = analyticsSection.querySelector('.section-header');

            if (sectionHeader && !sectionHeader.querySelector('.export-analytics-btn')) {
                const exportBtn = document.createElement('button');
                exportBtn.className = 'btn btn-secondary export-analytics-btn';
                exportBtn.innerHTML = '<i class="fas fa-download"></i> Export Report';
                exportBtn.onclick = exportAnalyticsReport;

                const actionButtons = sectionHeader.querySelector('.action-buttons');
                if (actionButtons) {
                    actionButtons.appendChild(exportBtn);
                }
            }
        }
    }, 1000);

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

    setTimeout(makeDashboardStatsClickable, 500);


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
                loadTasks(),
                loadUpcomingDueDates(),

            ]);
            loadAdvancedAnalytics()
            updateDashboardStats();
        } catch (error) {
            showMessage('Error loading dashboard', 'error');
        }
    }

    function setButtonLoading(button, isLoading, loadingText = 'Processing...') {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = loadingText;
            button.classList.add('btn-loading');
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Submit';
            button.classList.remove('btn-loading');
            delete button.dataset.originalText;
        }
    }

    function showGlobalLoading(text = 'Processing...', subtext = 'Please wait while we complete your request') {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loadingSubtext').textContent = subtext;
        document.getElementById('loadingOverlay').classList.add('active');
    }

    function hideGlobalLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    // Enhanced Toast Notification System
    function showToast(message, type = 'success') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Inline Loading Functions
    function showInlineLoader(elementId, text = 'Loading...') {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
            <div class="inline-loader">
                <div class="inline-spinner"></div>
                <span>${text}</span>
            </div>
        `;
            element.style.display = 'flex';
        }
    }

    function hideInlineLoader(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';
        }
    }

    // List Loading Functions
    function generateSkeletonLoading(rows = 5) {
        return Array.from({ length: rows }, () => `
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
            <div class="skeleton-loader wide"></div>
            <div class="skeleton-loader medium" style="margin-top: 8px;"></div>
            <div class="skeleton-loader narrow" style="margin-top: 4px;"></div>
        </div>
    `).join('');
    }

    function showListLoading(containerId, rows = 5) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = generateSkeletonLoading(rows);
        }
    }

    // Form Loading Functions
    function setFormLoading(formId, isLoading) {
        const form = document.getElementById(formId);
        if (form) {
            if (isLoading) {
                form.classList.add('form-loading');
            } else {
                form.classList.remove('form-loading');
            }
        }
    }

    // Progress Bar Functions
    function showProgressBar(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
            <div class="progress-bar">
                <div class="progress-indeterminate"></div>
            </div>
        `;
        }
    }

    function hideProgressBar(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            const progressBar = container.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.remove();
            }
        }
    }

    function getCurrentUser() {
        const userInfo = localStorage.getItem('atpl_user_info');
        if (userInfo) {
            try {
                return JSON.parse(userInfo);
            } catch (error) {
                console.error('Error parsing user info:', error);
                return null;
            }
        }
        return null;
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

    function setupTaskFormProtection() {
        // For Admin Panel
        const adminTaskForm = document.getElementById('addTaskForm');
        if (adminTaskForm) {
            adminTaskForm.addEventListener('submit', async function (e) {
                e.preventDefault();

                const submitButton = adminTaskForm.querySelector('button[type="submit"]');
                if (!submitButton) return;

                // Check if already submitting
                if (submitButton.disabled) {
                    showMessage('Please wait, task is being created...', 'warning');
                    return false;
                }

                // Disable submit button and show loading state
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = 'Creating Task...';
                submitButton.classList.add('loading');

                try {
                    await handleAddTask(e);
                } finally {
                    // Re-enable button after delay
                    setTimeout(() => {
                        submitButton.disabled = false;
                        submitButton.textContent = originalText;
                        submitButton.classList.remove('loading');
                    }, 2000);
                }

                return false;
            });
        }

        // For User Panel - Peer Task Assignment
        const peerTaskForm = document.getElementById('assignPeerTaskForm');
        if (peerTaskForm) {
            peerTaskForm.addEventListener('submit', async function (e) {
                e.preventDefault();

                const submitButton = peerTaskForm.querySelector('button[type="submit"]');
                if (!submitButton) return;

                // Check if already submitting
                if (submitButton.disabled) {
                    showMessage('Please wait, task is being created...', 'warning');
                    return false;
                }

                // Disable submit button and show loading state
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = 'Assigning Task...';
                submitButton.classList.add('loading');

                try {
                    const formData = new FormData(peerTaskForm);
                    const assignToSelect = document.getElementById('peerTaskAssignTo');
                    const selectedUsers = Array.from(assignToSelect.selectedOptions).map(option => option.value);

                    if (selectedUsers.length === 0) {
                        showMessage('Please select at least one colleague to assign the task', 'error');
                        return;
                    }

                    const taskData = {
                        title: formData.get('title').trim(),
                        description: formData.get('description').trim(),
                        assignedTo: selectedUsers,
                        priority: formData.get('priority'),
                        dueDate: formData.get('dueDate')
                    };

                    const response = await fetch(`${API_URL}/tasks/assign-peer`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('atpl_auth_token')}`
                        },
                        body: JSON.stringify(taskData)
                    });

                    const result = await response.json();

                    if (response.ok) {
                        if (result.type === 'DUPLICATE_TASK') {
                            showMessage(`Duplicate prevented: ${result.error}`, 'warning');
                        } else {
                            showMessage('Task assigned successfully to colleagues', 'success');
                            closeModal('assignPeerTaskModal');
                            peerTaskForm.reset();
                            if (typeof loadTasks === 'function') loadTasks();
                        }
                    } else {
                        if (result.type === 'DUPLICATE_TASK') {
                            showMessage(`Duplicate prevented: ${result.error}`, 'warning');
                        } else {
                            showMessage(result.error || 'Failed to assign task', 'error');
                        }
                    }
                } catch (error) {
                    console.error('Error assigning task:', error);
                    showMessage('Network error. Please try again.', 'error');
                } finally {
                    // Re-enable button after delay
                    setTimeout(() => {
                        submitButton.disabled = false;
                        submitButton.textContent = originalText;
                        submitButton.classList.remove('loading');
                    }, 2000);
                }

                return false;
            });
        }
    }

    // Call this when DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(setupTaskFormProtection, 100); // Small delay to ensure forms are loaded
    });

    function makeDashboardStatsClickable() {
        // Add click handlers to stat cards
        document.getElementById('totalUsers')?.parentElement?.parentElement?.addEventListener('click', () => {
            switchToSection('users');
        });

        document.getElementById('totalJobs')?.parentElement?.parentElement?.addEventListener('click', () => {
            switchToSection('jobs');
        });

        document.getElementById('activeTasks')?.parentElement?.parentElement?.addEventListener('click', () => {
            switchToSection('tasks');
            filterTasksByStatus('pending');
        });

        document.getElementById('pendingApprovals')?.parentElement?.parentElement?.addEventListener('click', () => {
            switchToSection('tasks');
            filterTasksByStatus('pending_approval');
        });
    }

    function filterTasksByStatus(status) {
        setTimeout(() => {
            const statusFilter = document.getElementById('statusFilter');
            if (statusFilter) {
                statusFilter.value = status;
                applyTaskFilters();
            }
        }, 100);
    }

    // Switch to specific section
    function switchToSection(sectionName) {
        const navButtons = document.querySelectorAll('.nav-btn');
        const sections = document.querySelectorAll('.section');
        const pageTitle = document.getElementById('pageTitle');

        navButtons.forEach(btn => btn.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));

        const targetButton = document.querySelector(`[data-section="${sectionName}"]`);
        const targetSection = document.getElementById(sectionName);

        if (targetButton && targetSection) {
            targetButton.classList.add('active');
            targetSection.classList.add('active');

            const titles = {
                dashboard: 'Dashboard Overview',
                tasks: 'Task Management',
                analytics: 'Analytics & Reports',
                users: 'User Management',
                jobs: 'Job Management'
            };

            if (pageTitle) {
                pageTitle.textContent = titles[sectionName] || 'Dashboard';
            }

            loadSectionData(sectionName);
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

    async function loadUpcomingDueDates() {
        try {
            // Since the due-dates endpoint doesn't exist, we'll calculate from tasks
            if (!tasks || tasks.length === 0) {
                console.log('No tasks available for due date calculation');
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const thisWeek = new Date(today);
            thisWeek.setDate(today.getDate() + 7);

            // Calculate due dates from existing tasks
            const dueDates = {
                today: tasks.filter(task => {
                    const taskDate = new Date(task.dueDate);
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate.getTime() === today.getTime() && task.status === 'pending';
                }),
                tomorrow: tasks.filter(task => {
                    const taskDate = new Date(task.dueDate);
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate.getTime() === tomorrow.getTime() && task.status === 'pending';
                }),
                thisWeek: tasks.filter(task => {
                    const taskDate = new Date(task.dueDate);
                    return taskDate > tomorrow && taskDate <= thisWeek && task.status === 'pending';
                }),
                overdue: tasks.filter(task => {
                    const taskDate = new Date(task.dueDate);
                    return taskDate < today && task.status === 'pending';
                })
            };

            renderUpcomingDueDates(dueDates);
        } catch (error) {
            console.error('Error loading due dates:', error);
        }
    }

    // 3. UPDATE the renderUpcomingDueDates function to handle the new data structure
    function renderUpcomingDueDates(dueDates) {
        // Update due today section
        const dueTodayElement = document.getElementById('dueToday');
        const dueTodayContainer = document.querySelector('#dueTodayTasks');

        if (dueTodayElement) {
            dueTodayElement.textContent = dueDates.today ? dueDates.today.length : 0;
        }

        if (dueTodayContainer) {
            dueTodayContainer.innerHTML = '';

            if (dueDates.today && dueDates.today.length > 0) {
                dueDates.today.forEach(task => {
                    const taskElement = document.createElement('div');
                    taskElement.className = 'task-item';
                    taskElement.style.cssText = 'padding: 8px; border-left: 3px solid #ef4444; margin: 5px 0; background: #fef2f2; border-radius: 4px;';
                    taskElement.innerHTML = `
                    <div style="font-weight: 500; color: #dc2626;">${task.title}</div>
                    <div style="font-size: 12px; color: #7f1d1d;">${task.description}</div>
                    <div style="font-size: 11px; color: #991b1b; margin-top: 4px;">
                        Priority: ${task.priority.toUpperCase()}
                    </div>
                `;
                    dueTodayContainer.appendChild(taskElement);
                });
            } else {
                dueTodayContainer.innerHTML = '<p style="color: #64748b; font-size: 14px; text-align: center; padding: 10px;">No tasks due today</p>';
            }
        }

        // Update due tomorrow section
        const dueTomorrowElement = document.getElementById('dueTomorrow');
        const dueTomorrowContainer = document.querySelector('#dueTomorrowTasks');

        if (dueTomorrowElement) {
            dueTomorrowElement.textContent = dueDates.tomorrow ? dueDates.tomorrow.length : 0;
        }

        if (dueTomorrowContainer) {
            dueTomorrowContainer.innerHTML = '';

            if (dueDates.tomorrow && dueDates.tomorrow.length > 0) {
                dueDates.tomorrow.forEach(task => {
                    const taskElement = document.createElement('div');
                    taskElement.className = 'task-item';
                    taskElement.style.cssText = 'padding: 8px; border-left: 3px solid #f59e0b; margin: 5px 0; background: #fffbeb; border-radius: 4px;';
                    taskElement.innerHTML = `
                    <div style="font-weight: 500; color: #d97706;">${task.title}</div>
                    <div style="font-size: 12px; color: #92400e;">${task.description}</div>
                    <div style="font-size: 11px; color: #78350f; margin-top: 4px;">
                        Priority: ${task.priority.toUpperCase()}
                    </div>
                `;
                    dueTomorrowContainer.appendChild(taskElement);
                });
            } else {
                dueTomorrowContainer.innerHTML = '<p style="color: #64748b; font-size: 14px; text-align: center; padding: 10px;">No tasks due tomorrow</p>';
            }
        }

        // Update this week section
        const dueThisWeekElement = document.getElementById('dueThisWeek');
        const dueThisWeekContainer = document.querySelector('#dueThisWeekTasks');

        if (dueThisWeekElement) {
            dueThisWeekElement.textContent = dueDates.thisWeek ? dueDates.thisWeek.length : 0;
        }

        if (dueThisWeekContainer) {
            dueThisWeekContainer.innerHTML = '';

            if (dueDates.thisWeek && dueDates.thisWeek.length > 0) {
                dueDates.thisWeek.forEach(task => {
                    const taskElement = document.createElement('div');
                    taskElement.className = 'task-item';
                    taskElement.style.cssText = 'padding: 8px; border-left: 3px solid #3b82f6; margin: 5px 0; background: #eff6ff; border-radius: 4px;';
                    taskElement.innerHTML = `
                    <div style="font-weight: 500; color: #2563eb;">${task.title}</div>
                    <div style="font-size: 12px; color: #1d4ed8;">${task.description}</div>
                    <div style="font-size: 11px; color: #1e40af; margin-top: 4px;">
                        Due: ${new Date(task.dueDate).toLocaleDateString()} | Priority: ${task.priority.toUpperCase()}
                    </div>
                `;
                    dueThisWeekContainer.appendChild(taskElement);
                });
            } else {
                dueThisWeekContainer.innerHTML = '<p style="color: #64748b; font-size: 14px; text-align: center; padding: 10px;">No tasks due this week</p>';
            }
        }

        // Update overdue section
        const overdueElement = document.getElementById('overdue');
        const overdueContainer = document.querySelector('#overdueTasks');

        if (overdueElement) {
            overdueElement.textContent = dueDates.overdue ? dueDates.overdue.length : 0;
        }

        if (overdueContainer) {
            overdueContainer.innerHTML = '';

            if (dueDates.overdue && dueDates.overdue.length > 0) {
                dueDates.overdue.forEach(task => {
                    const taskElement = document.createElement('div');
                    taskElement.className = 'task-item';
                    taskElement.style.cssText = 'padding: 8px; border-left: 3px solid #dc2626; margin: 5px 0; background: #fef2f2; border-radius: 4px;';
                    taskElement.innerHTML = `
                    <div style="font-weight: 500; color: #dc2626;">${task.title}</div>
                    <div style="font-size: 12px; color: #7f1d1d;">${task.description}</div>
                    <div style="font-size: 11px; color: #991b1b; margin-top: 4px;">
                        Overdue by: ${Math.ceil((new Date() - new Date(task.dueDate)) / (1000 * 60 * 60 * 24))} days | Priority: ${task.priority.toUpperCase()}
                    </div>
                `;
                    overdueContainer.appendChild(taskElement);
                });
            } else {
                overdueContainer.innerHTML = '<p style="color: #64748b; font-size: 14px; text-align: center; padding: 10px;">No overdue tasks</p>';
            }
        }
    }

    function createClickableDueTaskItem(task, category) {
        const taskItem = document.createElement('div');
        taskItem.className = 'due-task-item';
        taskItem.style.cssText = `
        padding: 8px;
        margin-bottom: 6px;
        background: ${category === 'today' ? '#fef2f2' : '#fefbf0'};
        border-radius: 6px;
        border-left: 3px solid ${category === 'today' ? '#ef4444' : '#f59e0b'};
        cursor: pointer;
        transition: all 0.2s ease;
    `;

        const assigneeName = Array.isArray(task.assignedTo)
            ? task.assignedTo.map(u => u.username).join(', ')
            : (task.assignedTo?.username || 'Unknown');

        taskItem.innerHTML = `
        <div style="font-weight: 600; font-size: 0.8rem; margin-bottom: 2px; color: #1e293b;">
            ${task.title}
        </div>
        <div style="font-size: 0.7rem; color: #64748b; margin-bottom: 2px;">
            Assigned to: ${assigneeName}
        </div>
        <div style="font-size: 0.7rem; color: ${category === 'today' ? '#ef4444' : '#f59e0b'}; font-weight: 600;">
            ${task.priority.toUpperCase()} • ${task.type.toUpperCase()}
        </div>
    `;

        taskItem.addEventListener('mouseenter', () => {
            taskItem.style.transform = 'translateX(4px)';
            taskItem.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        });

        taskItem.addEventListener('mouseleave', () => {
            taskItem.style.transform = 'translateX(0)';
            taskItem.style.boxShadow = 'none';
        });

        taskItem.addEventListener('click', () => {
            openTaskModal(task);
        });

        return taskItem;
    }

    function openTaskModal(task) {
        // Create task details modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';

        const isOverdue = new Date() > new Date(task.dueDate) && task.status === 'pending';
        const canApprove = task.status === 'pending_approval';

        modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title">Task Details</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="padding: 0 0 20px 0;">
                <div style="background: ${isOverdue ? '#fef2f2' : '#f8fafc'}; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid ${isOverdue ? '#ef4444' : '#3b82f6'};">
                    <h4 style="margin: 0 0 8px 0; color: #1e293b;">${task.title}</h4>
                    <p style="margin: 0 0 10px 0; color: #64748b; line-height: 1.4;">${task.description}</p>
                    <div style="display: flex; gap: 15px; font-size: 0.8rem; color: #64748b;">
                        <span><strong>Priority:</strong> ${task.priority.toUpperCase()}</span>
                        <span><strong>Type:</strong> ${task.type.toUpperCase()}</span>
                        <span><strong>Status:</strong> ${task.status.replace('_', ' ').toUpperCase()}</span>
                    </div>
                </div>
                
                ${task.jobDetails ? `
                    <div style="background: #eff6ff; padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
                        <h5 style="margin: 0 0 6px 0; color: #1e40af;">📋 Job Details</h5>
                        <div style="font-size: 0.85rem; color: #1e40af;">
                            <div><strong>Doc No:</strong> ${task.jobDetails.docNo}</div>
                            <div><strong>Customer:</strong> ${task.jobDetails.customerName}</div>
                            <div><strong>Item Code:</strong> ${task.jobDetails.itemCode}</div>
                            <div><strong>Quantity:</strong> ${task.jobDetails.qty}</div>
                            ${task.jobDetails.description ? `<div><strong>Description:</strong> ${task.jobDetails.description}</div>` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <strong style="color: #374151;">Due Date:</strong><br>
                        <span style="color: ${isOverdue ? '#ef4444' : '#64748b'}; font-weight: ${isOverdue ? '600' : 'normal'};">
                            ${new Date(task.dueDate).toLocaleDateString()}
                            ${isOverdue ? ' (OVERDUE)' : ''}
                        </span>
                    </div>
                    <div>
                        <strong style="color: #374151;">Assigned To:</strong><br>
                        <span style="color: #64748b;">
                            ${Array.isArray(task.assignedTo)
                ? task.assignedTo.map(u => u.username).join(', ')
                : (task.assignedTo?.username || 'Unknown')}
                        </span>
                    </div>
                </div>
                
                ${task.completionRemarks ? `
                    <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #10b981;">
                        <strong style="color: #065f46;">Completion Remarks:</strong><br>
                        <span style="color: #166534;">${task.completionRemarks}</span>
                    </div>
                ` : ''}
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    ${canApprove ? `
                        <button onclick="approveTaskFromModal('${task._id}')" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            ✓ Approve
                        </button>
                        <button onclick="rejectTaskFromModal('${task._id}')" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            ✗ Reject
                        </button>
                    ` : ''}
                    <button onclick="this.closest('.modal').remove()" style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

        document.body.appendChild(modal);
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

    async function loadAdvancedAnalytics() {
        try {
            const [comprehensive, leaderboard] = await Promise.all([
                fetch(`${API_URL}/analytics/comprehensive?period=30`, {
                    headers: getAuthHeaders()
                }).then(r => r.json()),
                fetch(`${API_URL}/analytics/leaderboard`, {
                    headers: getAuthHeaders()
                }).then(r => r.json())
            ]);

            renderComprehensiveAnalytics(comprehensive);
            renderLeaderboard(leaderboard);
        } catch (error) {
            console.error('Error loading advanced analytics:', error);
        }
    }

    function renderComprehensiveAnalytics(data) {
        const analyticsSection = document.getElementById('analytics');

        // Clear existing content
        const existingOverview = analyticsSection.querySelector('.analytics-overview');
        if (existingOverview) {
            existingOverview.innerHTML = '';
        }

        // Create comprehensive analytics dashboard
        const analyticsContainer = document.createElement('div');
        analyticsContainer.className = 'comprehensive-analytics';
        analyticsContainer.innerHTML = `
        <!-- Performance Summary -->
        <div class="analytics-grid" style="margin-bottom: 2rem;">
            <div class="analytics-card performance-summary">
                <h3><i class="fas fa-chart-line"></i> Performance Summary</h3>
                <div class="performance-metrics">
                    <div class="metric-row">
                        <span class="metric-label">Total Tasks (${data.summary.period})</span>
                        <span class="metric-value">${data.summary.totalTasks}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Completion Rate</span>
                        <span class="metric-value">${data.performance.completionRate}%</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">On-Time Delivery</span>
                        <span class="metric-value">${data.performance.onTimeDeliveryRate}%</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Task Velocity</span>
                        <span class="metric-value">${data.performance.taskVelocity} tasks/day</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Avg Completion Time</span>
                        <span class="metric-value">${data.performance.averageCompletionTime} days</span>
                    </div>
                </div>
            </div>

            <div class="analytics-card risk-analysis">
                <h3><i class="fas fa-exclamation-triangle"></i> Risk Analysis</h3>
                <div class="risk-metrics">
                    <div class="risk-item ${data.riskAnalysis.overdueTasks.length > 5 ? 'high-risk' : data.riskAnalysis.overdueTasks.length > 2 ? 'medium-risk' : 'low-risk'}">
                        <div class="risk-icon">⚠️</div>
                        <div class="risk-info">
                            <div class="risk-title">Overdue Tasks</div>
                            <div class="risk-value">${data.riskAnalysis.overdueTasks.length}</div>
                        </div>
                    </div>
                    <div class="risk-item ${data.riskAnalysis.upcomingDeadlines.length > 10 ? 'high-risk' : data.riskAnalysis.upcomingDeadlines.length > 5 ? 'medium-risk' : 'low-risk'}">
                        <div class="risk-icon">📅</div>
                        <div class="risk-info">
                            <div class="risk-title">Due in 3 Days</div>
                            <div class="risk-value">${data.riskAnalysis.upcomingDeadlines.length}</div>
                        </div>
                    </div>
                    <div class="risk-item ${data.riskAnalysis.bottlenecks.length > 3 ? 'high-risk' : data.riskAnalysis.bottlenecks.length > 1 ? 'medium-risk' : 'low-risk'}">
                        <div class="risk-icon">🚧</div>
                        <div class="risk-info">
                            <div class="risk-title">Bottlenecks</div>
                            <div class="risk-value">${data.riskAnalysis.bottlenecks.length}</div>
                        </div>
                    </div>
                </div>
                ${data.riskAnalysis.bottlenecks.length > 0 ? `
                    <div class="bottlenecks-list" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                        <h5 style="margin-bottom: 0.5rem; color: #ef4444;">⚠️ Identified Bottlenecks:</h5>
                        ${data.riskAnalysis.bottlenecks.map(bottleneck => `
                            <div class="bottleneck-item" style="padding: 0.5rem; background: #fef2f2; border-radius: 4px; margin-bottom: 0.5rem; border-left: 3px solid #ef4444;">
                                <strong>${bottleneck.type === 'user_overload' ? '👤 User Overload' : '⚙️ Stage Delay'}:</strong>
                                ${bottleneck.type === 'user_overload' ?
                `${bottleneck.pendingTasks} pending tasks` :
                `${bottleneck.stage} (${bottleneck.averageDays} days avg)`
            }
                                <span class="severity ${bottleneck.severity}" style="float: right; font-size: 0.8rem; font-weight: 600; color: ${bottleneck.severity === 'high' ? '#dc2626' : '#f59e0b'};">
                                    ${bottleneck.severity.toUpperCase()}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="analytics-card forecasting">
                <h3><i class="fas fa-crystal-ball"></i> Forecasting</h3>
                <div class="forecast-metrics">
                    <div class="forecast-item">
                        <div class="forecast-icon">📈</div>
                        <div class="forecast-info">
                            <div class="forecast-title">Next Week Completions</div>
                            <div class="forecast-value">${data.forecasting.projectedCompletions.nextWeek}</div>
                        </div>
                    </div>
                    <div class="forecast-item">
                        <div class="forecast-icon">📊</div>
                        <div class="forecast-info">
                            <div class="forecast-title">Next Month Completions</div>
                            <div class="forecast-value">${data.forecasting.projectedCompletions.nextMonth}</div>
                        </div>
                    </div>
                    <div class="forecast-item">
                        <div class="forecast-icon">⏱️</div>
                        <div class="forecast-info">
                            <div class="forecast-title">Avg Completion Time</div>
                            <div class="forecast-value">${data.forecasting.projectedCompletions.avgCompletionTime}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                    <h5 style="margin-bottom: 0.5rem; color: #3b82f6;">💡 Capacity Analysis:</h5>
                    <div style="background: #eff6ff; padding: 0.75rem; border-radius: 6px; border-left: 3px solid #3b82f6;">
                        <div style="font-size: 0.9rem; line-height: 1.4;">
                            <strong>Utilization:</strong> ${data.forecasting.capacityAnalysis.utilizationRate}%<br>
                            <strong>Avg Tasks/User:</strong> ${data.forecasting.capacityAnalysis.averageTasksPerUser}<br>
                            <strong>Recommendation:</strong> ${data.forecasting.capacityAnalysis.recommendation}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Department Performance -->
        <div class="analytics-grid" style="margin-bottom: 2rem;">
            <div class="analytics-card department-performance" style="grid-column: span 2;">
                <h3><i class="fas fa-building"></i> Department Performance</h3>
                <div class="department-grid">
                    ${Object.entries(data.departmentAnalytics || {}).map(([dept, analytics]) => `
                        <div class="department-card">
                            <div class="department-header">
                                <h4>${dept}</h4>
                                <span class="user-count">${analytics.users} users</span>
                            </div>
                            <div class="department-metrics">
                                <div class="dept-metric">
                                    <span class="dept-label">Total Tasks</span>
                                    <span class="dept-value">${analytics.totalTasks}</span>
                                </div>
                                <div class="dept-metric">
                                    <span class="dept-label">Completion Rate</span>
                                    <span class="dept-value">${analytics.completionRate}%</span>
                                </div>
                                <div class="dept-metric">
                                    <span class="dept-label">Overdue</span>
                                    <span class="dept-value ${analytics.overdueTasks > 5 ? 'high-risk' : ''}">${analytics.overdueTasks}</span>
                                </div>
                                <div class="dept-metric">
                                    <span class="dept-label">Avg Time</span>
                                    <span class="dept-value">${analytics.averageCompletionTime}d</span>
                                </div>
                            </div>
                            <div class="department-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${analytics.completionRate}%; background: ${analytics.completionRate > 80 ? '#10b981' : analytics.completionRate > 60 ? '#f59e0b' : '#ef4444'};"></div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Trends and Distributions -->
        <div class="analytics-grid" style="margin-bottom: 2rem;">
            <div class="analytics-card trends-chart">
                <h3><i class="fas fa-chart-area"></i> Daily Trends</h3>
                <div class="trends-container">
                    ${renderTrendsChart(data.trends.daily)}
                </div>
            </div>

            <div class="analytics-card distribution-chart">
                <h3><i class="fas fa-chart-pie"></i> Task Distribution</h3>
                <div class="distribution-container">
                    <div class="distribution-section">
                        <h5>By Priority</h5>
                        ${renderDistributionChart(data.distributions.tasksByPriority, 'priority')}
                    </div>
                    <div class="distribution-section">
                        <h5>By Type</h5>
                        ${renderDistributionChart(data.distributions.tasksByType, 'type')}
                    </div>
                    <div class="distribution-section">
                        <h5>By Status</h5>
                        ${renderDistributionChart(data.distributions.tasksByStatus, 'status')}
                    </div>
                </div>
            </div>
        </div>

            `;

        // Insert into analytics section
        if (existingOverview) {
            existingOverview.appendChild(analyticsContainer);
        } else {
            const newOverview = document.createElement('div');
            newOverview.className = 'analytics-overview';
            newOverview.appendChild(analyticsContainer);
            analyticsSection.appendChild(newOverview);
        }

        // Add CSS for enhanced analytics
        addAdvancedAnalyticsCSS();
    }

    function renderTrendsChart(dailyData) {
        const dates = Object.keys(dailyData).slice(-7); // Last 7 days
        const maxValue = Math.max(...dates.map(date => Math.max(dailyData[date].created, dailyData[date].completed)));

        return `
        <div class="trends-chart">
            ${dates.map(date => {
            const data = dailyData[date];
            const createdHeight = (data.created / maxValue) * 100;
            const completedHeight = (data.completed / maxValue) * 100;

            return `
                    <div class="trend-day">
                        <div class="trend-bars">
                            <div class="trend-bar created" style="height: ${createdHeight}%" title="Created: ${data.created}"></div>
                            <div class="trend-bar completed" style="height: ${completedHeight}%" title="Completed: ${data.completed}"></div>
                        </div>
                        <div class="trend-label">${new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    </div>
                `;
        }).join('')}
        </div>
        <div class="trend-legend">
            <div class="legend-item">
                <div class="legend-color created"></div>
                <span>Created</span>
            </div>
            <div class="legend-item">
                <div class="legend-color completed"></div>
                <span>Completed</span>
            </div>
        </div>
    `;
    }

    function renderDistributionChart(data, type) {
        const total = Object.values(data).reduce((sum, val) => sum + val, 0);
        const colors = {
            priority: { low: '#10b981', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' },
            type: { 'job-auto': '#3b82f6', admin: '#8b5cf6', user: '#06b6d4', manual: '#84cc16', 'super-admin': '#f59e0b' },
            status: { pending: '#f59e0b', pending_approval: '#3b82f6', completed: '#10b981', rejected: '#ef4444' }
        };

        return `
        <div class="distribution-items">
            ${Object.entries(data).map(([key, value]) => {
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            const color = colors[type]?.[key] || '#64748b';

            return `
                    <div class="distribution-item">
                        <div class="item-info">
                            <div class="item-color" style="background-color: ${color};"></div>
                            <span class="item-label">${key}</span>
                        </div>
                        <div class="item-stats">
                            <span class="item-count">${value}</span>
                            <span class="item-percentage">${percentage}%</span>
                        </div>
                    </div>
                `;
        }).join('')}
        </div>
    `;
    }

    function addAdvancedAnalyticsCSS() {
        if (document.getElementById('advanced-analytics-css')) return;

        const style = document.createElement('style');
        style.id = 'advanced-analytics-css';
        style.textContent = `
        .comprehensive-analytics {
            max-width: 100%;
        }
        
        .analytics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 1.5rem;
        }
        
        .analytics-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
            border: 1px solid #e5e7eb;
        }
        
        .analytics-card h3 {
            margin: 0 0 1rem 0;
            color: #1e293b;
            font-size: 1.1rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .performance-metrics, .risk-metrics, .forecast-metrics {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid #f1f5f9;
        }
        
        .metric-row:last-child {
            border-bottom: none;
        }
        
        .metric-label {
            font-weight: 500;
            color: #64748b;
        }
        
        .metric-value {
            font-weight: 700;
            color: #1e293b;
        }
        
        .risk-item, .forecast-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            border-radius: 8px;
            background: #f8fafc;
        }
        
        .risk-item.high-risk {
            background: #fef2f2;
            border-left: 3px solid #ef4444;
        }
        
        .risk-item.medium-risk {
            background: #fefbf0;
            border-left: 3px solid #f59e0b;
        }
        
        .risk-item.low-risk {
            background: #f0fdf4;
            border-left: 3px solid #10b981;
        }
        
        .risk-icon, .forecast-icon {
            font-size: 1.5rem;
        }
        
        .risk-title, .forecast-title {
            font-weight: 600;
            color: #374151;
            font-size: 0.9rem;
        }
        
        .risk-value, .forecast-value {
            font-weight: 700;
            color: #1e293b;
            font-size: 1.1rem;
        }
        
        .department-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
        }
        
        .department-card {
            background: #f8fafc;
            border-radius: 8px;
            padding: 1rem;
            border: 1px solid #e2e8f0;
        }
        
        .department-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
        }
        
        .department-header h4 {
            margin: 0;
            color: #1e293b;
            font-size: 1rem;
        }
        
        .user-count {
            background: #e2e8f0;
            color: #475569;
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        
        .department-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
        }
        
        .dept-metric {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        
        .dept-label {
            font-size: 0.75rem;
            color: #64748b;
            font-weight: 500;
        }
        
        .dept-value {
            font-weight: 700;
            color: #1e293b;
        }
        
        .dept-value.high-risk {
            color: #ef4444;
        }
        
        .department-progress {
            margin-top: 0.75rem;
        }
        
        .progress-bar {
            width: 100%;
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        
        .trends-chart {
            display: flex;
            align-items: end;
            justify-content: space-between;
            height: 200px;
            padding: 1rem;
            background: #f8fafc;
            border-radius: 8px;
            margin-bottom: 1rem;
        }
        
        .trend-day {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            flex: 1;
        }
        
        .trend-bars {
            display: flex;
            align-items: end;
            gap: 2px;
            height: 150px;
        }
        
        .trend-bar {
            width: 12px;
            border-radius: 2px 2px 0 0;
            transition: height 0.3s ease;
        }
        
        .trend-bar.created {
            background: #3b82f6;
        }
        
        .trend-bar.completed {
            background: #10b981;
        }
        
        .trend-label {
            font-size: 0.75rem;
            color: #64748b;
            font-weight: 500;
        }
        
        .trend-legend {
            display: flex;
            justify-content: center;
            gap: 1rem;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.8rem;
            color: #64748b;
        }
        
        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
        
        .legend-color.created {
            background: #3b82f6;
        }
        
        .legend-color.completed {
            background: #10b981;
        }
        
        .distribution-section {
            margin-bottom: 1.5rem;
        }
        
        .distribution-section h5 {
            margin: 0 0 0.75rem 0;
            color: #374151;
            font-size: 0.9rem;
            font-weight: 600;
        }
        
        .distribution-items {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .distribution-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem;
            background: #f8fafc;
            border-radius: 6px;
        }
        
        .item-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .item-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
        
        .item-label {
            font-size: 0.85rem;
            color: #374151;
            font-weight: 500;
            text-transform: capitalize;
        }
        
        .item-stats {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .item-count {
            font-weight: 700;
            color: #1e293b;
        }
        
        .item-percentage {
            font-size: 0.8rem;
            color: #64748b;
        }
        
        .performers-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .performer-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        
        .performer-item.rank-1 {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border-color: #f59e0b;
        }
        
        .performer-item.rank-2 {
            background: linear-gradient(135deg, #e5e7eb, #d1d5db);
            border-color: #9ca3af;
        }
        
        .performer-item.rank-3 {
            background: linear-gradient(135deg, #fecaca, #fca5a5);
            border-color: #f87171;
        }
        
        .performer-rank {
            font-size: 1.5rem;
            font-weight: 700;
            min-width: 40px;
            text-align: center;
        }
        
        .performer-info {
            flex: 1;
        }
        
        .performer-name {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 0.25rem;
        }
        
        .performer-dept {
            font-size: 0.8rem;
            color: #64748b;
        }
        
        .performer-metrics {
            display: flex;
            gap: 1rem;
        }
        
        .performer-stat {
            text-align: center;
        }
        
        .stat-label {
            display: block;
            font-size: 0.7rem;
            color: #64748b;
            margin-bottom: 0.25rem;
        }
        
        .stat-value {
            font-weight: 700;
            color: #1e293b;
        }
        
        @media (max-width: 768px) {
            .analytics-grid {
                grid-template-columns: 1fr;
            }
            
            .department-grid {
                grid-template-columns: 1fr;
            }
            
            .performer-metrics {
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .trend-bars {
                gap: 1px;
            }
            
            .trend-bar {
                width: 8px;
            }
        }
    `;

        document.head.appendChild(style);
    }

    // User Analytics (simplified version for user dashboard)
    async function loadUserAnalytics() {
        try {
            const response = await fetch(`${API_URL}/analytics/comprehensive?period=30`, {
                headers: getAuthHeaders()
            });

            const data = await response.json();
            renderUserAnalytics(data);
        } catch (error) {
            console.error('Error loading user analytics:', error);
        }
    }

    function renderUserAnalytics(data) {
        const analyticsSection = document.getElementById('analytics');
        const existingOverview = analyticsSection.querySelector('.analytics-overview');

        if (existingOverview) {
            existingOverview.innerHTML = `
            <!-- Personal Performance Summary -->
            <div class="analytics-card" style="grid-column: span 2;">
                <h3><i class="fas fa-user-chart"></i> My Performance Summary</h3>
                <div class="user-performance-grid">
                    <div class="performance-metric">
                        <div class="metric-icon" style="background: #3b82f6;">📊</div>
                        <div class="metric-info">
                            <div class="metric-title">Total Tasks</div>
                            <div class="metric-number">${data.summary.totalTasks}</div>
                            <div class="metric-subtitle">${data.summary.period}</div>
                        </div>
                    </div>
                    <div class="performance-metric">
                        <div class="metric-icon" style="background: #10b981;">✅</div>
                        <div class="metric-info">
                            <div class="metric-title">Completion Rate</div>
                            <div class="metric-number">${data.performance.completionRate}%</div>
                            <div class="metric-subtitle">Above avg: ${parseFloat(data.performance.completionRate) > 75 ? '👍' : '👎'}</div>
                        </div>
                    </div>
                    <div class="performance-metric">
                        <div class="metric-icon" style="background: #f59e0b;">⏱️</div>
                        <div class="metric-info">
                            <div class="metric-title">Avg Completion</div>
                            <div class="metric-number">${data.performance.averageCompletionTime}</div>
                            <div class="metric-subtitle">days</div>
                        </div>
                    </div>
                    <div class="performance-metric">
                        <div class="metric-icon" style="background: #8b5cf6;">🎯</div>
                        <div class="metric-info">
                            <div class="metric-title">On-Time Rate</div>
                            <div class="metric-number">${data.performance.onTimeDeliveryRate}%</div>
                            <div class="metric-subtitle">Punctuality</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- My Task Breakdown -->
            <div class="analytics-card">
                <h3><i class="fas fa-chart-pie"></i> My Task Breakdown</h3>
                <div class="breakdown-container">
                    <div class="breakdown-section">
                        <h5>By Priority</h5>
                        ${renderDistributionChart(data.distributions.tasksByPriority, 'priority')}
                    </div>
                    <div class="breakdown-section">
                        <h5>By Type</h5>
                        ${renderDistributionChart(data.distributions.tasksByType, 'type')}
                    </div>
                </div>
            </div>

            <!-- Personal Trends -->
            <div class="analytics-card">
                <h3><i class="fas fa-chart-line"></i> My Activity Trends</h3>
                <div class="trends-container">
                    ${renderTrendsChart(data.trends.daily)}
                </div>
                ${data.performance.streak ? `
                    <div class="streak-info" style="margin-top: 1rem; padding: 1rem; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
                        <strong>🔥 Current Streak: ${data.performance.streak} days</strong>
                        <p style="margin: 0.5rem 0 0 0; color: #065f46; font-size: 0.9rem;">Keep up the great work!</p>
                    </div>
                ` : ''}
            </div>
        `;
        }

        // Add user-specific CSS
        addUserAnalyticsCSS();
    }

    function addUserAnalyticsCSS() {
        if (document.getElementById('user-analytics-css')) return;

        const style = document.createElement('style');
        style.id = 'user-analytics-css';
        style.textContent = `
        .user-performance-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .performance-metric {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        
        .metric-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: white;
        }
        
        .metric-info {
            flex: 1;
        }
        
        .metric-title {
            font-size: 0.8rem;
            color: #64748b;
            font-weight: 600;
            margin-bottom: 0.25rem;
        }
        
        .metric-number {
            font-size: 1.5rem;
            font-weight: 800;
            color: #1e293b;
            margin-bottom: 0.25rem;
        }
        
        .metric-subtitle {
            font-size: 0.75rem;
            color: #64748b;
        }
        
        .breakdown-container {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }
        
        .breakdown-section h5 {
            margin: 0 0 0.75rem 0;
            color: #374151;
            font-size: 0.9rem;
            font-weight: 600;
        }
        
        .streak-info {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
        }
        
        @media (max-width: 768px) {
            .user-performance-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .performance-metric {
                flex-direction: column;
                text-align: center;
                gap: 0.5rem;
            }
        }
    `;

        document.head.appendChild(style);
    }

    // Load analytics based on user role
    function loadAnalytics() {
        const user = getCurrentUser();
        if (user && (user.role === 'admin' || user.role === 'super-admin')) {
            loadAdvancedAnalytics();
        } else {
            loadUserAnalytics();
        }
    }

    // Enhanced section loading with analytics
    function loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                updateDashboardStats();
                loadUpcomingDueDates();
                break;
            case 'users':
                loadUsers();
                break;
            case 'jobs':
                loadJobs();
                break;
            case 'tasks':
                loadTasks();
                setTimeout(() => {
                    addTaskFilters();
                }, 100);
                break;
            case 'analytics':
                loadAnalytics(); // Use the new enhanced analytics
                break;
        }
    }

    // Export functionality for analytics
    async function exportAnalyticsReport() {
        try {
            const response = await fetch(`${API_URL}/analytics/comprehensive?period=30`, {
                headers: getAuthHeaders()
            });

            const data = await response.json();

            // Create detailed report
            const report = {
                generatedAt: new Date().toISOString(),
                period: data.summary.period,
                summary: data.summary,
                performance: data.performance,
                riskAnalysis: data.riskAnalysis,
                departmentAnalytics: data.departmentAnalytics,
                topPerformers: data.topPerformers,
                forecasting: data.forecasting
            };

            // Download as JSON
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showMessage('Analytics report exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting analytics:', error);
            showMessage('Error exporting analytics report', 'error');
        }
    }

    // Real-time analytics updates
    function startAnalyticsUpdates() {
        // Update analytics every 5 minutes
        setInterval(() => {
            const activeSection = document.querySelector('.section.active');
            if (activeSection && activeSection.id === 'analytics') {
                loadAnalytics();
            }
        }, 300000); // 5 minutes
    }


    // Performance monitoring and alerts
    function monitorPerformance(data) {
        const alerts = [];

        // Check completion rate
        if (parseFloat(data.performance.completionRate) < 60) {
            alerts.push({
                type: 'warning',
                title: 'Low Completion Rate',
                message: `Current completion rate is ${data.performance.completionRate}%. Consider reviewing task assignments.`
            });
        }

        // Check overdue tasks
        if (data.riskAnalysis.overdueTasks.length > 5) {
            alerts.push({
                type: 'error',
                title: 'High Overdue Tasks',
                message: `${data.riskAnalysis.overdueTasks.length} tasks are overdue. Immediate attention required.`
            });
        }

        // Check bottlenecks
        if (data.riskAnalysis.bottlenecks.length > 0) {
            const highSeverityBottlenecks = data.riskAnalysis.bottlenecks.filter(b => b.severity === 'high');
            if (highSeverityBottlenecks.length > 0) {
                alerts.push({
                    type: 'error',
                    title: 'Critical Bottlenecks',
                    message: `${highSeverityBottlenecks.length} critical bottlenecks detected. Review workload distribution.`
                });
            }
        }

        // Show alerts
        alerts.forEach(alert => {
            showMessage(alert.message, alert.type === 'error' ? 'error' : 'warning');
        });

        return alerts;
    }


    // Enhanced leaderboard rendering
    function renderLeaderboard(leaderboard) {
        const leaderboardContainer = document.createElement('div');
        leaderboardContainer.className = 'leaderboard-section';
        leaderboardContainer.innerHTML = `
        <div class="analytics-card leaderboard-card" style="grid-column: span 2;">
            <h3><i class="fas fa-crown"></i> Team Leaderboard</h3>
            <div class="leaderboard-controls">
                <div class="leaderboard-filters">
                    <select id="leaderboardPeriod" onchange="updateLeaderboard()">
                        <option value="30">Last 30 Days</option>
                        <option value="7">Last 7 Days</option>
                        <option value="90">Last 3 Months</option>
                    </select>
                    <select id="leaderboardMetric" onchange="updateLeaderboard()">
                        <option value="completion">Completion Rate</option>
                        <option value="ontime">On-Time Rate</option>
                        <option value="total">Total Tasks</option>
                    </select>
                </div>
            </div>
            <div class="leaderboard-list">
                ${leaderboard.slice(0, 15).map((user, index) => `
                    <div class="leaderboard-item ${index < 3 ? `top-${index + 1}` : ''}">
                        <div class="rank-badge">
                            ${index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                        </div>
                        <div class="user-avatar-small" style="background: linear-gradient(135deg, #${Math.floor(Math.random() * 16777215).toString(16)}, #${Math.floor(Math.random() * 16777215).toString(16)});">
                            ${user.user.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="user-details">
                            <div class="user-name">${user.user.username}</div>
                            <div class="user-department">${user.user.department}</div>
                        </div>
                        <div class="user-stats">
                            <div class="stat-item">
                                <span class="stat-label">Completion</span>
                                <span class="stat-value">${user.metrics.completionRate}%</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">On-Time</span>
                                <span class="stat-value">${user.metrics.onTimeRate}%</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Total</span>
                                <span class="stat-value">${user.metrics.totalTasks}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Streak</span>
                                <span class="stat-value">${user.metrics.currentStreak || 0}</span>
                            </div>
                        </div>
                        <div class="performance-indicator">
                            <div class="performance-ring" style="--percentage: ${user.metrics.completionRate}%;">
                                <span>${user.metrics.completionRate}%</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

        // Insert leaderboard into analytics section
        const analyticsOverview = document.querySelector('#analytics .analytics-overview');
        if (analyticsOverview) {
            analyticsOverview.appendChild(leaderboardContainer);
        }

        // Add leaderboard-specific CSS
        addLeaderboardCSS();
    }

    function addLeaderboardCSS() {
        if (document.getElementById('leaderboard-css')) return;

        const style = document.createElement('style');
        style.id = 'leaderboard-css';
        style.textContent = `
        .leaderboard-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }
        
        .leaderboard-filters {
            display: flex;
            gap: 1rem;
        }
        
        .leaderboard-filters select {
            padding: 0.5rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            font-size: 0.9rem;
        }
        
        .leaderboard-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .leaderboard-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
        }
        
        .leaderboard-item:hover {
            background: #f1f5f9;
            transform: translateX(4px);
        }
        
        .leaderboard-item.top-1 {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border-color: #f59e0b;
        }
        
        .leaderboard-item.top-2 {
            background: linear-gradient(135deg, #e5e7eb, #d1d5db);
            border-color: #9ca3af;
        }
        
        .leaderboard-item.top-3 {
            background: linear-gradient(135deg, #fed7d7, #fbb6ce);
            border-color: #f87171;
        }
        
        .rank-badge {
            font-size: 1.25rem;
            font-weight: 700;
            min-width: 40px;
            text-align: center;
        }
        
        .user-avatar-small {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 1rem;
        }
        
        .user-details {
            flex: 1;
        }
        
        .user-name {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 0.25rem;
        }
        
        .user-department {
            font-size: 0.8rem;
            color: #64748b;
        }
        
        .user-stats {
            display: flex;
            gap: 1rem;
        }
        
        .stat-item {
            text-align: center;
        }
        
        .stat-label {
            display: block;
            font-size: 0.7rem;
            color: #64748b;
            margin-bottom: 0.25rem;
        }
        
        .stat-value {
            font-weight: 700;
            color: #1e293b;
            font-size: 0.9rem;
        }
        
        .performance-indicator {
            display: flex;
            align-items: center;
        }
        
        .performance-ring {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: conic-gradient(#10b981 0% var(--percentage), #e5e7eb var(--percentage) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        
        .performance-ring::before {
            content: '';
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: white;
            position: absolute;
        }
        
        .performance-ring span {
            position: relative;
            z-index: 1;
            font-size: 0.7rem;
            font-weight: 600;
            color: #1e293b;
        }
        
        @media (max-width: 768px) {
            .leaderboard-item {
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            
            .user-stats {
                order: 3;
                width: 100%;
                justify-content: space-around;
            }
            
            .performance-indicator {
                order: 2;
            }
        }
    `;

        document.head.appendChild(style);
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

    window.approveTask = async function (taskId) {
        const approveButton = document.querySelector(`button[onclick="approveTask('${taskId}')"]`);
        const originalText = approveButton ? approveButton.textContent : 'Approve';

        if (approveButton) {
            approveButton.disabled = true;
            approveButton.textContent = 'Approving...';
            approveButton.classList.add('loading');
        }

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task approved successfully!', 'success');
                loadTasks();
                loadUpcomingDueDates();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            console.error('Error approving task:', error);
            showMessage('Error approving task. Please try again.', 'error');
        } finally {
            if (approveButton) {
                approveButton.disabled = false;
                approveButton.textContent = originalText;
                approveButton.classList.remove('loading');
            }
        }
    };

    window.rejectTask = async function (taskId) {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        const rejectButton = document.querySelector(`button[onclick="rejectTask('${taskId}')"]`);
        const originalText = rejectButton ? rejectButton.textContent : 'Reject';

        if (rejectButton) {
            rejectButton.disabled = true;
            rejectButton.textContent = 'Rejecting...';
            rejectButton.classList.add('loading');
        }

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/reject`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ reason })
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task rejected successfully!', 'success');
                loadTasks();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            console.error('Error rejecting task:', error);
            showMessage('Error rejecting task. Please try again.', 'error');
        } finally {
            if (rejectButton) {
                rejectButton.disabled = false;
                rejectButton.textContent = originalText;
                rejectButton.classList.remove('loading');
            }
        }
    };
    // Update leaderboard based on filters
    window.updateLeaderboard = async function () {
        const period = document.getElementById('leaderboardPeriod')?.value || '30';
        const metric = document.getElementById('leaderboardMetric')?.value || 'completion';

        try {
            const response = await fetch(`${API_URL}/analytics/leaderboard?period=${period}&metric=${metric}`, {
                headers: getAuthHeaders()
            });

            const leaderboard = await response.json();

            // Re-render leaderboard
            const existingLeaderboard = document.querySelector('.leaderboard-section');
            if (existingLeaderboard) {
                existingLeaderboard.remove();
            }

            renderLeaderboard(leaderboard);
        } catch (error) {
            console.error('Error updating leaderboard:', error);
        }
    };

    window.approveTaskFromModal = async function (taskId) {
        if (!confirm('Are you sure you want to approve this task?')) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task approved successfully', 'success');
                document.querySelector('.modal').remove();
                loadTasks();
                loadUpcomingDueDates();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            showMessage('Error approving task', 'error');
        }
    };

    window.rejectTaskFromModal = async function (taskId) {
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
                document.querySelector('.modal').remove();
                loadTasks();
                loadUpcomingDueDates();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
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
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }

        // Find the delete button and show loading
        const deleteButton = document.querySelector(`button[onclick="deleteTask('${taskId}')"]`);
        if (deleteButton) {
            const originalText = deleteButton.textContent;
            deleteButton.disabled = true;
            deleteButton.textContent = 'Deleting...';
            deleteButton.classList.add('loading');

            try {
                const response = await fetch(`${API_URL}/tasks/${taskId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });

                const result = await response.json();

                if (result.success) {
                    showMessage('Task deleted successfully!', 'success');
                    loadTasks();
                } else {
                    showMessage(result.error || 'Failed to delete task', 'error');
                }
            } catch (error) {
                console.error('Error deleting task:', error);
                showMessage('Error deleting task. Please try again.', 'error');
            } finally {
                // Reset button state
                deleteButton.disabled = false;
                deleteButton.textContent = originalText;
                deleteButton.classList.remove('loading');
            }
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

        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        submitButton.disabled = true;
        submitButton.textContent = 'Creating Task...';
        submitButton.classList.add('loading');

        try {


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
            const response = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(taskData)
            });

            const result = await response.json();

            if (response.ok) {
                showMessage('Task created successfully', 'success');
                closeModal('addTaskModal');
                e.target.reset();
                loadTasks();
            } else {
                if (result.type === 'DUPLICATE_TASK') {
                    showMessage(`Duplicate prevented: ${result.error}`, 'warning');
                } else {
                    showMessage(result.error || 'Failed to create task', 'error');
                }
            }
        } catch (error) {
            console.error('Error creating task:', error);
            showMessage('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = originalText;
            submitButton.classList.remove('loading');
        }
    }
}); 