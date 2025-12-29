export const auth = {
    user: null,

    init() {
        // Проверяем доступность объекта google c интервалом,
        // так как скрипт может загрузиться чуть позже основной логики
        const checkGoogle = setInterval(() => {
            if (window.google) {
                clearInterval(checkGoogle);
                this.initializeGoogle();
            }
        }, 100);
    },

    initializeGoogle() {
        // ВНИМАНИЕ: Пользователь должен заменить YOUR_CLIENT_ID на свой реальный Client ID из Google Cloud Console
        const CLIENT_ID = "875544173752-fgbpus92lb8atr07bv6vq705dp5c56st.apps.googleusercontent.com";

        window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: this.handleCredentialResponse.bind(this)
        });

        // Рендерим кнопку, если пользователь не авторизован
        if (!this.user) {
            this.renderButton();
        }
    },

    renderButton() {
        const parent = document.getElementById('google-auth-container');
        if (parent) {
            window.google.accounts.id.renderButton(
                parent,
                { theme: "outline", size: "medium", shape: "pill" }
            );
        }
    },

    handleCredentialResponse(response) {
        const payload = this.decodeJwt(response.credential);
        this.user = payload;
        console.log("User logged in:", this.user.name);
        this.renderUserInfo();
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
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text);">
                <img src="${this.user.picture}" style="width: 24px; height: 24px; border-radius: 50%;">
                <span>${this.user.given_name}</span>
            </div>
        `;
    }
};
