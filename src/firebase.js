// Firebase Configuration & Auth Module
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDKve3-De--2xyHiFUPI0egmJThM4VmpNM",
  authDomain: "fanrank-7dfa4.firebaseapp.com",
  projectId: "fanrank-7dfa4",
  storageBucket: "fanrank-7dfa4.firebasestorage.app",
  messagingSenderId: "521381006963",
  appId: "1:521381006963:web:0780d32866807e15d82406",
  measurementId: "G-VJR35NVZ8Y"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let confirmationResult = null;
let recaptchaVerifier = null;

// ============================
// Auth Functions
// ============================

export function onAuthChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

export function setupRecaptcha(containerId) {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {}
  });
  return recaptchaVerifier;
}

export async function sendOTP(phoneNumber) {
  try {
    if (!recaptchaVerifier) {
      setupRecaptcha('recaptcha-container');
    }
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return { success: true, error: null };
  } catch (error) {
    // Reset recaptcha on error
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    return { success: false, error: error.message };
  }
}

export async function verifyOTP(otp) {
  try {
    if (!confirmationResult) {
      return { user: null, error: 'No OTP request found. Please resend OTP.' };
    }
    const result = await confirmationResult.confirm(otp);
    confirmationResult = null;
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: 'Invalid OTP. Please try again.' };
  }
}

export async function logOut() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================
// Firestore - Projects
// ============================

export async function saveProject(userId, projectId, projectData) {
  try {
    const ref = doc(db, 'users', userId, 'blueprint', projectId);
    await setDoc(ref, {
      ...projectData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, error: error.message };
  }
}

export async function loadProject(userId, projectId) {
  try {
    const ref = doc(db, 'users', userId, 'blueprint', projectId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { data: snap.data(), error: null };
    }
    return { data: null, error: 'Project not found' };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

export async function listProjects(userId) {
  try {
    const ref = collection(db, 'users', userId, 'blueprint');
    const q = query(ref, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    const projects = [];
    snapshot.forEach(doc => {
      projects.push({ id: doc.id, ...doc.data() });
    });
    return { projects, error: null };
  } catch (error) {
    return { projects: [], error: error.message };
  }
}

export async function deleteProject(userId, projectId) {
  try {
    const ref = doc(db, 'users', userId, 'blueprint', projectId);
    await deleteDoc(ref);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
