"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/cosmic/elements/Button";
import { Input } from "@/cosmic/elements/Input";
import { Label } from "@/cosmic/elements/Label";
import { Loader2, Mail } from "lucide-react";

interface ForgotPasswordFormProps {
  onSubmit: (formData: FormData) => Promise<any>;
}

export default function ForgotPasswordForm({ onSubmit }: ForgotPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      const result = await onSubmit(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="py-8">
        <div className="mx-auto max-w-md">
          <div className="bg-card p-8 shadow-xs text-center">
            <Mail className="mx-auto size-16 text-sky-500 mb-4" />
            <h2 className="font-display uppercase text-2xl font-normal tracking-tight mb-4">Check Your Email</h2>
            <p className="text-muted-foreground mb-6">If an account exists with that email address, we've sent instructions to reset your password.</p>
            <Button asChild>
              <Link href="/login">Return to login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mx-auto max-w-md">
        <div className="bg-card p-8 shadow-xs">
          <h1 className="font-display uppercase text-3xl font-normal tracking-tight text-center mb-4">Reset Password</h1>
          <p className="text-center text-muted-foreground mb-8">Enter your email address and we'll send you instructions to reset your password.</p>

          {error && <div className="mb-6 p-4 bg-crimson-50 border border-crimson-200 text-crimson-800 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input type="email" id="email" name="email" required placeholder="Enter your email address" autoFocus />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Send Reset Instructions"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline font-medium">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
