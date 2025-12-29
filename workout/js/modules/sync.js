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
            store.subscribe(() => {
                // If this update didn't come from cloud (handled in store via flag, but here we just check equality or rely on debouncing)
                // Actually, store doesn't tell us origin.
                // We will implement `pushToCloud` which checks difference or just overwrites.
                if (currentUser) {
                    this.pushToCloud();
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

        // 1. Initial Load / Realtime Listener
        unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
            const source = docSnap.metadata.hasPendingWrites ? "Local" : "Server";
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Compare with current? Simpler: Update store.
                // Store.setState calls notify(), which calls pushToCloud.
                // We need to avoid infinite loop.
                // One way: Check if data is deeply equal.
                // Or set a flag "isUpdatingFromCloud".
                // store.setState(data) passes true to skipNotify? No, setState(data) uses 'true' for skipCloudSync logic inside store?
                // Let's modify store.js logic slightly or handle it here.

                // Let's compare JSON strings to be safe/lazy
                if (JSON.stringify(store.state) !== JSON.stringify(data)) {
                    console.log(`Sync: Received update from ${source}`);
                    store.setState(data);
                }
            } else {
                // Doc doesn't exist. If we have local data, create it.
                if (Object.keys(store.state).length > 0) {
                    this.pushToCloud(true);
                }
            }
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

        // Basic Debounce or Loop prevention involves checking timestamps or deep equality, 
        // but since onSnapshot triggers locally on write, we need to be careful.
        // The safest way with simple logic: setDoc doesn't fire onSnapshot with 'Server' status immediately?
        // Actually, onSnapshot fires for local writes immediately with hasPendingWrites=true.
        // We ignored hasPendingWrites above? No.

        // If we are pushing, it's a local write.
        const weekId = getWeekId(store.currentWeekOffset);
        const docRef = doc(db, "users", currentUser.uid, "weeks", weekId);

        try {
            await setDoc(docRef, store.state, { merge: true });
        } catch (e) {
            console.error("Sync Push Error:", e);
        }
    }
};
