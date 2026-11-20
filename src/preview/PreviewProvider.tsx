import type { ReactNode } from "react";
import { AuthContext } from "../auth/context";
import type { PreviewAccount } from "./paths";
import { previewUsers } from "./user";

export default function PreviewProvider({ account, children }: { account: PreviewAccount; children: ReactNode }) {
  return (
    <AuthContext.Provider value={{
      status: "authenticated",
      user: previewUsers[account],
      error: null,
      login: async () => false,
      checkSession: async () => {},
      logout: async () => { window.location.replace("/auth/login"); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}
