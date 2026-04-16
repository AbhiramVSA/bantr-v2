import {
  createContext,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LoginPayload, RegisterPayload, UserProfile } from "../../types/auth";
import { getCurrentUser, login, logout, register } from "../../services/auth";
import { ApiError } from "../../types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: UserProfile | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  loginWithPassword: (payload: LoginPayload) => Promise<void>;
  registerWithPassword: (payload: RegisterPayload) => Promise<void>;
  logoutUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const userRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshUser = useCallback(async () => {
    setStatus("loading");
    try {
      const profile = await getCurrentUser();
      startTransition(() => {
        setUser(profile);
        setStatus("authenticated");
      });
    } catch (issue) {
      startTransition(() => {
        if (issue instanceof ApiError && issue.status === 401) {
          setUser(null);
          setStatus("unauthenticated");
          return;
        }

        setStatus(userRef.current ? "authenticated" : "unauthenticated");
      });
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const loginWithPassword = useCallback(
    async (payload: LoginPayload) => {
      await login(payload);
      await refreshUser();
    },
    [refreshUser],
  );

  const registerWithPassword = useCallback(
    async (payload: RegisterPayload) => {
      await register(payload);
      await refreshUser();
    },
    [refreshUser],
  );

  const logoutUser = useCallback(async () => {
    await logout();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated",
      refreshUser,
      loginWithPassword,
      registerWithPassword,
      logoutUser,
    }),
    [loginWithPassword, logoutUser, refreshUser, registerWithPassword, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
