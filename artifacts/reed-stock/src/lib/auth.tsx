import { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextType {
  isAdmin: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  login: async () => false,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

const ADMIN_KEY = "rti_admin_mode";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === "1");

  const login = async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          setIsAdmin(true);
          sessionStorage.setItem(ADMIN_KEY, "1");
          return true;
        }
      }
    } catch {}
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem(ADMIN_KEY);
  };

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
