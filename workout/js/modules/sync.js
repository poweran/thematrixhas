import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { store } from './store.js';
import { getWeekId } from './utils.js';

// ВНИМАНИЕ: Замените на вашу конфигурацию Firebase
// 1. Перейдите в https://console.firebase.google.com/
// 2. Создайте проект и добавьте Web App
// 3. Скопируйте firebaseConfig сюда
const firebaseConfig = {
    apiKey: "AIzaSyBsNne6zMhyYDptQif99s7Jgd3VoEz3TVw",
    authDomain: "workout-186d1.firebaseapp.com",
    databaseURL: "https://workout-186d1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "workout-186d1",
    storageBucket: "workout-186d1.firebasestorage.app",
    messagingSenderId: "1036762452160",
    appId: "1:1036762452160:web:f4a770b6e8c5ba4fb8dd25"
};

let app, auth, db;
let unsubscribeDoc = null;
let currentUser = null;

export const sync = {
    init() {
        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);

            // Listen for auth state
            onAuthStateChanged(auth, (user) => {
                currentUser = user;
                if (user) {
                    console.log('Firebase Auth: User is signed in:', user.uid);
                    this.startSync();
                } else {
                    console.log('Firebase Auth: User signed out');
                    this.stopSync();
                }
            });

            // Listen for local store changes to push to cloud
            store.subscribe((source) => {
                if (source === 'local' && currentUser) {
                    this.pushToCloud();
                }
                if (source === 'local_stats' && currentUser) {
                    this.pushStatsToCloud();
                }
            });

        } catch (e) {
            console.error('Firebase Init Error (Check config):', e);
        }
    },

    async signInWithGoogleToken(idToken) {
        if (!auth) return;
        try {
            const credential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, credential);
        } catch (e) {
            console.error('Firebase Sign In Error:', e);
        }
    },

    async logout() {
        if (!auth) return;
        await signOut(auth);
    },

    async startSync() {
        if (!currentUser || !db) return;

        const weekId = getWeekId(store.currentWeekOffset);
        const docRef = doc(db, "users", currentUser.uid, "weeks", weekId);
        const statsRef = doc(db, "users", currentUser.uid, "data", "stats");

        // 1. Week Data Listener
        unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
            const source = docSnap.metadata.hasPendingWrites ? "Local" : "Server";
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (JSON.stringify(store.state) !== JSON.stringify(data)) {
                    console.log(`Sync: Applying update from cloud (week)`);
                    store.setState(data);
                }
            } else {
                if (Object.keys(store.state).length > 0) {
                    this.pushToCloud(true);
                }
            }
        });

        // 2. Stats Data Listener
        // Note: We use a separate unsubscribe variable for stats ideally, but for simplicity let's misuse the same logic or just fire and forget if simplistic. 
        // Correct way: store multiple unsubscribes.
        this.unsubscribeStats = onSnapshot(statsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const cloudStats = data.list || [];
                if (JSON.stringify(store.getStats()) !== JSON.stringify(cloudStats)) {
                    console.log('Sync: Applying stats from cloud');
                    store.setStats(cloudStats);
                }
            } else {
                if (store.getStats().length > 0) {
                    this.pushStatsToCloud();
                }
            }
        });
    },

    stopSync() {
        if (unsubscribeDoc) {
            unsubscribeDoc();
            unsubscribeDoc = null;
        }
        if (this.unsubscribeStats) {
            this.unsubscribeStats();
            this.unsubscribeStats = null;
        }
    },

    async pushToCloud(force = false) {
        if (!currentUser || !db) return;

        const weekId = getWeekId(store.currentWeekOffset);
        const docRef = doc(db, "users", currentUser.uid, "weeks", weekId);

        try {
            await setDoc(docRef, store.state, { merge: true });
            console.log('Sync: Pushed week data');
        } catch (e) {
            console.error("Sync Push Error:", e);
        }
    },

    async pushStatsToCloud() {
        if (!currentUser || !db) return;
        const statsRef = doc(db, "users", currentUser.uid, "data", "stats");
        try {
            await setDoc(statsRef, { list: store.getStats() }, { merge: true });
            console.log('Sync: Pushed stats data');
        } catch (e) {
            console.error("Sync Stats Push Error:", e);
        }
    }
};
