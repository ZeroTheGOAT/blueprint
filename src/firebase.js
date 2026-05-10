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
  serverTimestamp,
  collectionGroup,
  arrayUnion
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

export async function saveProject(ownerId, projectId, projectData) {
  try {
    const ref = doc(db, 'users', ownerId, 'blueprint', projectId);
    await setDoc(ref, {
      ...projectData,
      ownerId: ownerId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, error: error.message };
  }
}

export async function shareProject(ownerId, projectId, email) {
  try {
    const ref = doc(db, 'users', ownerId, 'blueprint', projectId);
    await setDoc(ref, {
      sharedWith: arrayUnion(email)
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Share error:', error);
    return { success: false, error: error.message };
  }
}

export async function saveProjectVersion(ownerId, projectId, projectData, versionMessage = "Auto-save") {
  try {
    const versionsRef = collection(db, 'users', ownerId, 'blueprint', projectId, 'versions');
    await setDoc(doc(versionsRef), {
      ...projectData,
      message: versionMessage,
      createdAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Save version error:', error);
    return { success: false, error: error.message };
  }
}

export async function listProjectVersions(ownerId, projectId) {
  try {
    const versionsRef = collection(db, 'users', ownerId, 'blueprint', projectId, 'versions');
    const q = query(versionsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const versions = [];
    snap.forEach(docSnap => {
      versions.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { versions, error: null };
  } catch (error) {
    console.error('List versions error:', error);
    return { versions: [], error: error.message };
  }
}

export async function deleteProjectVersion(ownerId, projectId, versionId) {
  try {
    await deleteDoc(doc(db, 'users', ownerId, 'blueprint', projectId, 'versions', versionId));
    return { success: true, error: null };
  } catch (error) {
    console.error('Delete version error:', error);
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

export async function listProjects(userId, userEmail, mode = 'my-projects') {
  try {
    const projects = new Map();
    
    // Helper to process docs — extracts ownerId from doc path as fallback
    const processDocs = (snapshot) => {
      snapshot.forEach(docSnap => {
        if (!projects.has(docSnap.id)) {
          const data = docSnap.data();
          // Extract ownerId from path: users/{ownerId}/blueprint/{projectId}
          const pathOwnerId = docSnap.ref.parent.parent?.id || data.ownerId || 'unknown';
          // Build ownerContact fallback from the data or path
          const contact = data.ownerContact || pathOwnerId;
          projects.set(docSnap.id, {
            id: docSnap.id,
            ...data,
            ownerId: data.ownerId || pathOwnerId,
            ownerContact: contact
          });
        }
      });
    };

    if (mode === 'admin-view' && userEmail === 'hariprasadhp637@gmail.com') {
      // Admin: Fetch ALL projects except admin's own projects
      const adminQuery = query(collectionGroup(db, 'blueprint'));
      const adminSnapshot = await getDocs(adminQuery);
      
      const filteredDocs = [];
      adminSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const pathOwnerId = docSnap.ref.parent.parent?.id || data.ownerId;
        // Skip projects owned by the admin
        if (pathOwnerId !== userId && data.ownerId !== userId) {
          filteredDocs.push(docSnap);
        }
      });
      processDocs(filteredDocs);
    } else if (mode === 'shared-projects') {
      // Fetch ONLY shared projects (NOT owned by the current user)
      if (userEmail) {
        const sharedQuery = query(
          collectionGroup(db, 'blueprint'),
          where('sharedWith', 'array-contains', userEmail)
        );
        const sharedSnapshot = await getDocs(sharedQuery);
        processDocs(sharedSnapshot);
      }
    } else {
      // Normal User (my-projects): Fetch ONLY owned projects
      const ownedRef = collection(db, 'users', userId, 'blueprint');
      const ownedSnapshot = await getDocs(ownedRef);
      processDocs(ownedSnapshot);
    }
    
    // Sort descending by updatedAt
    const projectList = Array.from(projects.values()).sort((a, b) => {
      const timeA = a.updatedAt?.toMillis() || 0;
      const timeB = b.updatedAt?.toMillis() || 0;
      return timeB - timeA;
    });

    return { projects: projectList, error: null };
  } catch (error) {
    console.error('List error:', error);
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
