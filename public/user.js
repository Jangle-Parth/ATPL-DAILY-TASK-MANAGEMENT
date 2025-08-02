document.addEventListener('DOMContentLoaded', function () {
    let currentUser = null;
    let tasks = [];
    let searchResults = [];
    const API_URL = 'https://atpl-daily-task-management.onrender.com/api';
    // const API_URL = 'http://localhost:3000/api';
    let users = [];


    // Check authentication
    checkAuth();

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
            if (typeof loadSectionData === 'function') {
                loadSectionData(targetSection);
            }
        });
    });

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

            renderAllTasks();
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

        tasksAssignedToMe.forEach(task => {
            container.appendChild(createTaskCard(task));
        });
    }

    function renderTasksByType(type, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        const filteredTasks = tasks.filter(task => {
            // First, exclude tasks assigned BY current user (they should only appear in "My Assigned Tasks")
            if (task.assignedBy && (task.assignedBy._id === currentUser.id || task.assignedBy === currentUser.id)) {
                return false; // Don't show tasks I assigned in other sections
            }

            // Then filter by type for tasks assigned TO current user
            if (type === 'job-entry') return task.type === 'job-auto';
            if (type === 'super-admin') return task.type === 'super-admin';
            if (type === 'admin') return task.type === 'admin';
            if (type === 'user-assigned') return task.type === 'user' || task.type === 'manual';
            return false;
        });

        if (filteredTasks.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: #64748b; padding: 40px;">No ${type.replace('-', ' ')} tasks assigned to you</p>`;
            return;
        }

        // Group job-entry tasks by docNo and customer
        if (type === 'job-entry') {
            const groupedTasks = groupTasksByJob(filteredTasks);
            renderGroupedTasks(container, groupedTasks);
        } else {
            filteredTasks.forEach(task => {
                container.appendChild(createTaskCard(task));
            });
        }
    }

    function groupTasksByJob(tasks) {
        const groups = {};
        tasks.forEach(task => {
            if (task.docNo && task.customerName) {
                const key = `${task.docNo} - ${task.customerName} - ${task.currentStage}`;
                if (!groups[key]) {
                    groups[key] = {
                        docNo: task.docNo,
                        customerName: task.customerName,
                        currentStage: task.currentStage,
                        tasks: []
                    };
                }
                groups[key].tasks.push(task);
            }
        });
        return groups;
    }

    function renderGroupedTasks(container, groups) {
        Object.values(groups).forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'task-group-card';
            groupCard.style.cssText = `
                background: white;
            border - radius: 12px;
            padding: 20px;
            margin - bottom: 20px;
            box - shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
            cursor: pointer;
            transition: transform 0.2s;
            `;

            groupCard.innerHTML = `
                <div style = "display: flex; justify-content: space-between; align-items: center;" >
                    <div>
                        <h4 style="color: #1e293b; margin-bottom: 5px;">${group.docNo} - ${group.customerName}</h4>
                        <p style="color: #64748b;">Stage: ${group.currentStage} | ${group.tasks.length} tasks</p>
                    </div>
                    <span style="color: #667eea; font-weight: 600;">Click to expand</span>
                </div >
                <div class="group-tasks" style="display: none; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                    ${group.tasks.map(task => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 10px;">
                            <div>
                                <strong>${task.itemCode}</strong> - ${task.description}
                                <br><small>Qty: ${task.qty}</small>
                            </div>
                            <button class="btn-small btn-success" onclick="completeTask(${task.id})">Complete</button>
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

        // Show job description prominently for job-auto tasks
        const jobDescription = task.type === 'job-auto' && task.jobDetails?.description ? `
        <div style="background: #eff6ff; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #3b82f6;">
            <div style="font-weight: 600; color: #1e40af; margin-bottom: 6px; font-size: 0.9rem;">
                📋 Job Description:
            </div>
            <div style="color: #1e40af; font-size: 0.85rem; line-height: 1.4;">
                ${task.jobDetails.description}
            </div>
            <div style="margin-top: 6px; font-size: 0.75rem; color: #64748b;">
                Doc: ${task.jobDetails.docNo} | Item: ${task.jobDetails.itemCode} | Qty: ${task.jobDetails.qty}
            </div>
        </div>
    ` : '';

        // Show completion status for multi-assignee tasks
        const currentUser = getCurrentUser();
        const multiAssigneeStatus = task.assignedTo.length > 1 ? `
        <div style="background: #f8fafc; padding: 6px 8px; border-radius: 4px; margin: 6px 0; font-size: 0.75rem; color: #64748b;">
            👥 Multi-assignee task: ${task.individualCompletions?.length || 0}/${task.assignedTo.length} completed
            ${task.individualCompletions?.some(comp => comp.userId === currentUser?.id) ? ' (✅ You completed)' : ''}
        </div>
    ` : '';

        card.innerHTML = `
        <div class="task-header">
            <div>
                <div class="task-title">${task.title}</div>
                <div class="task-meta">
                    Type: ${task.type.toUpperCase()} | Priority: ${task.priority.toUpperCase()}
                    ${task.type === 'job-auto' ? `| Stage: ${task.jobDetails?.currentStage || 'N/A'}` : ''}
                </div>
            </div>
            <span class="task-status ${isOverdue ? 'status-overdue' : 'status-' + task.status}">
                ${isOverdue ? 'Overdue' : task.status.replace('_', ' ').toUpperCase()}
            </span>
        </div>
        
        <div class="task-description">${task.description}</div>
        
        ${jobDescription}
        ${multiAssigneeStatus}
        
        <div class="task-footer">
            <small>Due: ${dueDate.toLocaleDateString()}</small>
            <div class="task-actions">
                ${task.status === 'pending' && !task.individualCompletions?.some(comp => comp.userId === currentUser?.id) ?
                `<button class="btn-small btn-success" onclick="completeTask('${task._id}')">Complete</button>` : ''}
                <button class="btn-small btn-primary" onclick="viewTaskDetails('${task._id}')">Details</button>
            </div>
        </div>
    `;

        return card;
    }

    // Add function to get current user
    function getCurrentUser() {
        const userInfo = localStorage.getItem('atpl_user_info');
        return userInfo ? JSON.parse(userInfo) : null;
    }

    // Fix 2: Update renderGroupedTasks function in user.js
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
                    <h4 style="color: #1e293b; margin-bottom: 5px;">${group.docNo} - ${group.customerName}</h4>
                    <p style="color: #64748b;">Stage: ${group.currentStage} | ${group.tasks.length} tasks</p>
                </div>
                <span style="color: #667eea; font-weight: 600;">Click to expand</span>
            </div>
            <div class="group-tasks" style="display: none; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                ${group.tasks.map(task => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 10px;">
                        <div>
                            <strong>${task.itemCode}</strong> - ${task.description}
                            <br><small>Qty: ${task.qty}</small>
                        </div>
                        <button class="btn-small btn-success" onclick="completeTask('${task._id}')">Complete</button>
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
                loadDashboardStats();
                break;
            case 'analytics':
                renderUserAnalytics();
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
