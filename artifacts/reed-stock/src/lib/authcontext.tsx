import { createContext, useContext, useState, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CurrentUser {
  username: string;
  nama: string;
  role: string;
}

interface AuthContextType {
  isAdmin: boolean;
  currentUser: CurrentUser | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  currentUser: null,
  login: async () => ({ ok: false }),
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// ─── Storage keys ─────────────────────────────────────────────────────────────
const ADMIN_KEY = "rti_admin_mode";
const USER_KEY  = "rti_current_user";

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === "1");

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const stored = sessionStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = async (
    username: string,
    password: string
  ): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();

      if (res.ok && json.ok) {
        const user: CurrentUser = json.user;
        setIsAdmin(true);
        setCurrentUser(user);
        sessionStorage.setItem(ADMIN_KEY, "1");
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        return { ok: true };
      }

      return { ok: false, message: json.message || "Login gagal" };
    } catch {
      return { ok: false, message: "Tidak dapat terhubung ke server" };
    }
  };

  const logout = () => {
    setIsAdmin(false);
    setCurrentUser(null);
    sessionStorage.removeItem(ADMIN_KEY);
    sessionStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider value={{ isAdmin, currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}