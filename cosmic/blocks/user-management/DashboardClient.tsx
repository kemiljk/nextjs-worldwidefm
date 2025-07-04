"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserData } from "@/cosmic/blocks/user-management/actions";
import { useAuth } from "@/cosmic/blocks/user-management/AuthContext";
import { UserProfileForm } from "@/cosmic/blocks/user-management/UserProfileForm";
import { Loader2 } from "lucide-react";

export default function DashboardClient() {
  const { user, isLoading, logout } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkUserAndFetchData = async () => {
      if (isLoading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const { data, error } = await getUserData(user.id);

        if (!isMounted) return;

        if (error) {
          if (error === "Account is not active") {
            logout();
            router.push("/login?error=Your account is no longer active");
            return;
          }
          setError(error);
        } else {
          setUserData(data);
        }
      } catch (err) {
        if (!isMounted) return;
        setError("Failed to fetch user data");
      }
    };

    checkUserAndFetchData();

    return () => {
      isMounted = false;
    };
  }, [user, isLoading, logout, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error === "Account is not active") {
    return null; // Don't show anything while redirecting
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="mx-auto max-w-md">
          <div className="bg-card p-8 shadow-xs text-center">
            <div className="text-crimson-500 mb-4">Error: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="font-display uppercase text-4xl font-normal tracking-tight text-center mb-8">Welcome, {userData.metadata.first_name}!</h1>
        <UserProfileForm user={userData} />
      </div>
    </div>
  );
}
