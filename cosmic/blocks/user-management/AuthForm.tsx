"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/cosmic/blocks/user-management/AuthContext";
import { Button } from "@/cosmic/elements/Button";
import { Input } from "@/cosmic/elements/Input";
import { Label } from "@/cosmic/elements/Label";
import { Loader2 } from "lucide-react";

interface AuthFormProps {
  type: "login" | "signup";
  onSubmit?: (data: FormData) => Promise<any>;
}

export default function AuthForm({ type, onSubmit }: AuthFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { login: authLogin } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);

      if (onSubmit) {
        const result = await onSubmit(formData);

        if (result.error) {
          setError(result.error);
          return;
        }

        if (type === "login" && result.user) {
          authLogin(result.user);
          router.push("/dashboard");
          router.refresh();
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="bg-card p-8 shadow-sm">
        <h1 className="font-display uppercase text-3xl font-normal tracking-tight text-center mb-8">{type === "login" ? "Login" : "Sign Up"}</h1>

        {error && <div className="mb-6 p-4 bg-crimson-50 border border-crimson-200 text-crimson-800 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {type === "signup" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input type="text" id="firstName" name="firstName" required placeholder="First name" autoFocus={type === "signup"} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input type="text" id="lastName" name="lastName" required placeholder="Last name" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input type="email" id="email" name="email" required placeholder="Enter your email" autoFocus={type === "login"} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input type="password" id="password" name="password" required minLength={8} placeholder="Enter your password" />
            {type === "signup" ? (
              <p className="text-xs text-muted-foreground">Password must be at least 8 characters long and contain both letters and numbers</p>
            ) : (
              <div className="text-right">
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot your password?
                </Link>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : type === "login" ? "Login" : "Sign Up"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {type === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
