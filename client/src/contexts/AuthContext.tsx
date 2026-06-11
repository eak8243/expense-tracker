import { createContext, useContext, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

export type AuthUser = {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin" | "viewer";
  isActive: boolean;
  openId: string | null;
  loginMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date | null;
  passwordHash: string;
};

type AuthContextType = {
  user: AuthUser | null | undefined;
  loading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: undefined,
  loading: true,
  isAuthenticated: false,
  refetch: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <AuthContext.Provider
      value={{
        user: user as AuthUser | null | undefined,
        loading: isLoading,
        isAuthenticated: !!user,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
