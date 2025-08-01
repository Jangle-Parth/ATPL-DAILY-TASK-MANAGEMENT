document.addEventListener('DOMContentLoaded', function () {
    let currentUser = null;
    let tasks = [];
    let searchResults = [];
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

            loadSectionData(targetSection);
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
                loadTasks(),
                loadDashboardStats()
            ]);
        } catch (error) {
            showMessage('Error loading dashboard', 'error');
        }
    }

    async function loadTasks() {
        try {
            const response = await fetch(`${API_URL}/tasks`, {
                headers: getAuthHeaders()
            });
            tasks = await response.json();
            renderAllTasks();
        } catch (error) {
            showMessage('Error loading tasks', 'error');
        }
    }

    async function loadDashboardStats() {
        try {
            const response = await fetch(`${API_URL}/dashboard/user`, {
                headers: getAuthHeaders()
            });
            const stats = await response.json();
            updateDueDatesSection(stats);
        } catch (error) {
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

    function renderAllTasks() {
        const container = document.getElementById('allTasksContainer');
        container.innerHTML = '';

        if (tasks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No tasks assigned</p>';
            return;
        }

        tasks.forEach(task => {
            container.appendChild(createTaskCard(task));
        });
    }

    function renderTasksByType(type, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        const filteredTasks = tasks.filter(task => {
            if (type === 'job-entry') return task.type === 'job-auto';
            if (type === 'super-admin') return task.type === 'super-admin';
            if (type === 'admin') return task.type === 'admin';
            if (type === 'user-assigned') return task.type === 'user';
            return false;
        });

        if (filteredTasks.length === 0) {
            container.innerHTML = `<p style = "text-align: center; color: #64748b; padding: 40px;"> No ${type} tasks</p> `;
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

    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority}`;

        const dueDate = new Date(task.dueDate);
        const today = new Date();
        const isOverdue = task.status === 'pending' && dueDate < today;

        card.innerHTML = `
        <div class="task-header">
            <div>
                <div class="task-title">${task.title}</div>
                <div class="task-meta">
                    Type: ${task.type.toUpperCase()} | Priority: ${task.priority.toUpperCase()}
                    ${task.docNo ? `| Doc: ${task.docNo}` : ''}
                </div>
            </div>
            <span class="task-status ${isOverdue ? 'status-overdue' : 'status-' + task.status}">
                ${isOverdue ? 'Overdue' : task.status.replace('_', ' ').toUpperCase()}
            </span>
        </div>
        <div class="task-description">${task.description}</div>
        <div class="task-footer">
            <small>Due: ${dueDate.toLocaleDateString()}</small>
            <div class="task-actions">
                ${task.status === 'pending' ?
                `<button class="btn-small btn-success" onclick="completeTask('${task._id}')">Complete</button>` : ''}
                <button class="btn-small btn-primary" onclick="viewTaskDetails('${task._id}')">Details</button>
            </div>
        </div>
    `;

        return card;
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

    function updateDueDatesSection(stats) {
        document.getElementById('dueToday').textContent = stats.dueToday;
        document.getElementById('dueTomorrow').textContent = stats.dueTomorrow;
        document.getElementById('dueThisWeek').textContent = stats.dueThisWeek;
        document.getElementById('dueThisMonth').textContent = stats.dueThisMonth;

        // Render due tasks
        renderDueTasks('dueTodayTasks', tasks.filter(t => isDueToday(t)));
        renderDueTasks('dueTomorrowTasks', tasks.filter(t => isDueTomorrow(t)));
        renderDueTasks('dueThisWeekTasks', tasks.filter(t => isDueThisWeek(t)));
        renderDueTasks('dueThisMonthTasks', tasks.filter(t => isDueThisMonth(t)));
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
            case 'due-dates':
                loadDashboardStats();
                break;
            case 'analytics':
                renderUserAnalytics();
                break;
        }
    }

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
        document.getElementById(modalId).style.display = 'block';
    }

    window.closeModal = function (modalId) {
        document.getElementById(modalId).style.display = 'none';
    };

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
