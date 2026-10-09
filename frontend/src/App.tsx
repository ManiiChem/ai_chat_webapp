import { Navigate, Route, Routes } from "react-router-dom"
import { Loader2Icon } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { AuthPage } from "@/pages/auth"
import { ChatPage } from "@/pages/chat"

export function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage key="login" mode="login" />
          )
        }
      />
      <Route
        path="/signup"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage key="signup" mode="signup" />
          )
        }
      />
      {/* the keys above give each form its own state, so an error on one doesnt show up on the other */}
      {/* one route for both / and /c/5 so the chat page stays mounted when the url changes between them */}
      <Route
        path="/*"
        element={user ? <ChatPage /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

export default App
