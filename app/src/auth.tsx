import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "@firebase/auth";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { COLLECTIONS, type UserProfile, type UserRole } from "@diabetes/shared";

interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOutUser: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    return onSnapshot(doc(db, COLLECTIONS.users, user.uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
    });
  }, [user?.uid]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const cred = await createUserWithEmailAndPassword(
      auth,
      input.email.trim(),
      input.password
    );
    const profile: UserProfile = {
      uid: cred.user.uid,
      role: input.role,
      displayName: input.displayName.trim(),
      onboardingComplete: false,
      createdAt: Date.now(),
    };
    await setDoc(doc(db, COLLECTIONS.users, cred.user.uid), profile);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!auth.currentUser) throw new Error("Not signed in");
    await updateDoc(doc(db, COLLECTIONS.users, auth.currentUser.uid), {
      onboardingComplete: true,
    });
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, signIn, signUp, signOutUser, completeOnboarding }),
    [user, profile, loading, signIn, signUp, signOutUser, completeOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
