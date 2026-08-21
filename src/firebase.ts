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
import {
  collection,
  doc,
  getFirestore,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';

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
const db = getFirestore(app);
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

export type RankedDifficulty = 6 | 9 | 12 | 24;
export type RankedResult = 'success' | 'fail' | 'abandoned';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  difficulty: RankedDifficulty;
  clears: number;
  plays: number;
}

function leaderboardName(user: User) {
  return (user.displayName?.trim() || 'Player').slice(0, 24);
}

export async function startRankedMatch(user: User, difficulty: RankedDifficulty) {
  const matchRef = doc(collection(db, 'rankedMatches'));
  const statsRef = doc(db, 'rankedStats', `${difficulty}_${user.uid}`);

  await runTransaction(db, async transaction => {
    const statsSnapshot = await transaction.get(statsRef);
    const previous = statsSnapshot.data();
    const plays = statsSnapshot.exists() ? Number(previous?.plays || 0) + 1 : 1;
    const clears = statsSnapshot.exists() ? Number(previous?.clears || 0) : 0;

    transaction.set(matchRef, {
      uid: user.uid,
      difficulty,
      status: 'active',
      startedAt: serverTimestamp(),
    });
    transaction.set(statsRef, {
      uid: user.uid,
      displayName: leaderboardName(user),
      difficulty,
      plays,
      clears,
      lastStartedMatchId: matchRef.id,
      lastCompletedMatchId: previous?.lastCompletedMatchId || '',
      updatedAt: serverTimestamp(),
    });
  });

  return matchRef.id;
}

export async function finishRankedMatch(user: User, matchId: string, result: RankedResult) {
  const matchRef = doc(db, 'rankedMatches', matchId);

  await runTransaction(db, async transaction => {
    const matchSnapshot = await transaction.get(matchRef);
    if (!matchSnapshot.exists()) throw new Error('ranked-match-not-found');
    const match = matchSnapshot.data();
    if (match.uid !== user.uid) throw new Error('ranked-match-owner-mismatch');
    if (match.status !== 'active') return;

    if (result === 'success') {
      const difficulty = match.difficulty as RankedDifficulty;
      const statsRef = doc(db, 'rankedStats', `${difficulty}_${user.uid}`);
      const statsSnapshot = await transaction.get(statsRef);
      if (!statsSnapshot.exists()) throw new Error('ranked-stats-not-found');
      const stats = statsSnapshot.data();
      transaction.update(statsRef, {
        displayName: leaderboardName(user),
        clears: Number(stats.clears || 0) + 1,
        lastCompletedMatchId: matchId,
        updatedAt: serverTimestamp(),
      });
    }

    transaction.update(matchRef, {
      status: result,
      finishedAt: serverTimestamp(),
    });
  });
}

export async function loadLeaderboard(difficulty: RankedDifficulty) {
  const snapshot = await getDocs(query(
    collection(db, 'rankedStats'),
    where('difficulty', '==', difficulty),
    orderBy('clears', 'desc'),
    limit(100),
  ));

  return snapshot.docs.map(entry => entry.data() as LeaderboardEntry);
}
