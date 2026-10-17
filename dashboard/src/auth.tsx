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
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { COLLECTIONS, type Clinic, type UserProfile } from "@diabetes/shared";

export interface RegisterClinicInput {
  email: string;
  password: string;
  displayName: string;
  clinicName: string;
  address?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  registerClinic: (input: RegisterClinicInput) => Promise<void>;
  signOutUser: () => Promise<void>;
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

  // Clinic registration via the dashboard collects everything up front, so
  // onboarding is complete immediately.
  const registerClinic = useCallback(async (input: RegisterClinicInput) => {
    const cred = await createUserWithEmailAndPassword(
      auth,
      input.email.trim(),
      input.password
    );
    const profile: UserProfile = {
      uid: cred.user.uid,
      role: "clinic",
      displayName: input.displayName.trim(),
      onboardingComplete: true,
      createdAt: Date.now(),
    };
    const clinic: Clinic = {
      clinicId: cred.user.uid,
      clinicName: input.clinicName.trim(),
      createdAt: Date.now(),
    };
    if (input.address?.trim()) clinic.address = input.address.trim();
    if (input.phone?.trim()) clinic.phone = input.phone.trim();
    await setDoc(doc(db, COLLECTIONS.users, cred.user.uid), profile);
    await setDoc(doc(db, COLLECTIONS.clinics, cred.user.uid), clinic);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, signIn, registerClinic, signOutUser }),
    [user, profile, loading, signIn, registerClinic, signOutUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
