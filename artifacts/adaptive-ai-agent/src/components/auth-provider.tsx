import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseAuth, firebaseFirestore } from '@/lib/firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const persistenceReady = setPersistence(firebaseAuth, browserLocalPersistence);

function getAuthErrorMessage(error: unknown, mode: 'login' | 'signup'): string {
  if (!(error instanceof FirebaseError)) {
    return 'Something went wrong. Please try again.';
  }

  switch (error.code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'That email and password combination is not recognised.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Try signing in instead.';
    case 'auth/weak-password':
      return 'Choose a stronger password with at least 6 characters.';
    case 'auth/network-request-failed':
      return 'We could not reach Firebase. Check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment before trying again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your administrator.';
    default:
      return mode === 'signup'
        ? 'We could not create your workspace. Please try again.'
        : 'We could not sign you in. Please try again.';
  }
}

async function ensureUserDocument(user: User): Promise<void> {
  const userReference = doc(firebaseFirestore, 'users', user.uid);
  const existingUser = await getDoc(userReference);
  if (existingUser.exists()) return;

  await setDoc(userReference, {
    email: user.email ?? '',
    createdAt: serverTimestamp(),
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};
    persistenceReady
      .catch(() => undefined)
      .finally(() => {
        unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
          setUser(nextUser);
          setLoading(false);
        });
      });

    return () => unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(email, password) {
      try {
        await persistenceReady;
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      } catch (error) {
        throw new Error(getAuthErrorMessage(error, 'login'));
      }
    },
    async signup(name, email, password) {
      let accountCreated = false;
      try {
        await persistenceReady;
        const credentials = await createUserWithEmailAndPassword(
          firebaseAuth,
          email.trim(),
          password,
        );
        accountCreated = true;
        if (name.trim()) {
          await updateProfile(credentials.user, { displayName: name.trim() });
        }
        await ensureUserDocument(credentials.user);
      } catch (error) {
        if (accountCreated && firebaseAuth.currentUser) {
          await signOut(firebaseAuth).catch(() => undefined);
        }
        if (error instanceof FirebaseError) {
          throw new Error(getAuthErrorMessage(error, 'signup'));
        }
        throw new Error('Your account was created, but the workspace could not be initialized.');
      }
    },
    async logout() {
      await signOut(firebaseAuth);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}