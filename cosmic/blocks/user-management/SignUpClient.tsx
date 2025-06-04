"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/cosmic/blocks/user-management/AuthContext";
import AuthForm from "@/cosmic/blocks/user-management/AuthForm";
import { Button } from "@/cosmic/elements/Button";
import { Loader2, CheckCircle } from "lucide-react";

export default function SignUpClient({ onSubmit }: { onSubmit: any }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isSignupComplete, setIsSignupComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSignupComplete) {
    return (
      <div className="py-8">
        <div className="mx-auto max-w-md">
          <div className="bg-card p-8 shadow-sm text-center">
            <CheckCircle className="mx-auto size-16 text-green-500 mb-4" />
            <h2 className="font-display text-2xl font-normal tracking-tight mb-4">Check your email</h2>
            <p className="text-muted-foreground mb-6">We've sent you a verification link. Please check your email to complete the signup process.</p>
            <Button asChild>
              <Link href="/login">Go to login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setError("");
    const result = await onSubmit(formData);

    if (result.error) {
      setError(result.error);
      return result;
    }

    if (result.success) {
      setIsSignupComplete(true);
    }

    return result;
  };

  return (
    <div className="py-8">
      {error && <div className="mx-auto max-w-md mb-6 p-4 bg-crimson-50 border border-crimson-200 text-crimson-800 text-sm">{error}</div>}
      <AuthForm type="signup" onSubmit={handleSubmit} />
    </div>
  );
}
