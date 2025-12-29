export const auth = {
    user: null,

    init() {
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
            this.user = JSON.parse(storedUser);
        }

        const checkGoogle = setInterval(() => {
            if (window.google) {
                clearInterval(checkGoogle);
                this.initializeGoogle();
            }
        }, 100);
    },

    initializeGoogle() {
        const CLIENT_ID = "875544173752-fgbpus92lb8atr07bv6vq705dp5c56st.apps.googleusercontent.com";

        window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: this.handleCredentialResponse.bind(this)
        });

        if (this.user) {
            this.renderUserInfo();
        } else {
            this.renderButton();
        }
    },

    renderButton() {
        const parent = document.getElementById('google-auth-container');
        if (parent) {
            parent.innerHTML = ''; // Clear previous content (e.g. user info)
            window.google.accounts.id.renderButton(
                parent,
                { theme: "filled_black", size: "medium", shape: "rectangular", text: "signin" }
            );
        }
    },

    handleCredentialResponse(response) {
        const payload = this.decodeJwt(response.credential);
        this.user = payload;
        localStorage.setItem('auth_user', JSON.stringify(this.user));
        this.renderUserInfo();
    },

    logout() {
        this.user = null;
        localStorage.removeItem('auth_user');
        window.google.accounts.id.disableAutoSelect(); // Prevent auto-relogin
        this.renderButton();
    },

    decodeJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("Error decoding JWT", e);
            return null;
        }
    },

    renderUserInfo() {
        const parent = document.getElementById('google-auth-container');
        if (!parent || !this.user) return;

        parent.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--text);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${this.user.picture}" style="width: 28px; height: 28px; border-radius: 50%;">
                    <span>${this.user.given_name}</span>
                </div>
                <button id="auth-logout-btn" style="background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 4px 8px; font-size: 11px; cursor: pointer; border-radius: 0; transition: .2s;">Выйти</button>
            </div>
        `;

        document.getElementById('auth-logout-btn').onclick = () => this.logout();
    }
};
