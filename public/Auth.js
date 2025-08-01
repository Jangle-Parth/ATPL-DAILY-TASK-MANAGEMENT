// auth.js - Token management utility
class AuthManager {
    constructor() {
        this.tokenKey = 'atpl_auth_token';
        this.userKey = 'atpl_user_info';
    }

    setToken(token) {
        localStorage.setItem(this.tokenKey, token);
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    setUser(user) {
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    getUser() {
        const user = localStorage.getItem(this.userKey);
        return user ? JSON.parse(user) : null;
    }

    clearAuth() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    getAuthHeaders() {
        const token = this.getToken();
        return token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }
}

const authManager = new AuthManager();