import * as React from "react"
import { Link } from "react-router-dom"
import { Loader2Icon, MessageCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"

// login and signup r the same form, only the texts and the request differ
export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { login, signup } = useAuth()
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const isLogin = mode === "login"

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    try {
      // on success the user gets set and App sends them to the chat on its own
      if (isLogin) await login(username, password)
      else await signup(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <div className="flex items-center gap-2 font-medium">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <MessageCircleIcon className="size-4" />
        </div>
        AI Chat
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {isLogin ? "Log into your account" : "Create an account"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Enter your username and password to continue"
              : "Pick a username and a password to get started"}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>

          <CardFooter className="mt-6 flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2Icon className="animate-spin" />}
              {isLogin ? "Login" : "Sign up"}
            </Button>

            <p className="text-sm text-muted-foreground">
              {isLogin ? "Dont have an account? " : "Already have an account? "}
              <Link
                to={isLogin ? "/signup" : "/login"}
                className="text-foreground underline underline-offset-4"
              >
                {isLogin ? "Sign up" : "Login"}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
