import { Metadata } from "next";
import { Suspense } from "react";
import LoginClient from "@/cosmic/blocks/user-management/LoginClient";
import { login } from "@/cosmic/blocks/user-management/actions";
import { Loader2 } from "lucide-react";
import { generateBaseMetadata } from "@/lib/metadata-utils";

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: "Login - Worldwide FM",
    description: "Sign in to your Worldwide FM account to access your dashboard and preferences.",
    noIndex: true, // Don't index authentication pages
  });
};

export default function LoginPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense fallback={<Loader2 className="text-accent mx-auto w-8 h-8 animate-spin" />}>
        <LoginClient onSubmit={login} redirect="/dashboard" />
      </Suspense>
    </div>
  );
}
