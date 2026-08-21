import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCVG2kwKMQAwkwmTBz7697Lb3ac3Td_27Y',
  authDomain: 'the-odd-one-ad498.firebaseapp.com',
  projectId: 'the-odd-one-ad498',
  storageBucket: 'the-odd-one-ad498.firebasestorage.app',
  messagingSenderId: '1066031778604',
  appId: '1:1066031778604:web:76ab74cfa8205373c43a89',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function prepareAuth() {
  await setPersistence(auth, browserLocalPersistence);
}

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  return (await signInWithPopup(auth, googleProvider)).user;
}

export async function signOutUser() {
  await signOut(auth);
}
