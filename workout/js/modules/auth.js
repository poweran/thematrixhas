import { sync } from './sync.js';

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
        const CLIENT_ID = "1036762452160-or5j8rmm3bm99ogjddkpr4tk49acugjv.apps.googleusercontent.com";

        window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: this.handleCredentialResponse.bind(this),
            use_fedcm_for_prompt: false,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        // Log initialization success (GIS doesn't strictly have an init callback, but we proceed)
        console.log("GIS Initialized with Client ID ends in:", CLIENT_ID.slice(-10));

        if (this.user) {
            this.renderUserInfo();
        } else {
            this.renderButton();
        }
    },

    renderButton() {
        const parent = document.getElementById('google-auth-container');
        if (parent) {
            parent.innerHTML = ''; // Clear previous content

            // Check for embedded browsers which often break Google Auth
            const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
            const isEmbedded = (ua.includes("telegram")) || (ua.includes("instagram")) || (ua.includes("tiktok")) || (ua.includes("fban") || ua.includes("fbav")); // FBAN/FBAV is Facebook app

            if (isEmbedded) {
                parent.innerHTML = `
                    <div style="font-size: 11px; line-height: 1.2; color: #fbbf24; text-align: right; max-width: 140px;">
                        Google вход не работает внутри Telegram.<br>
                        <strong style="color: #fff;">Откройте в Chrome/Safari</strong> ↗
                    </div>
                `;
                return;
            }

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

        // Sync with Firebase
        sync.signInWithGoogleToken(response.credential);

        this.renderUserInfo();
    },

    logout() {
        this.user = null;
        localStorage.removeItem('auth_user');
        window.google.accounts.id.disableAutoSelect(); // Prevent auto-relogin
        sync.logout();
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
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #fff; background: #555658; height: 32px; border-radius: 3px; padding: 0 10px 0 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${this.user.picture}" style="width: 20px; height: 20px; border-radius: 50%;">
                    <span style="font-weight: 500;">${this.user.given_name}</span>
                </div>
                <button id="auth-logout-btn" style="background: transparent; border: none; border-left: 1px solid rgba(255,255,255,0.3); color: rgba(255,255,255,0.8); padding: 0 0 0 10px; font-size: 11px; cursor: pointer; height: 16px; line-height: 16px; transition: .2s;">Выйти</button>
            </div>
        `;

        document.getElementById('auth-logout-btn').onclick = () => this.logout();
    }
};
