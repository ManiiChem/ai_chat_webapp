import * as React from "react"

import { api, setUnauthorizedHandler, type User } from "@/lib/api"

type AuthState = {
  user: User | null
  loading: boolean // true until the first "who am i" request came back
  login: (username: string, password: string) => Promise<void>
  signup: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    // the session cookie cant be read from js, so the server gets asked if someone is logged in
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))

    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  const value = React.useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (username, password) =>
        setUser(await api.login(username, password)),
      signup: async (username, password) =>
        setUser(await api.signup(username, password)),
      logout: async () => {
        await api.logout()
        setUser(null)
      },
    }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
