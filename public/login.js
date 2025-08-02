
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const API_URL = 'http://localhost:3000/api';

    // Check if already logged in
    checkExistingAuth();

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = new FormData(loginForm);
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (result.success) {
                // Store token and user info
                localStorage.setItem('atpl_auth_token', result.token);
                localStorage.setItem('atpl_user_info', JSON.stringify(result.user));

                // Redirect based on role
                if (result.user.role === 'admin' || result.user.role === 'super-admin') {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/user';
                }
            } else {
                showError(result.error);
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Login failed. Please check your connection and try again.');
        }
    });

    async function checkExistingAuth() {
        const token = localStorage.getItem('atpl_auth_token');
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/verify-token`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Update stored user info
                    localStorage.setItem('atpl_user_info', JSON.stringify(result.user));

                    // Redirect based on role
                    if (result.user.role === 'admin' || result.user.role === 'super-admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = '/user';
                    }
                }
            } else {
                // Token is invalid, clear storage
                localStorage.removeItem('atpl_auth_token');
                localStorage.removeItem('atpl_user_info');
            }
        } catch (error) {
            localStorage.removeItem('atpl_auth_token');
            localStorage.removeItem('atpl_user_info');
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
});