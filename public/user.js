document.addEventListener('DOMContentLoaded', function () {
    let currentUser = null;
    let tasks = [];
    let searchResults = [];
    const API_URL = 'https://atpl-daily-task-management.onrender.com/api';
    // const API_URL = 'http://localhost:3000/api';
    let users = [];
    const groupedTaskStyles = `
<style>
.job-group-card .complete-all-btn:hover {
    background: #059669 !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.job-group-card .expand-btn:hover {
    background: #2563eb !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.task-item {
    transform: translateX(0);
    transition: all 0.3s ease;
}

.task-item:hover {
    transform: translateX(4px);
}

@media (max-width: 768px) {
    .job-group-card {
        padding: 12px !important;
        margin-bottom: 12px !important;
    }
    
    .job-group-card h3 {
        font-size: 1rem !important;
    }
    
    .complete-all-btn, .expand-btn {
        padding: 6px 10px !important;
        font-size: 0.8rem !important;
    }
    
    .task-item {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 8px;
    }
    
    .task-item > div:last-child {
        align-self: flex-end;
    }
}
</style>
`;

    // Inject the styles
    document.head.insertAdjacentHTML('beforeend', groupedTaskStyles);


    // Check authentication
    checkAuth();
    updateTasksGridStyles();

    // Navigation
    const navTabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.section');

    // Navigation handler
    navTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetSection = this.dataset.section;

            // Update active states
            navTabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            this.classList.add('active');
            const targetSectionElement = document.getElementById(targetSection);
            if (targetSectionElement) {
                targetSectionElement.classList.add('active');
            }

            // Load section data using existing function
            loadSectionData(targetSection);
        });
    });

    const timeRangeSelector = document.getElementById('analyticsTimeRange');
    if (timeRangeSelector) {
        timeRangeSelector.addEventListener('change', function () {
            loadEnhancedAnalytics();
        });
    }

    // Refresh due dates button
    const refreshBtn = document.getElementById('refreshDueDates');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            loadEnhancedDueDates();
            showMessage('Due dates refreshed successfully', 'success');
        });
    }

    // Event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('searchBtn').addEventListener('click', performUniversalSearch);
    document.getElementById('universalSearch').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performUniversalSearch();
        }
    });
    document.getElementById('assignPeerTaskBtn').addEventListener('click', () => openModal('assignPeerTaskModal'));


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
                currentUser = result.user;
                // Update user info display
                const userInfoElement = document.getElementById('userInfo');
                if (userInfoElement) {
                    userInfoElement.textContent = `${result.user.username} (${result.user.role})`;
                }
                await loadDashboard();
                await loadUsers();
            }
        } catch (error) {
            console.error('Auth check error:', error);
            localStorage.removeItem('atpl_auth_token');
            localStorage.removeItem('atpl_user_info');
            window.location.href = '/';
        }
    }

    function updateDashboardStats() {
        // This will be called by the main user.js file
        // Just ensure the elements exist for the existing code to work with
        const statsElements = [
            'totalTasks', 'pendingTasks', 'completedTasks', 'overdue',
            'dueToday', 'dueTomorrow', 'dueThisWeek', 'dueThisMonth'
        ];

        statsElements.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.textContent === '0') {
                element.textContent = 'Loading...';
            }
        });
    }

    // Call initially
    updateDashboardStats();

    function updateUserDisplay() {
        const userInfo = localStorage.getItem('atpl_user_info');
        if (userInfo) {
            const user = JSON.parse(userInfo);
            const userNameElement = document.getElementById('userName');
            const userRoleElement = document.getElementById('userRole');
            const userAvatarElement = document.getElementById('userAvatar');

            if (userNameElement) userNameElement.textContent = user.username || 'User';
            if (userRoleElement) userRoleElement.textContent = user.department || 'Department';
            if (userAvatarElement) userAvatarElement.textContent = (user.username || 'U').charAt(0).toUpperCase();
        }
    }

    // Call on load
    updateUserDisplay();

    async function loadUsers() {
        try {
            console.log('Loading colleagues...');


            const response = await fetch(`${API_URL}/users/colleagues`, {
                headers: getAuthHeaders()
            });


            if (response.ok) {
                users = await response.json();

                if (users.length === 0) {
                    console.warn('No colleagues found! This might be because:');
                    console.warn('1. No other users exist in your department');
                    console.warn('2. All other users are inactive');
                    console.warn('3. You are the only user in the system');
                    console.warn('4. Department names do not match exactly');
                }

                populatePeerDropdown();
            } else {
                const errorText = await response.text();
                console.error('Failed to load colleagues:', response.status, errorText);
                showMessage('Failed to load colleagues: ' + response.status, 'error');
            }
        } catch (error) {
            console.error('Error loading colleagues:', error);
            showMessage('Error loading colleagues: ' + error.message, 'error');
        }
    }

    // UPDATED populatePeerDropdown with more debugging
    function populatePeerDropdown() {
        const dropdown = document.getElementById('peerTaskAssignTo');
        if (!dropdown) {
            console.error('Peer dropdown not found!');
            return;
        }


        // Clear existing options
        dropdown.innerHTML = '';

        // Add placeholder option
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Select colleagues...';
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        dropdown.appendChild(placeholderOption);

        if (users.length === 0) {
            const noUsersOption = document.createElement('option');
            noUsersOption.value = '';
            noUsersOption.textContent = 'No colleagues available';
            noUsersOption.disabled = true;
            dropdown.appendChild(noUsersOption);

            console.warn('No colleagues to populate in dropdown');

            // Show helpful message to user
            showMessage('No colleagues found. This may be because you are the only user in your department, or no other users exist.', 'info');
            return;
        }

        // Add user options
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user._id;
            option.textContent = `${user.username} (${user.department})`;
            dropdown.appendChild(option);

        });
    }





    async function loadDashboard() {
        try {
            await Promise.all([
                loadTasks(),
                loadDashboardStats()
            ]);
        } catch (error) {
            showMessage('Error loading dashboard', 'error');
        }
    }

    // MODIFY THIS FUNCTION:
    async function loadTasks() {
        try {
            const response = await fetch(`${API_URL}/tasks`, {
                headers: getAuthHeaders()
            });
            tasks = await response.json();

            // ADD THIS LINE:
            calculateAndUpdateStats();

            calculateAndUpdateStats();
            renderAllTasks();
            renderDueDatesSection(); // Add this line

            const activeTab = document.querySelector('.nav-tab.active');
            if (activeTab && activeTab.dataset.section === 'job-entry') {
                renderTasksByType('job-entry', 'jobEntryTasksContainer');
            }
        } catch (error) {
            showMessage('Error loading tasks', 'error');
        }
    }

    // CHANGE THIS FUNCTION:
    async function loadDashboardStats() {
        try {
            const response = await fetch(`${API_URL}/dashboard/user`, {
                headers: getAuthHeaders()
            });
            const stats = await response.json();

            // ADD THESE LINES TO UPDATE THE MAIN DASHBOARD:
            document.getElementById('totalTasks').textContent = stats.totalTasks || 0;
            document.getElementById('pendingTasks').textContent = stats.pendingTasks || 0;
            document.getElementById('completedTasks').textContent = stats.completedTasks || 0;
            document.getElementById('overdueTasks').textContent = stats.overdueTasks || 0;

            updateDueDatesSection(stats);
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            showMessage('Error loading dashboard stats', 'error');
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
    // ADD THIS NEW FUNCTION:
    function calculateAndUpdateStats() {
        if (!tasks || tasks.length === 0) return;

        const totalTasks = tasks.length;
        const pendingTasks = tasks.filter(t => t.status === 'pending').length;
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const overdueTasks = tasks.filter(t => {
            const dueDate = new Date(t.dueDate);
            const today = new Date();
            return t.status === 'pending' && dueDate < today;
        }).length;

        // Update the dashboard display
        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('pendingTasks').textContent = pendingTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('overdueTasks').textContent = overdueTasks;
    }

    function renderAllTasks() {
        const container = document.getElementById('allTasksContainer');
        container.innerHTML = '';

        // Filter out tasks assigned BY current user - only show tasks assigned TO current user
        const tasksAssignedToMe = tasks.filter(task => {
            // Check if current user is in assignedTo array (for multiple assignees)
            if (Array.isArray(task.assignedTo)) {
                return task.assignedTo.some(assignee => assignee._id === currentUser.id);
            }
            // Check if current user is the single assignee
            return task.assignedTo._id === currentUser.id || task.assignedTo === currentUser.id;
        });

        if (tasksAssignedToMe.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No tasks assigned to you</p>';
            return;
        }

        // Create compact grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'tasks-grid';

        tasksAssignedToMe.forEach(task => {
            gridContainer.appendChild(createTaskCard(task));
        });

        container.appendChild(gridContainer);
    }

    function renderTasksByType(type, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        console.log('Rendering tasks by type:', type, 'Total tasks:', tasks.length);

        const filteredTasks = tasks.filter(task => {
            // First, ensure task is assigned TO current user, not BY current user
            const isAssignedToMe = Array.isArray(task.assignedTo)
                ? task.assignedTo.some(assignee => (assignee._id || assignee) === currentUser.id)
                : (task.assignedTo._id || task.assignedTo) === currentUser.id;

            if (!isAssignedToMe) {
                return false;
            }

            // Then filter by type for tasks assigned TO current user
            if (type === 'job-entry') {
                return task.type === 'job-auto';
            }
            if (type === 'super-admin') return task.type === 'super-admin';
            if (type === 'admin') return task.type === 'admin';
            if (type === 'user-assigned') return task.type === 'user' || task.type === 'manual';
            return false;
        });

        console.log('Filtered tasks for', type, ':', filteredTasks.length);

        if (filteredTasks.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: #64748b; padding: 40px;">No ${type.replace('-', ' ')} tasks assigned to you</p>`;
            return;
        }

        // IMPORTANT: Use the NEW enhanced grouping for job-entry tasks
        if (type === 'job-entry') {
            const groupedTasks = groupTasksByJob(filteredTasks);
            renderGroupedTasks(container, groupedTasks);
        } else {

            filteredTasks.forEach(task => {
                container.appendChild(createTaskCard(task));
            });
        }
    }


    function renderJobEntryTasks(container, jobTasks) {
        console.log('Rendering job entry tasks:', jobTasks.length);

        // Group tasks by stage + docNo combination for tasks with same title/stage
        const groupedTasks = {};

        jobTasks.forEach(task => {
            if (task.jobDetails) {
                // Create a more specific grouping key that includes the task title (stage)
                const groupKey = `${task.title}-${task.jobDetails.docNo}`;

                if (!groupedTasks[groupKey]) {
                    groupedTasks[groupKey] = {
                        title: task.title, // The task title (e.g., "Please provide long lead item details")
                        stage: task.jobDetails.currentStage || 'Unknown Stage',
                        docNo: task.jobDetails.docNo || 'Unknown Doc',
                        customerName: task.jobDetails.customerName || 'Unknown Customer',
                        dueDate: task.dueDate,
                        priority: task.priority,
                        status: task.status,
                        tasks: []
                    };
                }
                groupedTasks[groupKey].tasks.push(task);
            }
        });

        console.log('Grouped job tasks:', Object.keys(groupedTasks).length, 'groups');

        if (Object.keys(groupedTasks).length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No job entry tasks found</p>';
            return;
        }

        // Sort groups by priority and due date
        const sortedGroups = Object.values(groupedTasks).sort((a, b) => {
            // First sort by status (pending first)
            if (a.status !== b.status) {
                const statusOrder = { 'pending': 0, 'pending_approval': 1, 'completed': 2 };
                return statusOrder[a.status] - statusOrder[b.status];
            }
            // Then by priority
            const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
            if (a.priority !== b.priority) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            // Finally by due date
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        // Create grouped display
        sortedGroups.forEach(group => {
            const isOverdue = new Date() > new Date(group.dueDate) && group.status === 'pending';
            const canComplete = group.status === 'pending';

            const groupCard = document.createElement('div');
            groupCard.className = 'job-group-card';
            groupCard.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 18px;
            margin-bottom: 16px;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
            border: 1px solid #e5e7eb;
            border-left: 4px solid ${getPriorityColor(group.priority)};
            transition: all 0.3s ease;
            position: relative;
        `;

            // Add hover effect
            groupCard.addEventListener('mouseenter', () => {
                groupCard.style.transform = 'translateY(-2px)';
                groupCard.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.12)';
            });

            groupCard.addEventListener('mouseleave', () => {
                groupCard.style.transform = 'translateY(0)';
                groupCard.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.08)';
            });

            groupCard.innerHTML = `
            <!-- Group Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                <div style="flex: 1;">
                    <h3 style="color: #1e293b; margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 700; line-height: 1.3;">
                        ${group.title}
                    </h3>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                        <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; color: #475569;">
                            📋 Doc: ${group.docNo}
                        </span>
                        <span style="font-size: 0.85rem; color: #64748b;">
                            Stage: <strong>${group.stage}</strong>
                        </span>
                        <span style="
                            padding: 3px 8px; 
                            border-radius: 10px; 
                            font-size: 0.75rem; 
                            font-weight: 600; 
                            background: ${group.priority === 'urgent' ? '#fee2e2' : group.priority === 'high' ? '#fed7d7' : group.priority === 'medium' ? '#fef3c7' : '#dcfce7'};
                            color: ${group.priority === 'urgent' ? '#991b1b' : group.priority === 'high' ? '#c53030' : group.priority === 'medium' ? '#92400e' : '#166534'};
                        ">
                            ${group.priority.toUpperCase()}
                        </span>
                    </div>
                    <div style="font-size: 0.8rem; color: #64748b;">
                        📅 Due: ${new Date(group.dueDate).toLocaleDateString()}
                        ${isOverdue ? '<span style="color: #ef4444; font-weight: 600; margin-left: 8px;">⚠️ OVERDUE</span>' : ''}
                        | Items: ${group.tasks.length}
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px; flex-shrink: 0;">
                    ${canComplete ? `
                        <button class="complete-all-btn" onclick="completeAllInGroup('${group.docNo}', '${group.title}')" 
                                style="
                                    background: #10b981; 
                                    color: white; 
                                    border: none; 
                                    padding: 8px 16px; 
                                    border-radius: 8px; 
                                    cursor: pointer; 
                                    font-size: 0.85rem; 
                                    font-weight: 600;
                                    transition: all 0.2s ease;
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                ">
                            ✓ Complete All
                        </button>
                    ` : `
                        <span style="
                            padding: 8px 16px; 
                            background: ${group.status === 'completed' ? '#dcfce7' : '#dbeafe'}; 
                            color: ${group.status === 'completed' ? '#166534' : '#1e40af'}; 
                            border-radius: 8px; 
                            font-size: 0.85rem; 
                            font-weight: 600;
                        ">
                            ${group.status.replace('_', ' ').toUpperCase()}
                        </span>
                    `}
                    
                    <button class="expand-btn" style="
                        background: #3b82f6; 
                        color: white; 
                        border: none; 
                        padding: 8px 12px; 
                        border-radius: 8px; 
                        cursor: pointer; 
                        font-size: 0.85rem;
                        font-weight: 600;
                        transition: all 0.2s ease;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    ">
                        👁️ View Items
                    </button>
                </div>
            </div>
            
            <!-- Expandable Task Details -->
            <div class="group-tasks" style="display: none; border-top: 2px solid #f1f5f9; padding-top: 16px;">
                <div style="display: grid; gap: 10px;">
                    ${group.tasks.map((task, index) => `
                        <div class="task-item" style="
                            display: flex; 
                            justify-content: space-between; 
                            align-items: center; 
                            padding: 12px; 
                            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); 
                            border-radius: 8px; 
                            border-left: 3px solid ${getPriorityColor(task.priority)};
                            transition: all 0.2s ease;
                        " onmouseover="this.style.background='linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)'"
                           onmouseout="this.style.background='linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                    <strong style="color: #1e293b; font-size: 0.9rem;">
                                        ${task.jobDetails.itemCode}
                                    </strong>
                                    <span style="color: #64748b; font-size: 0.8rem;">•</span>
                                    <span style="color: #475569; font-size: 0.85rem; font-weight: 500;">
                                        ${task.jobDetails.customerName}
                                    </span>
                                </div>
                                <div style="color: #64748b; font-size: 0.8rem; line-height: 1.4; margin-bottom: 4px;">
                                    ${task.jobDetails.description}
                                </div>
                                <div style="font-size: 0.75rem; color: #64748b;">
                                    Qty: <strong>${task.jobDetails.qty}</strong>
                                </div>
                            </div>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                ${task.status === 'pending' ? `
                                    <button class="btn-small btn-success" onclick="completeTask('${task._id}')" 
                                            style="padding: 6px 12px; font-size: 0.75rem; border-radius: 6px;">
                                        ✓ Complete
                                    </button>
                                ` : `
                                    <span style="
                                        padding: 4px 10px; 
                                        background: ${task.status === 'completed' ? '#dcfce7' : '#dbeafe'}; 
                                        color: ${task.status === 'completed' ? '#166534' : '#1e40af'}; 
                                        border-radius: 6px; 
                                        font-size: 0.7rem; 
                                        font-weight: 600;
                                    ">
                                        ${task.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                `}
                                <button class="btn-small btn-primary" onclick="viewTaskDetails('${task._id}')" 
                                        style="padding: 6px 10px; font-size: 0.75rem; border-radius: 6px;">
                                    👁️
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

            // Add click handlers
            const expandBtn = groupCard.querySelector('.expand-btn');
            const tasksDiv = groupCard.querySelector('.group-tasks');

            expandBtn.addEventListener('click', function () {
                const isHidden = tasksDiv.style.display === 'none';
                tasksDiv.style.display = isHidden ? 'block' : 'none';
                expandBtn.innerHTML = isHidden ? '👁️ Hide Items' : '👁️ View Items';
                expandBtn.style.background = isHidden ? '#6b7280' : '#3b82f6';
            });

            container.appendChild(groupCard);
        });
    }


    function groupTasksByJob(tasks) {
        const groups = {};
        tasks.forEach(task => {
            if (task.jobDetails && task.jobDetails.docNo) {
                // Group by TITLE (stage) + DOC NUMBER only
                const key = `${task.title}-${task.jobDetails.docNo}`;
                if (!groups[key]) {
                    groups[key] = {
                        title: task.title, // The task title (stage description)
                        docNo: task.jobDetails.docNo,
                        customerName: task.jobDetails.customerName,
                        currentStage: task.jobDetails.currentStage,
                        priority: task.priority,
                        dueDate: task.dueDate,
                        status: task.status,
                        tasks: []
                    };
                }
                groups[key].tasks.push(task);
            }
        });
        return groups;
    }

    function loadEnhancedAnalytics() {
        if (!tasks || tasks.length === 0) {
            renderEmptyAnalytics();
            return;
        }

        const analytics = calculateAnalytics();
        renderAnalytics(analytics);
        renderTaskDistribution(analytics.distribution);
        renderPriorityBreakdown(analytics.priorities);
        renderWeeklyActivity(analytics.weeklyActivity);
        renderGoalsAndAchievements(analytics.goals);
    }

    function calculateAnalytics() {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Filter tasks from last 30 days
        const recentTasks = tasks.filter(task => new Date(task.createdAt) >= thirtyDaysAgo);

        const completed = recentTasks.filter(t => t.status === 'completed');
        const pending = recentTasks.filter(t => t.status === 'pending');
        const overdue = recentTasks.filter(t => {
            const dueDate = new Date(t.dueDate);
            return t.status === 'pending' && dueDate < now;
        });

        // Calculate completion rate
        const completionRate = recentTasks.length > 0 ?
            Math.round((completed.length / recentTasks.length) * 100) : 0;

        // Calculate on-time delivery rate
        const onTimeCompleted = completed.filter(t => {
            const completedDate = new Date(t.updatedAt);
            const dueDate = new Date(t.dueDate);
            return completedDate <= dueDate;
        });
        const onTimeRate = completed.length > 0 ?
            Math.round((onTimeCompleted.length / completed.length) * 100) : 0;

        // Calculate average response time (in hours)
        const avgResponseTime = completed.length > 0 ?
            Math.round(completed.reduce((acc, task) => {
                const created = new Date(task.createdAt);
                const completed = new Date(task.updatedAt);
                return acc + (completed - created) / (1000 * 60 * 60);
            }, 0) / completed.length) : 0;

        // Priority breakdown
        const priorities = {
            low: recentTasks.filter(t => t.priority === 'low').length,
            medium: recentTasks.filter(t => t.priority === 'medium').length,
            high: recentTasks.filter(t => t.priority === 'high').length,
            urgent: recentTasks.filter(t => t.priority === 'urgent').length
        };

        // Weekly activity
        const weeklyActivity = calculateWeeklyActivity(recentTasks);

        return {
            completionRate,
            onTimeRate,
            avgResponseTime,
            qualityScore: Math.min(100, Math.round((completionRate + onTimeRate) / 2)),
            distribution: {
                completed: completed.length,
                pending: pending.length,
                overdue: overdue.length,
                total: recentTasks.length
            },
            priorities,
            weeklyActivity,
            goals: {
                monthlyTarget: 20,
                currentProgress: completed.length,
                streak: calculateStreak(),
                qualityLevel: getQualityLevel(completionRate, onTimeRate)
            }
        };
    }

    function renderAnalytics(analytics) {
        // Update performance metrics
        document.getElementById('completionRate').textContent = `${analytics.completionRate}%`;
        document.getElementById('onTimeRate').textContent = `${analytics.onTimeRate}%`;
        document.getElementById('avgResponseTime').textContent = `${analytics.avgResponseTime}h`;
        document.getElementById('qualityScore').textContent = `${analytics.qualityScore}/100`;

        // Update performance badge
        const badge = document.getElementById('performanceBadge');
        if (analytics.qualityScore >= 90) {
            badge.innerHTML = `
            <div class="badge-icon">🌟</div>
            <div class="badge-text">Excellent Performer</div>
        `;
            badge.style.background = 'linear-gradient(135deg, #d1fae5 0%, #10b981 100%)';
        } else if (analytics.qualityScore >= 75) {
            badge.innerHTML = `
            <div class="badge-icon">⭐</div>
            <div class="badge-text">Good Performer</div>
        `;
            badge.style.background = 'linear-gradient(135deg, #fef3c7 0%, #f59e0b 100%)';
        } else {
            badge.innerHTML = `
            <div class="badge-icon">📈</div>
            <div class="badge-text">Improving</div>
        `;
            badge.style.background = 'linear-gradient(135deg, #fee2e2 0%, #ef4444 100%)';
        }
    }

    function renderTaskDistribution(distribution) {
        const total = distribution.total;
        if (total === 0) return;

        const completedPercent = (distribution.completed / total) * 100;
        const pendingPercent = (distribution.pending / total) * 100;
        const overduePercent = (distribution.overdue / total) * 100;

        // Update donut chart
        const circumference = 2 * Math.PI * 80; // radius = 80
        let currentOffset = 0;

        // Completed
        const completedLength = (completedPercent / 100) * circumference;
        document.getElementById('completedCircle').setAttribute('stroke-dasharray', `${completedLength} ${circumference}`);
        document.getElementById('completedCircle').setAttribute('stroke-dashoffset', currentOffset);
        currentOffset -= completedLength;

        // Pending
        const pendingLength = (pendingPercent / 100) * circumference;
        document.getElementById('pendingCircle').setAttribute('stroke-dasharray', `${pendingLength} ${circumference}`);
        document.getElementById('pendingCircle').setAttribute('stroke-dashoffset', currentOffset);
        currentOffset -= pendingLength;

        // Overdue
        const overdueLength = (overduePercent / 100) * circumference;
        document.getElementById('overdueCircle').setAttribute('stroke-dasharray', `${overdueLength} ${circumference}`);
        document.getElementById('overdueCircle').setAttribute('stroke-dashoffset', currentOffset);

        // Update counts and center
        document.getElementById('totalTasksChart').textContent = total;
        document.getElementById('completedCount').textContent = distribution.completed;
        document.getElementById('pendingCount').textContent = distribution.pending;
        document.getElementById('overdueCount').textContent = distribution.overdue;
    }

    function renderPriorityBreakdown(priorities) {
        const total = Object.values(priorities).reduce((sum, count) => sum + count, 0);
        if (total === 0) return;

        Object.entries(priorities).forEach(([priority, count]) => {
            const percentage = (count / total) * 100;
            document.getElementById(`${priority}PriorityCount`).textContent = count;
            document.getElementById(`${priority}PriorityBar`).style.width = `${percentage}%`;
        });
    }

    function calculateWeeklyActivity(tasks) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activity = {};

        days.forEach(day => activity[day] = 0);

        tasks.forEach(task => {
            const dayName = days[new Date(task.createdAt).getDay()];
            activity[dayName]++;
        });

        return activity;
    }

    function renderWeeklyActivity(weeklyActivity) {
        const maxActivity = Math.max(...Object.values(weeklyActivity), 1);
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        days.forEach(day => {
            const count = weeklyActivity[day] || 0;
            const height = (count / maxActivity) * 80; // max height 80px

            const dayElement = document.getElementById(`${day.toLowerCase()}Activity`);
            const countElement = document.getElementById(`${day.toLowerCase()}Count`);

            if (dayElement) dayElement.style.height = `${Math.max(height, 4)}px`;
            if (countElement) countElement.textContent = count;
        });
    }

    function calculateStreak() {
        if (tasks.length === 0) return 0;

        const completedTasks = tasks
            .filter(t => t.status === 'completed')
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        if (completedTasks.length === 0) return 0;

        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (let i = 0; i < completedTasks.length; i++) {
            const taskDate = new Date(completedTasks[i].updatedAt);
            taskDate.setHours(0, 0, 0, 0);

            const diffDays = (currentDate - taskDate) / (1000 * 60 * 60 * 24);

            if (diffDays === streak) {
                streak++;
            } else if (diffDays > streak) {
                break;
            }
        }

        return streak;
    }

    function getQualityLevel(completionRate, onTimeRate) {
        const avgScore = (completionRate + onTimeRate) / 2;
        if (avgScore >= 90) return 'Excellent';
        if (avgScore >= 75) return 'Good';
        if (avgScore >= 60) return 'Average';
        return 'Needs Improvement';
    }

    function renderGoalsAndAchievements(goals) {
        // Monthly progress
        const progressPercent = Math.min((goals.currentProgress / goals.monthlyTarget) * 100, 100);
        document.getElementById('monthlyProgress').style.width = `${progressPercent}%`;
        document.getElementById('monthlyProgressText').textContent = `${goals.currentProgress}/${goals.monthlyTarget}`;

        // Streak
        document.getElementById('streakDays').textContent = `${goals.streak} days`;

        // Quality level
        document.getElementById('qualityLevel').textContent = goals.qualityLevel;
    }

    // Enhanced Due Dates Functions
    function loadEnhancedDueDates() {
        if (!tasks || tasks.length === 0) {
            renderEmptyDueDates();
            return;
        }

        const dueDatesData = calculateDueDatesData();
        renderDueDatesData(dueDatesData);
        renderDueDatesSummary(dueDatesData);
    }

    function viewTaskDetails(taskId) {
        const task = tasks.find(t => t._id === taskId);
        if (task && typeof openTaskModal === 'function') {
            openTaskModal(task);
        }
    }

    function markTaskComplete(taskId) {
        if (typeof updateTaskStatus === 'function') {
            updateTaskStatus(taskId, 'completed');
        }
    }

    function renderEmptyAnalytics() {
        // Show empty state for analytics
        document.getElementById('completionRate').textContent = '0%';
        document.getElementById('onTimeRate').textContent = '0%';
        document.getElementById('avgResponseTime').textContent = '0h';
        document.getElementById('qualityScore').textContent = '0/100';
    }

    function renderEmptyDueDates() {
        // Show empty state for due dates
        const counts = ['overdueCount', 'dueTodayCount', 'dueTomorrowCount', 'dueThisWeekCount', 'dueThisMonthCount'];
        counts.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '0';
        });
    }

    function calculateDueDatesData() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + 7);

        const monthEnd = new Date(now);
        monthEnd.setMonth(now.getMonth() + 1);

        const pendingTasks = tasks.filter(t => t.status === 'pending');

        return {
            overdue: pendingTasks.filter(t => new Date(t.dueDate) < now),
            today: pendingTasks.filter(t => {
                const dueDate = new Date(t.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate.getTime() === now.getTime();
            }),
            tomorrow: pendingTasks.filter(t => {
                const dueDate = new Date(t.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate.getTime() === tomorrow.getTime();
            }),
            thisWeek: pendingTasks.filter(t => {
                const dueDate = new Date(t.dueDate);
                return dueDate > tomorrow && dueDate <= weekEnd;
            }),
            thisMonth: pendingTasks.filter(t => {
                const dueDate = new Date(t.dueDate);
                return dueDate > weekEnd && dueDate <= monthEnd;
            })
        };
    }

    function renderDueDatesData(data) {
        // Update counts
        document.getElementById('overdueCount').textContent = data.overdue.length;
        document.getElementById('dueTodayCount').textContent = data.today.length;
        document.getElementById('dueTomorrowCount').textContent = data.tomorrow.length;
        document.getElementById('dueThisWeekCount').textContent = data.thisWeek.length;
        document.getElementById('dueThisMonthCount').textContent = data.thisMonth.length;

        // Render task previews
        renderTasksPreview('overdueTasksPreview', data.overdue, 'overdue');
        renderTasksPreview('dueTodayTasksPreview', data.today, 'today');
        renderTasksPreview('dueTomorrowTasksPreview', data.tomorrow, 'tomorrow');
        renderTasksPreview('dueThisWeekTasksPreview', data.thisWeek, 'week');
        renderTasksPreview('dueThisMonthTasksPreview', data.thisMonth, 'month');
    }

    function renderTasksPreview(containerId, tasks, type) {
        const container = document.getElementById(containerId);

        if (tasks.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <div class="empty-text">No tasks ${type === 'overdue' ? 'overdue' : 'due ' + type}</div>
            </div>
        `;
            return;
        }

        const tasksToShow = tasks.slice(0, 3); // Show only first 3 tasks

        container.innerHTML = tasksToShow.map(task => `
        <div class="task-preview-item" onclick="viewTaskDetails('${task._id}')">
            <div class="task-preview-info">
                <div class="task-preview-title">${task.title}</div>
                <div class="task-preview-meta">
                    <div class="task-preview-priority">
                        <div class="priority-dot ${task.priority}"></div>
                        ${task.priority.toUpperCase()}
                    </div>
                    <div>Due: ${formatDate(task.dueDate)}</div>
                    <div>${task.type.toUpperCase()}</div>
                </div>
            </div>
            <div class="task-preview-actions">
                <button class="task-preview-btn view" onclick="event.stopPropagation(); viewTaskDetails('${task._id}')" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="task-preview-btn complete" onclick="event.stopPropagation(); markTaskComplete('${task._id}')" title="Complete">
                    <i class="fas fa-check"></i>
                </button>
            </div>
        </div>
    `).join('');

        // Add "show more" link if there are more tasks
        if (tasks.length > 3) {
            container.innerHTML += `
            <div class="task-preview-item" style="justify-content: center; border: none; padding-top: 1rem;">
                <button class="btn btn-small btn-secondary" onclick="showAllTasks('${type}')">
                    View ${tasks.length - 3} more tasks
                </button>
            </div>
        `;
        }
    }

    function renderDueDatesSummary(data) {
        const totalDue = Object.values(data).reduce((sum, tasks) => sum + tasks.length, 0);
        const criticalOverdue = data.overdue.filter(t => t.priority === 'high' || t.priority === 'urgent').length;

        // Calculate today's progress (completed vs total due today)
        const todayCompleted = tasks.filter(t => {
            const completedDate = new Date(t.updatedAt);
            const today = new Date();
            return t.status === 'completed' &&
                completedDate.toDateString() === today.toDateString();
        }).length;

        const todayTotal = data.today.length + todayCompleted;
        const todayProgress = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

        document.getElementById('totalDueTasks').textContent = totalDue;
        document.getElementById('dueTodayTotal').textContent = data.today.length;
        document.getElementById('overdueCritical').textContent = criticalOverdue;
        document.getElementById('completionRateToday').textContent = `${todayProgress}%`;
    }

    // Helper Functions
    function formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const diffTime = date - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
        if (diffDays <= 7) return `In ${diffDays} days`;

        return date.toLocaleDateString();
    }

    function showAllTasks(type) {
        // Switch to all-tasks section and filter by due date
        const navTabs = document.querySelectorAll('.nav-tab');
        const sections = document.querySelectorAll('.section');

        navTabs.forEach(tab => tab.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));

        document.querySelector('[data-section="all-tasks"]').classList.add('active');
        document.getElementById('all-tasks').classList.add('active');

        // Apply date filter
        setTimeout(() => {
            const searchInput = document.getElementById('universalSearch');
            if (searchInput) {
                searchInput.value = `due:${type}`;
                if (typeof filterTasks === 'function') {
                    filterTasks();
                }

            }
        }, 100);
    }


    // In user.js - Update createTaskCard to show job description for job-auto tasks

    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority}`;

        const dueDate = new Date(task.dueDate);
        const today = new Date();
        const isOverdue = task.status === 'pending' && dueDate < today;

        // Handle assignee display (works for both single and multiple)
        const assigneeNames = Array.isArray(task.assignedTo) ?
            task.assignedTo.map(user => user.username || 'Unknown').join(', ') :
            (task.assignedTo?.username || 'Unknown');

        // UPDATED: Show client name in job description for job-auto tasks
        const jobDescription = task.type === 'job-auto' && task.jobDetails ? `
        <div style="background: #eff6ff; padding: 10px; border-radius: 6px; margin: 8px 0; border-left: 3px solid #3b82f6;">
            <div style="font-weight: 600; color: #1e40af; margin-bottom: 4px; font-size: 0.85rem;">
                📋 ${task.jobDetails.customerName} - ${task.jobDetails.itemCode}
            </div>
            <div style="color: #1e40af; font-size: 0.8rem; line-height: 1.3; margin-bottom: 4px;">
                ${task.jobDetails.description}
            </div>
            <div style="font-size: 0.7rem; color: #64748b;">
                Doc: ${task.jobDetails.docNo} | Qty: ${task.jobDetails.qty} | Stage: ${task.jobDetails.currentStage || 'N/A'}
            </div>
        </div>
    ` : '';

        // Show completion status for multi-assignee tasks
        const currentUser = getCurrentUser();
        const multiAssigneeStatus = Array.isArray(task.assignedTo) && task.assignedTo.length > 1 ? `
        <div style="background: #f8fafc; padding: 4px 6px; border-radius: 4px; margin: 4px 0; font-size: 0.7rem; color: #64748b;">
            👥 Multi-assignee: ${task.individualCompletions?.length || 0}/${task.assignedTo.length} completed
            ${task.individualCompletions?.some(comp => comp.userId === currentUser?.id) ? ' (✅ You completed)' : ''}
        </div>
    ` : '';

        // REDUCED card height and padding
        card.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 12px; /* Reduced from 16px */
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
        border: 1px solid #e5e7eb;
        border-left: 3px solid var(--priority-color-${task.priority});
        transition: all 0.2s ease;
        margin-bottom: 10px; /* Reduced from 15px */
        min-height: auto; /* Remove fixed height */
    `;

        // Define priority colors
        const priorityColors = {
            'low': '#10b981',
            'medium': '#f59e0b',
            'high': '#ef4444',
            'urgent': '#dc2626'
        };

        // Set CSS custom property for border color
        card.style.setProperty('border-left-color', priorityColors[task.priority] || '#64748b');

        card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px;">
            <div style="flex: 1; min-width: 0;">
                <h4 style="color: #1e293b; margin: 0 0 4px 0; font-size: 0.95rem; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis;">
                    ${task.title}
                </h4>
                <div style="font-size: 0.7rem; color: #64748b; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span>${task.type.toUpperCase()}</span>
                    <span style="color: ${priorityColors[task.priority]}; font-weight: 600;">${task.priority.toUpperCase()}</span>
                </div>
            </div>
            <span style="
                padding: 2px 6px; 
                border-radius: 10px; 
                font-size: 0.65rem; 
                font-weight: 600;
                background: ${isOverdue ? '#fee2e2' : task.status === 'completed' ? '#dcfce7' : task.status === 'pending_approval' ? '#dbeafe' : '#fef3c7'};
                color: ${isOverdue ? '#991b1b' : task.status === 'completed' ? '#166534' : task.status === 'pending_approval' ? '#1e40af' : '#92400e'};
                white-space: nowrap;
            ">
                ${isOverdue ? '⚠️ OVERDUE' : task.status.replace('_', ' ').toUpperCase()}
            </span>
        </div>

        <!-- COMPACT Description -->
        <div style="color: #475569; margin-bottom: 8px; font-size: 0.8rem; line-height: 1.3; 
                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${task.description}
        </div>

        ${jobDescription}
        ${multiAssigneeStatus}

        <!-- COMPACT Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9;">
            <div style="font-size: 0.7rem; color: #64748b;">
                📅 ${dueDate.toLocaleDateString()}
                ${isOverdue ? ' <span style="color: #ef4444; font-weight: 600;">⚠️</span>' : ''}
            </div>
            <div style="display: flex; gap: 3px;">
                ${task.status === 'pending' && !task.individualCompletions?.some(comp => comp.userId === currentUser?.id) ?
                `<button class="btn-small btn-success" onclick="completeTask('${task._id}')" style="padding: 3px 8px; font-size: 0.7rem; border-radius: 4px;">
                    ✓ Complete
                </button>` : ''}
                <button class="btn-small btn-primary" onclick="viewTaskDetails('${task._id}')" style="padding: 3px 8px; font-size: 0.7rem; border-radius: 4px;">
                    👁️
                </button>
            </div>
        </div>
    `;

        return card;
    }

    function updateTasksGridStyles() {
        const style = document.createElement('style');
        style.textContent = `
        .tasks-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); /* Smaller min-width */
            gap: 12px; /* Reduced gap */
            max-width: 100%;
        }

        .task-card {
            background: white;
            border-radius: 8px;
            padding: 12px; /* Reduced padding */
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
            border: 1px solid #e5e7eb;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            min-height: auto; /* Remove fixed height constraints */
        }

        .task-card:hover {
            transform: translateY(-2px); /* Reduced hover effect */
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .btn-small {
            padding: 3px 8px;
            font-size: 0.7rem;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-weight: 500;
        }

        .btn-small.btn-success {
            background: #10b981;
            color: white;
        }

        .btn-small.btn-primary {
            background: #3b82f6;
            color: white;
        }

        .btn-small:hover {
            transform: scale(1.05);
            opacity: 0.9;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
            .tasks-grid {
                grid-template-columns: 1fr;
                gap: 8px;
            }
            
            .task-card {
                padding: 10px;
            }
        }
    `;
        document.head.appendChild(style);
    }


    // Add function to get current user
    function getCurrentUser() {
        const userInfo = localStorage.getItem('atpl_user_info');
        return userInfo ? JSON.parse(userInfo) : null;
    }

    function renderGroupedTasks(container, groups) {
        Object.values(groups).forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'task-group-card';
            groupCard.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
            cursor: pointer;
            transition: transform 0.2s;
        `;

            groupCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="color: #1e293b; margin-bottom: 5px;">${group.title}</h4>
                    <p style="color: #64748b;">Doc: ${group.docNo} | Customer: ${group.customerName} | ${group.tasks.length} items</p>
                </div>
                <span style="color: #667eea; font-weight: 600;">Click to expand</span>
            </div>
            <div class="group-tasks" style="display: none; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                ${group.tasks.map(task => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #3b82f6;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                                ${task.jobDetails.itemCode} - ${task.jobDetails.customerName}
                            </div>
                            <div style="color: #64748b; font-size: 0.9rem; margin-bottom: 4px;">
                                ${task.jobDetails.description}
                            </div>
                            <div style="font-size: 0.8rem; color: #64748b;">
                                Qty: ${task.jobDetails.qty} | Due: ${new Date(task.dueDate).toLocaleDateString()}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            ${task.status === 'pending' ? `
                                <button class="btn-small btn-success" onclick="completeTask('${task._id}')" style="padding: 6px 12px; font-size: 0.8rem;">
                                    Complete
                                </button>
                            ` : `
                                <span style="padding: 4px 8px; background: #dcfce7; color: #166534; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                                    ${task.status.toUpperCase()}
                                </span>
                            `}
                            <button class="btn-small btn-primary" onclick="viewTaskDetails('${task._id}')" style="padding: 6px 12px; font-size: 0.8rem;">
                                Details
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

            groupCard.addEventListener('click', function (e) {
                if (e.target.tagName !== 'BUTTON') {
                    const tasksDiv = this.querySelector('.group-tasks');
                    tasksDiv.style.display = tasksDiv.style.display === 'none' ? 'block' : 'none';
                }
            });

            container.appendChild(groupCard);
        });
    }

    function makeDashboardStatsClickable() {
        // Total tasks click
        document.querySelector('.stat-card.total')?.addEventListener('click', () => {
            switchToAllTasks();
        });

        // Pending tasks click
        document.querySelector('.stat-card.pending')?.addEventListener('click', () => {
            switchToAllTasks('pending');
        });

        // Completed tasks click
        document.querySelector('.stat-card.completed')?.addEventListener('click', () => {
            switchToAllTasks('completed');
        });

        // Overdue tasks click
        document.querySelector('.stat-card.overdue')?.addEventListener('click', () => {
            switchToAllTasks('overdue');
        });

        // Due dates clicks
        setupDueDateClicks();
    }

    function setupDueDateClicks() {
        // Due dates section clicks
        document.getElementById('dueToday')?.parentElement?.addEventListener('click', () => {
            showDueDateTasks('today');
        });

        document.getElementById('dueTomorrow')?.parentElement?.addEventListener('click', () => {
            showDueDateTasks('tomorrow');
        });

        document.getElementById('dueThisWeek')?.parentElement?.addEventListener('click', () => {
            showDueDateTasks('week');
        });

        document.getElementById('dueThisMonth')?.parentElement?.addEventListener('click', () => {
            showDueDateTasks('month');
        });
    }


    function switchToAllTasks(filterType = null) {
        // Switch to all-tasks section
        const navTabs = document.querySelectorAll('.nav-tab');
        const sections = document.querySelectorAll('.section');

        navTabs.forEach(tab => tab.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));

        document.querySelector('[data-section="all-tasks"]').classList.add('active');
        document.getElementById('all-tasks').classList.add('active');

        // Apply filter if specified
        if (filterType) {
            setTimeout(() => {
                filterUserTasks(filterType);
            }, 100);
        } else {
            renderAllTasks();
        }
    }

    // MODIFY THIS FUNCTION:
    function updateDueDatesSection(stats) {
        // Update due dates display
        document.getElementById('dueToday').textContent = stats.dueToday || 0;
        document.getElementById('dueTomorrow').textContent = stats.dueTomorrow || 0;
        document.getElementById('dueThisWeek').textContent = stats.dueThisWeek || 0;
        document.getElementById('dueThisMonth').textContent = stats.dueThisMonth || 0;

        // Render due tasks in sidebar
        const dueTodayTasks = tasks.filter(t => isDueToday(t));
        const sidebarDueContainer = document.querySelector('.sidebar-widget #dueTodayTasks');
        if (sidebarDueContainer) {
            renderDueTasks('dueTodayTasks', dueTodayTasks);
        }
    }

    function renderDueTasks(containerId, dueTasks) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        dueTasks.slice(0, 3).forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.className = 'due-task-item';
            taskItem.innerHTML = `
                <div style = "font-weight: 600; margin-bottom: 2px;" > ${task.title}</div >
                    <div style="font-size: 0.8rem; color: #64748b;">${task.type.toUpperCase()}</div>
            `;
            container.appendChild(taskItem);
        });

        if (dueTasks.length > 3) {
            const moreItem = document.createElement('div');
            moreItem.className = 'due-task-item';
            moreItem.style.fontStyle = 'italic';
            moreItem.textContent = `+ ${dueTasks.length - 3} more tasks`;
            container.appendChild(moreItem);
        }
    }

    function renderDueDatesSection() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const monthEnd = new Date(today);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const dueTodayTasks = tasks.filter(t =>
            t.status === 'pending' && new Date(t.dueDate).toDateString() === today.toDateString()
        );

        const dueTomorrowTasks = tasks.filter(t =>
            t.status === 'pending' && new Date(t.dueDate).toDateString() === tomorrow.toDateString()
        );

        const dueThisWeekTasks = tasks.filter(t =>
            t.status === 'pending' && new Date(t.dueDate) >= today && new Date(t.dueDate) <= weekEnd
        );

        const dueThisMonthTasks = tasks.filter(t =>
            t.status === 'pending' && new Date(t.dueDate) >= today && new Date(t.dueDate) <= monthEnd
        );

        // Update counters
        document.getElementById('dueToday').textContent = dueTodayTasks.length;
        document.getElementById('dueTomorrow').textContent = dueTomorrowTasks.length;
        document.getElementById('dueThisWeek').textContent = dueThisWeekTasks.length;
        document.getElementById('dueThisMonth').textContent = dueThisMonthTasks.length;

        // Render task lists
        renderDueTasksList('dueTodayTasks', dueTodayTasks);
        renderDueTasksList('dueTomorrowTasks', dueTomorrowTasks);
        renderDueTasksList('dueThisWeekTasks', dueThisWeekTasks);
        renderDueTasksList('dueThisMonthTasks', dueThisMonthTasks);
    }

    function renderDueTasksList(containerId, tasks) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (tasks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px; font-size: 0.9rem;">No tasks due</p>';
            return;
        }

        tasks.slice(0, 5).forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.style.cssText = `
            padding: 8px 12px;
            margin-bottom: 6px;
            background: #f8fafc;
            border-radius: 6px;
            border-left: 3px solid ${task.priority === 'urgent' ? '#ef4444' : task.priority === 'high' ? '#f59e0b' : '#3b82f6'};
            cursor: pointer;
            transition: all 0.2s ease;
        `;

            taskItem.innerHTML = `
            <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 2px; color: #1e293b;">
                ${task.title}
            </div>
            <div style="font-size: 0.75rem; color: #64748b;">
                ${task.priority.toUpperCase()} • ${task.type.toUpperCase()}
            </div>
        `;

            taskItem.addEventListener('mouseenter', () => {
                taskItem.style.background = '#e2e8f0';
                taskItem.style.transform = 'translateX(4px)';
            });

            taskItem.addEventListener('mouseleave', () => {
                taskItem.style.background = '#f8fafc';
                taskItem.style.transform = 'translateX(0)';
            });

            taskItem.addEventListener('click', () => {
                openTaskModal(task);
            });

            container.appendChild(taskItem);
        });

        if (tasks.length > 5) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.textContent = `+${tasks.length - 5} more`;
            showMoreBtn.style.cssText = `
            width: 100%;
            padding: 6px;
            background: transparent;
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            color: #64748b;
            cursor: pointer;
            font-size: 0.8rem;
            margin-top: 6px;
        `;
            showMoreBtn.onclick = () => {
                const period = containerId.includes('Today') ? 'today' :
                    containerId.includes('Tomorrow') ? 'tomorrow' :
                        containerId.includes('Week') ? 'week' : 'month';
                showDueDateTasks(period);
            };
            container.appendChild(showMoreBtn);
        }
    }

    function showDueDateTasks(period) {
        // Switch to due-dates section
        const navTabs = document.querySelectorAll('.nav-tab');
        const sections = document.querySelectorAll('.section');

        navTabs.forEach(tab => tab.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));

        document.querySelector('[data-section="due-dates"]').classList.add('active');
        document.getElementById('due-dates').classList.add('active');

        // Filter and show tasks for the period
        setTimeout(() => {
            filterDueDateTasks(period);
        }, 100);
    }

    function filterDueDateTasks(period) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const monthEnd = new Date(today);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        let filteredTasks = tasks.filter(task => {
            if (task.status !== 'pending') return false;

            const taskDate = new Date(task.dueDate);

            switch (period) {
                case 'today':
                    return taskDate.toDateString() === today.toDateString();
                case 'tomorrow':
                    return taskDate.toDateString() === tomorrow.toDateString();
                case 'week':
                    return taskDate >= today && taskDate <= weekEnd;
                case 'month':
                    return taskDate >= today && taskDate <= monthEnd;
                default:
                    return false;
            }
        });

        // Create detailed modal with tasks
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';

        const periodLabels = {
            today: 'Due Today',
            tomorrow: 'Due Tomorrow',
            week: 'Due This Week',
            month: 'Due This Month'
        };

        modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3 class="modal-title">${periodLabels[period]} (${filteredTasks.length} tasks)</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="duePeriodTasksContainer" style="max-height: 60vh; overflow-y: auto;">
                ${filteredTasks.length === 0 ? `
                    <p style="text-align: center; color: #64748b; padding: 40px;">
                        No tasks ${period === 'today' ? 'due today' : period === 'tomorrow' ? 'due tomorrow' : `due this ${period}`}
                    </p>
                ` : ''}
            </div>
        </div>
    `;

        document.body.appendChild(modal);

        // Render filtered tasks
        if (filteredTasks.length > 0) {
            const container = modal.querySelector('#duePeriodTasksContainer');

            filteredTasks.forEach(task => {
                const taskCard = createInteractiveTaskCard(task, period === 'today');
                container.appendChild(taskCard);
            });
        }
    }

    function createInteractiveTaskCard(task, isToday = false) {
        const card = document.createElement('div');
        card.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        border-left: 4px solid ${isToday ? '#ef4444' : '#f59e0b'};
        transition: all 0.2s ease;
    `;

        const dueDate = new Date(task.dueDate);
        const isOverdue = new Date() > dueDate;

        card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="flex: 1;">
                <h4 style="margin: 0 0 6px 0; color: #1e293b; font-size: 1rem; font-weight: 600;">
                    ${task.title}
                </h4>
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 0.9rem; line-height: 1.4;">
                    ${task.description}
                </p>
                <div style="display: flex; gap: 12px; font-size: 0.8rem; color: #64748b;">
                    <span><strong>Priority:</strong> ${task.priority.toUpperCase()}</span>
                    <span><strong>Type:</strong> ${task.type.toUpperCase()}</span>
                    <span style="color: ${isOverdue ? '#ef4444' : '#64748b'};">
                        <strong>Due:</strong> ${dueDate.toLocaleDateString()}
                        ${isOverdue ? ' (OVERDUE)' : ''}
                    </span>
                </div>
            </div>
            <div style="display: flex; gap: 8px; flex-shrink: 0;">
                ${task.status === 'pending' ? `
                    <button onclick="completeTaskFromDueDate('${task._id}')" style="
                        background: #10b981; 
                        color: white; 
                        border: none; 
                        padding: 8px 16px; 
                        border-radius: 6px; 
                        cursor: pointer; 
                        font-size: 0.8rem; 
                        font-weight: 600;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                        ✓ Complete
                    </button>
                ` : `
                    <span style="
                        padding: 8px 16px; 
                        background: #dcfce7; 
                        color: #166534; 
                        border-radius: 6px; 
                        font-size: 0.8rem; 
                        font-weight: 600;
                    ">
                        ${task.status.replace('_', ' ').toUpperCase()}
                    </span>
                `}
                <button onclick="viewTaskDetailsFromDueDate('${task._id}')" style="
                    background: #3b82f6; 
                    color: white; 
                    border: none; 
                    padding: 8px 12px; 
                    border-radius: 6px; 
                    cursor: pointer; 
                    font-size: 0.8rem;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                    👁️
                </button>
            </div>
        </div>
        
        ${task.jobDetails ? `
            <div style="background: #eff6ff; padding: 10px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                <div style="font-weight: 600; color: #1e40af; margin-bottom: 4px; font-size: 0.85rem;">
                    📋 ${task.jobDetails.customerName} - ${task.jobDetails.itemCode}
                </div>
                <div style="color: #1e40af; font-size: 0.8rem;">
                    Doc: ${task.jobDetails.docNo} | Qty: ${task.jobDetails.qty}
                </div>
            </div>
        ` : ''}
    `;

        return card;
    }


    function filterUserTasks(filterType) {
        const container = document.getElementById('allTasksContainer');
        container.innerHTML = '';

        let filteredTasks = tasks.filter(task => {
            // Check if current user is assigned to this task
            const isAssignedToMe = Array.isArray(task.assignedTo)
                ? task.assignedTo.some(assignee => assignee._id === currentUser.id)
                : (task.assignedTo._id === currentUser.id || task.assignedTo === currentUser.id);

            if (!isAssignedToMe) return false;

            // Apply status filter
            switch (filterType) {
                case 'pending':
                    return task.status === 'pending';
                case 'completed':
                    return task.status === 'completed';
                case 'overdue':
                    return task.status === 'pending' && new Date(task.dueDate) < new Date();
                default:
                    return true;
            }
        });

        if (filteredTasks.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: #64748b; padding: 40px;">No ${filterType} tasks found</p>`;
            return;
        }

        // Create header with filter info
        const header = document.createElement('div');
        header.style.cssText = 'margin-bottom: 20px; padding: 15px; background: white; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        header.innerHTML = `
        <h4 style="margin: 0; color: #1e293b;">
            ${filterType.charAt(0).toUpperCase() + filterType.slice(1)} Tasks (${filteredTasks.length})
        </h4>
        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 0.9rem;">
            Showing ${filterType} tasks assigned to you
        </p>
    `;
        container.appendChild(header);

        // Create grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'tasks-grid';

        filteredTasks.forEach(task => {
            gridContainer.appendChild(createTaskCard(task));
        });

        container.appendChild(gridContainer);
    }


    async function performUniversalSearch() {
        const query = document.getElementById('universalSearch').value.trim();
        if (!query) return;

        try {
            const response = await fetch(`${API_URL}/search?query=${encodeURIComponent(query)}`);
            const results = await response.json();

            searchResults = results;
            renderSearchResults(results);
        } catch (error) {
            showMessage('Error performing search', 'error');
        }
    }

    function renderSearchResults(results) {
        const container = document.getElementById('allTasksContainer');
        container.innerHTML = '';

        if (results.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No results found</p>';
            return;
        }

        const taskResults = results.filter(r => r.resultType === 'task');
        const jobResults = results.filter(r => r.resultType === 'job');

        if (taskResults.length > 0) {
            const taskHeader = document.createElement('h4');
            taskHeader.textContent = `Tasks(${taskResults.length})`;
            taskHeader.style.marginBottom = '15px';
            container.appendChild(taskHeader);

            taskResults.forEach(task => {
                container.appendChild(createTaskCard(task));
            });
        }

        if (jobResults.length > 0) {
            const jobHeader = document.createElement('h4');
            jobHeader.textContent = `Jobs(${jobResults.length})`;
            jobHeader.style.margin = '30px 0 15px 0';
            container.appendChild(jobHeader);

            jobResults.forEach(job => {
                const jobCard = document.createElement('div');
                jobCard.className = 'task-card';
                jobCard.style.borderLeft = '4px solid #8b5cf6';
                jobCard.innerHTML = `
                <div class="task-header" >
                        <div>
                            <div class="task-title">${job.docNo} - ${job.customerName}</div>
                            <div class="task-meta">Item: ${job.itemCode} | Qty: ${job.qty}</div>
                        </div>
                        <span class="task-status status-pending">${job.status}</span>
                    </div >
                    <div class="task-description">${job.description}</div>
                    <div class="task-footer">
                        <small>Month: ${job.month} | Week: ${job.week}</small>
                    </div>
            `;
                container.appendChild(jobCard);
            });
        }
    }

    // Global functions
    window.completeTask = function (taskId) {
        // Add validation to ensure taskId is valid
        if (!taskId || taskId === 'undefined') {
            showMessage('Invalid task ID', 'error');
            return;
        }

        const task = tasks.find(t => t._id === taskId);
        if (!task) {
            showMessage('Task not found', 'error');
            return;
        }

        document.getElementById('completeTaskId').value = taskId;
        openModal('completeTaskModal');
    };

    window.completeTaskFromDueDate = function (taskId) {
        document.querySelector('.modal').remove();
        completeTask(taskId);
    };

    // View task details from due date modal
    window.viewTaskDetailsFromDueDate = function (taskId) {
        const task = tasks.find(t => t._id === taskId);
        if (task) {
            // Close current modal
            document.querySelector('.modal').remove();
            // Open task details modal (use the same function as admin)
            setTimeout(() => openTaskModal(task), 100);
        }
    };



    window.viewTaskDetails = function (taskId) {
        if (!taskId || taskId === 'undefined') {
            showMessage('Invalid task ID', 'error');
            return;
        }

        const task = tasks.find(t => t._id === taskId);
        if (!task) {
            showMessage('Task not found', 'error');
            return;
        }

        showMessage(`Task Details: ${task.title} - ${task.description}`, 'info');
    };

    // Modal functionality
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');

    closeButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('.modal').style.display = 'none';
        });
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
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


    // Complete task form
    document.getElementById('completeTaskForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const taskId = document.getElementById('completeTaskId').value;
        const formData = new FormData(e.target);
        const completionData = {
            remarks: formData.get('remarks'),
            attachments: formData.get('attachment') ? [formData.get('attachment').name] : []
        };

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/complete`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(completionData)
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task submitted for approval', 'success');
                closeModal('completeTaskModal');
                e.target.reset();
                loadTasks();
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            showMessage('Error completing task', 'error');
        }
    });

    document.getElementById('assignPeerTaskForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = new FormData(e.target);

        // Get selected users from the multiple select
        const assignToSelect = document.getElementById('peerTaskAssignTo');
        const selectedUsers = Array.from(assignToSelect.selectedOptions).map(option => option.value);

        if (selectedUsers.length === 0) {
            showMessage('Please select at least one colleague to assign the task', 'error');
            return;
        }

        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            assignedTo: selectedUsers, // This is the key - send as array
            priority: formData.get('priority'),
            dueDate: formData.get('dueDate')
        };


        try {
            const response = await fetch(`${API_URL}/tasks/assign-peer`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(taskData)
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task assigned successfully to colleagues', 'success');
                closeModal('assignPeerTaskModal');
                e.target.reset();
                loadTasks(); // Reload tasks to show the new assignment
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            console.error('Error assigning task:', error);
            showMessage('Error assigning task to colleagues', 'error');
        }
    });

    function loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                loadDashboardStats();
                break;
            case 'all-tasks':
                renderAllTasks();
                break;
            case 'job-entry':
                renderTasksByType('job-entry', 'jobEntryTasksContainer');
                break;
            case 'super-admin':
                renderTasksByType('super-admin', 'superAdminTasksContainer');
                break;
            case 'admin':
                renderTasksByType('admin', 'adminTasksContainer');
                break;
            case 'user-assigned':
                renderTasksByType('user-assigned', 'userAssignedTasksContainer');
                break;
            case 'my-assigned-tasks': // NEW
                renderMyAssignedTasks();
                break;
            case 'due-dates':
                loadEnhancedDueDates();
                break;
            case 'analytics':
                loadEnhancedAnalytics();
                break;
        }
    }

    // NEW: Function to render tasks assigned by current user
    function renderMyAssignedTasks() {
        const container = document.getElementById('myAssignedTasksContainer');
        container.innerHTML = '';

        // Filter tasks assigned by current user
        const myAssignedTasks = tasks.filter(task =>
            task.assignedBy && task.assignedBy._id === currentUser.id
        );

        if (myAssignedTasks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">You haven\'t assigned any tasks to others</p>';
            return;
        }

        // Group tasks by status for better organization
        const groupedTasks = {
            pending: myAssignedTasks.filter(t => t.status === 'pending'),
            pending_approval: myAssignedTasks.filter(t => t.status === 'pending_approval'),
            completed: myAssignedTasks.filter(t => t.status === 'completed'),
            rejected: myAssignedTasks.filter(t => t.status === 'rejected')
        };

        // Create status sections
        Object.entries(groupedTasks).forEach(([status, statusTasks]) => {
            if (statusTasks.length > 0) {
                const statusHeader = document.createElement('h4');
                statusHeader.textContent = `${status.replace('_', ' ').toUpperCase()} (${statusTasks.length})`;
                statusHeader.style.cssText = `
                margin: 20px 0 15px 0;
                color: #1e293b;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 8px;
            `;
                container.appendChild(statusHeader);

                statusTasks.forEach(task => {
                    container.appendChild(createMyAssignedTaskCard(task));
                });
            }
        });
    }

    // NEW: Create task card specifically for tasks assigned by current user
    function createMyAssignedTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority}`;

        const dueDate = new Date(task.dueDate);
        const today = new Date();
        const isOverdue = task.status === 'pending' && dueDate < today;

        // Handle assignee display (works for both single and multiple)
        const assigneeNames = Array.isArray(task.assignedTo) ?
            task.assignedTo.map(user => user.username || 'Unknown').join(', ') :
            (task.assignedTo?.username || 'Unknown');

        // Show completion status for multi-assignee tasks
        const multiAssigneeStatus = Array.isArray(task.assignedTo) && task.assignedTo.length > 1 ? `
        <div style="background: #f8fafc; padding: 6px 8px; border-radius: 4px; margin: 6px 0; font-size: 0.75rem; color: #64748b;">
            👥 Multi-assignee task: ${task.individualCompletions?.length || 0}/${task.assignedTo.length} completed
        </div>
    ` : '';

        // Show completion/rejection details
        const statusDetails = (() => {
            if (task.status === 'completed' && task.completedAt) {
                return `<div style="background: #f0fdf4; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 0.8rem; color: #065f46;">
                ✅ Completed: ${new Date(task.completedAt).toLocaleDateString()}
                ${task.completionRemarks ? `<br>Remarks: ${task.completionRemarks}` : ''}
            </div>`;
            } else if (task.status === 'rejected' && task.rejectionReason) {
                return `<div style="background: #fef2f2; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 0.8rem; color: #991b1b;">
                ❌ Rejected: ${task.rejectionReason}
            </div>`;
            } else if (task.status === 'pending_approval') {
                return `<div style="background: #eff6ff; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 0.8rem; color: #1e40af;">
                ⏳ Waiting for your approval
            </div>`;
            }
            return '';
        })();

        card.innerHTML = `
        <div class="task-header">
            <div>
                <div class="task-title">${task.title}</div>
                <div class="task-meta">
                    Assigned to: ${assigneeNames} | Priority: ${task.priority.toUpperCase()}
                </div>
            </div>
            <span class="task-status ${isOverdue ? 'status-overdue' : 'status-' + task.status}">
                ${isOverdue ? 'Overdue' : task.status.replace('_', ' ').toUpperCase()}
            </span>
        </div>
        
        <div class="task-description">${task.description}</div>
        
        ${multiAssigneeStatus}
        ${statusDetails}
        
        <div class="task-footer">
            <small>Due: ${dueDate.toLocaleDateString()}</small>
            <div class="task-actions">
                ${task.status === 'pending_approval' ? `
                    <button class="btn-small btn-success" onclick="approveMyTask('${task._id}')">Approve</button>
                    <button class="btn-small btn-danger" onclick="rejectMyTask('${task._id}')">Reject</button>
                ` : ''}
                <button class="btn-small btn-primary" onclick="viewTaskDetails('${task._id}')">Details</button>
            </div>
        </div>
    `;

        return card;
    }

    // NEW: Approve task assigned by current user
    window.approveMyTask = async function (taskId) {
        if (!confirm('Are you sure you want to approve this task?')) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Task approved successfully', 'success');
                await loadTasks(); // Reload tasks
                renderMyAssignedTasks(); // Refresh the view
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            console.error('Error approving task:', error);
            showMessage('Error approving task', 'error');
        }
    };

    // NEW: Reject task assigned by current user
    window.rejectMyTask = async function (taskId) {
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
                await loadTasks(); // Reload tasks
                renderMyAssignedTasks(); // Refresh the view
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            console.error('Error rejecting task:', error);
            showMessage('Error rejecting task', 'error');
        }
    };

    function renderUserAnalytics() {
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const totalTasks = tasks.length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;

        const charts = document.querySelectorAll('#analytics .chart-container');
        charts.forEach((chart, index) => {
            switch (index) {
                case 0: // Completion Rate
                    chart.innerHTML = `
                        <div style="text-align: center;">
                            <div style="font-size: 3rem; font-weight: bold; color: #667eea;">${completionRate}%</div>
                            <p>Completion Rate</p>
                            <p style="margin-top: 10px; color: #64748b;">${completedTasks} of ${totalTasks} tasks completed</p>
                        </div>
                    `;
                    break;
                case 1: // Priority Distribution
                    const priorities = ['low', 'medium', 'high', 'urgent'];
                    const priorityCounts = priorities.map(p => tasks.filter(t => t.priority === p).length);
                    chart.innerHTML = `
                        <div style="text-align: center;">
                            <h5 style="margin-bottom: 15px;">Priority Breakdown</h5>
                            ${priorities.map((p, i) => `
                                <div style="margin-bottom: 8px;">
                                    <span style="color: ${getPriorityColor(p)}; font-weight: 600;">${p.toUpperCase()}</span>: ${priorityCounts[i]}
                                </div>
                            `).join('')}
                        </div>
                    `;
                    break;
                case 2: // Monthly Performance
                    chart.innerHTML = `
                        <div style="text-align: center;">
                            <div style="font-size: 2rem; font-weight: bold; color: #10b981;">${completedTasks}</div>
                            <p>Tasks Completed This Month</p>
                        </div>
                    `;
                    break;
            }
        });
    }

    function getPriorityColor(priority) {
        const colors = {
            low: '#10b981',
            medium: '#f59e0b',
            high: '#ef4444',
            urgent: '#dc2626'
        };
        return colors[priority] || '#64748b';
    }

    // Date helper functions
    function isDueToday(task) {
        if (task.status !== 'pending') return false;
        const today = new Date().toDateString();
        return new Date(task.dueDate).toDateString() === today;
    }

    function isDueTomorrow(task) {
        if (task.status !== 'pending') return false;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return new Date(task.dueDate).toDateString() === tomorrow.toDateString();
    }

    function isDueThisWeek(task) {
        if (task.status !== 'pending') return false;
        const today = new Date();
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const taskDate = new Date(task.dueDate);
        return taskDate >= today && taskDate <= weekEnd;
    }

    function isDueThisMonth(task) {
        if (task.status !== 'pending') return false;
        const today = new Date();
        const monthEnd = new Date(today);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        const taskDate = new Date(task.dueDate);
        return taskDate >= today && taskDate <= monthEnd;
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
        // If opening the peer task modal, ensure users are loaded
        if (modalId === 'assignPeerTaskModal') {
            if (users.length === 0) {
                console.log('Users not loaded, loading now...');
                loadUsers().then(() => {
                    document.getElementById(modalId).style.display = 'block';
                });
                return;
            }
        }
        document.getElementById(modalId).style.display = 'block';
    }

    window.completeAllInGroup = async function (docNo, title) {
        const tasksInGroup = tasks.filter(task =>
            task.jobDetails &&
            task.jobDetails.docNo === docNo &&
            task.title === title &&
            task.status === 'pending'
        );

        if (tasksInGroup.length === 0) {
            showMessage('No pending tasks found in this group', 'info');
            return;
        }

        const confirmMessage = `Are you sure you want to complete all ${tasksInGroup.length} tasks in this group?\n\nDoc: ${docNo}\nTask: ${title}`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // Show loading state
        const completeBtn = document.querySelector(`button[onclick="completeAllInGroup('${docNo}', '${title}')"]`);
        if (completeBtn) {
            completeBtn.innerHTML = '⏳ Completing...';
            completeBtn.disabled = true;
        }

        let successCount = 0;
        let errorCount = 0;

        // Complete each task individually
        for (const task of tasksInGroup) {
            try {
                const response = await fetch(`${API_URL}/tasks/${task._id}/complete`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        remarks: `Bulk completion for ${docNo} - ${title}`,
                        attachments: []
                    })
                });

                const result = await response.json();

                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error('Failed to complete task:', task._id, result.error);
                }
            } catch (error) {
                errorCount++;
                console.error('Error completing task:', task._id, error);
            }
        }

        // Show results and reload
        if (successCount > 0) {
            showMessage(`Successfully completed ${successCount} tasks${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
                errorCount > 0 ? 'warning' : 'success');

            // Reload tasks to update UI
            await loadTasks();

            // Refresh the current section
            loadSectionData('job-entry');
        } else {
            showMessage('Failed to complete any tasks', 'error');

            // Re-enable button
            if (completeBtn) {
                completeBtn.innerHTML = '✓ Complete All';
                completeBtn.disabled = false;
            }
        }
    };

    window.loadEnhancedAnalytics = loadEnhancedAnalytics;
    window.loadEnhancedDueDates = loadEnhancedDueDates;

    window.closeModal = function (modalId) {
        document.getElementById(modalId).style.display = 'none';
    };
    window.openModal = openModal;

    function showMessage(message, type = 'info') {
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
