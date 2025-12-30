import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
let isPushingToCloud = false; // Флаг для игнорирования своих изменений

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
        console.log('Sync: Starting listener...', currentUser.uid);

        // 1. Listen to ALL weeks for analytics and current state
        const weeksColl = collection(db, "users", currentUser.uid, "weeks");

        unsubscribeDoc = onSnapshot(weeksColl, (snapshot) => {
            // Игнорируем обратные вызовы от наших же изменений
            if (isPushingToCloud) {
                console.log('Sync: Ignoring snapshot during push');
                return;
            }

            snapshot.docChanges().forEach((change) => {
                const weekId = change.doc.id;
                const data = change.doc.data();

                // Update Cache
                store.updateWeeksCache(weekId, data);

                // If this is the CURRENT week being viewed, update state
                const currentWeekId = getWeekId(store.currentWeekOffset);
                if (weekId === currentWeekId && change.type === "modified") {
                    // Check if it's external
                    if (JSON.stringify(store.state) !== JSON.stringify(data)) {
                        console.log(`Sync: Updating current week state from cloud`);
                        store.setState(data);
                    }
                }

                // Initial load of current week
                if (weekId === currentWeekId && change.type === "added") {
                    if (JSON.stringify(store.state) !== JSON.stringify(data)) {
                        store.setState(data);
                    }
                }
            });

            // Check if current week is missing in cloud
            const currentWeekId = getWeekId(store.currentWeekOffset);
            // This is tricky with collection listener, we don't know if "added" loop finished.
            // But we can check store.weeksCache[currentWeekId]
            setTimeout(() => {
                if (!store.weeksCache[currentWeekId] && Object.keys(store.state).length > 0) {
                    this.pushToCloud(true);
                }
            }, 1000);

        }, (error) => {
            console.error("Sync: Collection Listener Error:", error);
        });
    },

    stopSync() {
        if (unsubscribeDoc) {
            unsubscribeDoc();
            unsubscribeDoc = null;
        }
    },

    async pushToCloud(force = false) {
        if (!currentUser || !db) return;

        const weekId = getWeekId(store.currentWeekOffset);
        const docRef = doc(db, "users", currentUser.uid, "weeks", weekId);

        try {
            isPushingToCloud = true;
            await setDoc(docRef, store.state, { merge: true });
            console.log('Sync: Pushed week data');
            // Небольшая задержка перед сбросом флага, чтобы onSnapshot успел сработать
            setTimeout(() => {
                isPushingToCloud = false;
            }, 500);
        } catch (e) {
            isPushingToCloud = false;
            console.error("Sync Push Error:", e);
        }
    },

    async pushStatsToCloud() {
        // No-op. Stats are derived from weeks now.
    }
};

