"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { cosmic } from "@/cosmic/client";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { getRadioShows } from "@/lib/cosmic-service";

import { getCanonicalGenres } from "@/lib/get-canonical-genres";

const resend = new Resend(process.env.RESEND_API_KEY);

function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export async function signUp(formData: FormData) {
  try {
    const email = (formData.get("email") as string).toLowerCase();
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;

    // Add password validation
    if (!isValidPassword(password)) {
      return {
        success: false,
        error: "Password must be at least 8 characters long and contain both letters and numbers",
      };
    }

    // Check if user already exists
    let existingUser;
    try {
      existingUser = await cosmic.objects
        .findOne({
          type: "users",
          "metadata.email": email,
        })
        .props(["metadata"])
        .depth(0);
    } catch (err) {
      // User does not exist
    }

    if (existingUser) {
      return {
        success: false,
        error: "An account with this email already exists",
      };
    }

    // Generate verification code
    const verificationCode = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    await cosmic.objects.insertOne({
      title: `${firstName} ${lastName}`,
      type: "users",
      metadata: {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: hashedPassword,
        active_status: true,
        email_verified: false,
        verification_code: verificationCode,
        verification_expiry: verificationExpiry,
      },
    });

    // Send verification email
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?code=${verificationCode}`;

    try {
      const result = await resend.emails.send({
        from: `${process.env.NEXT_PUBLIC_APP_NAME} Support <${process.env.SUPPORT_EMAIL}>`,
        to: email,
        subject: "Verify your email address",
        html: `
          <h1>Welcome to ${process.env.NEXT_PUBLIC_APP_NAME}!</h1>
          <p>Please click the link below to verify your email address:</p>
          <a href="${verificationUrl}">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
        `,
      });
      console.log(`Verification email sent to ${email}`);
      console.log("Resend response:", result);
    } catch (error) {
      console.error("Error sending verification email:", error);
      console.error("Full error details:", JSON.stringify(error, null, 2));
      return {
        success: false,
        error: "Failed to send verification email. Please try again.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Signup error:", error);
    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }
}

export async function login(formData: FormData) {
  const email = (formData.get("email") as string).toLowerCase();
  const password = formData.get("password") as string;

  try {
    const result = await cosmic.objects
      .findOne({
        type: "users",
        "metadata.email": email,
        "metadata.email_verified": true,
        "metadata.active_status": true,
      })
      .props(["id", "title", "metadata"])
      .depth(0);

    if (!result.object) {
      return { error: "Invalid email or password" };
    }

    const isValid = await bcrypt.compare(password, result.object.metadata.password);

    if (!isValid) {
      return { error: "Invalid email or password" };
    }

    const user = {
      id: result.object.id,
      name: result.object.title,
      email: result.object.metadata.email,
      image: result.object.metadata.avatar?.imgix_url,
    };

    // Set the user_id cookie
    (await cookies()).set("user_id", result.object.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return { user };
  } catch (error) {
    console.error("Login error:", error);
    return { error: "Invalid email or password" };
  }
}

export async function getUserData(userId: string) {
  try {
    const { object } = await cosmic.objects
      .findOne({
        id: userId,
        type: "users",
      })
      .props("id,title,metadata")
      .depth(1);

    if (!object) {
      return { data: null, error: "User not found" };
    }

    // Check active status after finding the user
    if (!object.metadata.active_status) {
      return { data: null, error: "Account is not active" };
    }

    return { data: object, error: null };
  } catch (error) {
    console.error("Error fetching user data:", error);
    return { data: null, error: "Failed to fetch user data" };
  }
}

export async function getUserFromCookie() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id");
  if (!userId) {
    return null;
  }

  try {
    const result = await cosmic.objects
      .findOne({
        type: "users",
        id: userId.value,
        "metadata.active_status": true,
      })
      .props(["id", "metadata.name", "metadata.email", "metadata.image"])
      .depth(0);

    if (!result?.object) {
      return null;
    }

    return {
      id: result.object.id,
      name: result.object.metadata.name,
      email: result.object.metadata.email,
      image: result.object.metadata.image,
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

async function uploadFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const media = { originalname: file.name, buffer };
  return await cosmic.media.insertOne({
    media,
  });
}

export async function updateUserProfile(userId: string, formData: FormData) {
  try {
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const email = (formData.get("email") as string).toLowerCase();
    const avatar = formData.get("avatar") as File;

    // Get current user data to check if email has changed
    const { object: currentUser } = await cosmic.objects.findOne({ id: userId }).props(["metadata"]).depth(0);

    const metadata: any = {
      first_name: firstName,
      last_name: lastName,
      email: email,
    };

    // If email has changed, generate new verification
    if (email !== currentUser.metadata.email) {
      // Check if new email already exists
      const existingUser = await cosmic.objects
        .findOne({
          type: "users",
          "metadata.email": email,
        })
        .props(["id"])
        .depth(0);

      if (existingUser.object) {
        return {
          success: false,
          error: "An account with this email already exists",
        };
      }

      const verificationCode = crypto.randomBytes(32).toString("hex");
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      metadata.email_verified = false;
      metadata.verification_code = verificationCode;
      metadata.verification_expiry = verificationExpiry;

      // Send new verification email
      const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?code=${verificationCode}`;
      try {
        const result = await resend.emails.send({
          from: `${process.env.NEXT_PUBLIC_APP_NAME} Support <${process.env.SUPPORT_EMAIL}>`,
          to: email,
          subject: "Verify your new email address",
          html: `
            <h1>Verify Your New Email Address</h1>
            <p>Please click the link below to verify your new email address:</p>
            <a href="${verificationUrl}">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
          `,
        });
        console.log(`Email change verification sent to ${email}`);
        console.log("Resend response:", result);
      } catch (error) {
        console.error("Error sending email change verification:", error);
        console.error("Full error details:", JSON.stringify(error, null, 2));
        return {
          success: false,
          error: "Failed to send verification email. Please try again.",
        };
      }
    }

    const updates: {
      title: string;
      metadata: any;
      thumbnail?: string;
    } = {
      title: `${firstName} ${lastName}`,
      metadata,
    };

    // Handle avatar upload if provided
    if (avatar && avatar.size > 0) {
      const { media } = await uploadFile(avatar);
      metadata.avatar = media.name;
      updates.thumbnail = media.name;
    }

    const { object } = await cosmic.objects.updateOne(userId, updates);

    return { success: true, data: object };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

// Add new verification function
export async function verifyEmail(code: string) {
  try {
    const { object } = await cosmic.objects
      .findOne({
        type: "users",
        "metadata.verification_code": code,
      })
      .props(["id", "metadata"])
      .depth(0);

    if (!object) {
      throw new Error("Invalid verification code");
    }

    const verificationExpiry = new Date(object.metadata.verification_expiry);
    if (verificationExpiry < new Date()) {
      throw new Error("Verification code has expired");
    }

    await cosmic.objects.updateOne(object.id, {
      metadata: {
        email_verified: true,
        verification_code: "",
        verification_expiry: "",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error verifying email:", error);
    throw new Error("Email verification failed");
  }
}

export async function forgotPassword(formData: FormData) {
  try {
    const email = (formData.get("email") as string).toLowerCase();

    // Check if user exists
    const existingUser = await cosmic.objects
      .findOne({
        type: "users",
        "metadata.email": email,
      })
      .props(["id", "metadata"])
      .depth(0);

    if (!existingUser.object) {
      return {
        success: false,
        error: "No account found with this email address",
      };
    }

    // Generate reset token and expiry
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await cosmic.objects.updateOne(existingUser.object.id, {
      metadata: {
        reset_password_token: resetToken,
        reset_password_expiry: resetExpiry,
      },
    });

    // Send reset email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

    try {
      const result = await resend.emails.send({
        from: `${process.env.NEXT_PUBLIC_APP_NAME} Support <${process.env.SUPPORT_EMAIL}>`,
        to: email,
        subject: "Reset your password",
        html: `
          <h1>Reset Your Password</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
        `,
      });
      console.log(`Password reset email sent to ${email}`);
      console.log("Resend response:", result);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      console.error("Full error details:", JSON.stringify(error, null, 2));
      return {
        success: false,
        error: "Failed to send password reset email. Please try again.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Forgot password error:", error);
    return {
      success: false,
      error: "Failed to process request. Please try again.",
    };
  }
}

export async function resetPassword(token: string, formData: FormData) {
  try {
    const password = formData.get("password") as string;

    // Add password validation
    if (!isValidPassword(password)) {
      return {
        success: false,
        error: "Password must be at least 8 characters long and contain both letters and numbers",
      };
    }

    // Find user with reset token
    const existingUser = await cosmic.objects
      .findOne({
        type: "users",
        "metadata.reset_password_token": token,
      })
      .props(["id", "metadata"])
      .depth(0);

    if (!existingUser.object) {
      return {
        success: false,
        error: "Invalid or expired reset token",
      };
    }

    const resetExpiry = new Date(existingUser.object.metadata.reset_password_expiry);
    if (resetExpiry < new Date()) {
      return {
        success: false,
        error: "Reset token has expired",
      };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password and clear reset token
    await cosmic.objects.updateOne(existingUser.object.id, {
      metadata: {
        password: hashedPassword,
        reset_password_token: "",
        reset_password_expiry: "",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Reset password error:", error);
    return {
      success: false,
      error: "Failed to reset password. Please try again.",
    };
  }
}

export async function getAuthUser() {
  "use server";
  return await getUserFromCookie();
}

export async function logoutUser() {
  "use server";
  (await cookies()).delete("user_id");
  return { success: true };
}

// --- FAVOURITES MANAGEMENT ---
import type { GenreObject } from "@/lib/cosmic-config";
import type { RadioShowObject } from "@/lib/cosmic-config";
import type { HostObject } from "@/lib/cosmic-config";

// Generic helper for managing favorites
async function manageFavourites<T extends { id: string }>(userId: string, item: T, field: "favourite_genres" | "favourite_shows" | "favourite_hosts", action: "add" | "remove") {
  try {
    // Validate inputs
    if (!userId || !item?.id) {
      throw new Error("Invalid user ID or item ID");
    }

    const { object: user } = await cosmic.objects.findOne({ id: userId }).props(["metadata"]).depth(0);
    if (!user) throw new Error("User not found");

    const current = user.metadata[field] || [];
    let updated: string[];

    if (action === "add") {
      const exists = current.some((existingId: string) => existingId === item.id);
      if (exists) return { success: true, data: user };
      updated = [...current, item.id];
    } else {
      updated = current.filter((existingId: string) => existingId !== item.id);
    }

    // Only update the specific field with Object IDs (not full objects)
    const { object: updatedUser } = await cosmic.objects.updateOne(userId, {
      metadata: {
        [field]: updated,
      },
    });

    return { success: true, data: updatedUser };
  } catch (error) {
    console.error(`Error managing ${field}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function addFavouriteGenre(userId: string, genre: GenreObject) {
  return manageFavourites(userId, genre, "favourite_genres", "add");
}

export async function removeFavouriteGenre(userId: string, genreId: string) {
  return manageFavourites(userId, { id: genreId } as GenreObject, "favourite_genres", "remove");
}

export async function addFavouriteShow(userId: string, show: RadioShowObject) {
  return manageFavourites(userId, show, "favourite_shows", "add");
}

export async function removeFavouriteShow(userId: string, showId: string) {
  return manageFavourites(userId, { id: showId } as RadioShowObject, "favourite_shows", "remove");
}

// For hosts, use the same pattern. Type is any for now, but should be HostObject if defined.
export async function addFavouriteHost(userId: string, host: HostObject) {
  return manageFavourites(userId, host, "favourite_hosts", "add");
}

export async function removeFavouriteHost(userId: string, hostId: string) {
  return manageFavourites(userId, { id: hostId } as HostObject, "favourite_hosts", "remove");
}

export async function getDashboardData(userId: string) {
  try {
    // Fetch user data first
    const { data: userData, error: userError } = await getUserData(userId);
    if (userError || !userData) {
      return { data: null, error: userError || "User not found" };
    }

    // Fetch all required collections in parallel with error handling
    let genresRes, hostsRes, showsRes, episodesRes, mixcloudRes;

    try {
      [genresRes, hostsRes, showsRes] = await Promise.all([cosmic.objects.find({ type: "genres", props: "id,slug,title,type,metadata", depth: 1, limit: 1000 }), cosmic.objects.find({ type: "regular-hosts", props: "id,slug,title,type,metadata", depth: 1, limit: 1000 }), cosmic.objects.find({ type: "radio-shows", props: "id,slug,title,type,metadata", depth: 1, limit: 1000, status: "published" })]);
    } catch (error) {
      console.error("Error fetching basic collections:", error);
      throw error;
    }

    // Fetch canonical genres for genre matching
    let canonicalGenres: { slug: string; title: string }[] = [];
    try {
      canonicalGenres = await getCanonicalGenres();
    } catch (error) {
      console.error("Error fetching canonical genres:", error);
    }

    // Try to fetch episodes and mixcloud data separately with fallbacks
    try {
      episodesRes = await cosmic.objects.find({ type: "episode", props: "id,slug,title,type,metadata", depth: 1, limit: 1000, status: "published" });
    } catch (error) {
      console.log("Episode collection not found, using empty array");
      episodesRes = { objects: [] };
    }

    const allGenres = genresRes.objects || [];
    const allHosts = hostsRes.objects || [];
    const rawShows = showsRes.objects || [];
    const allEpisodes = episodesRes.objects || [];

    // Transform allShows to have complete MixcloudShow structure
    const allShows = rawShows.map((show: any) => ({
      ...show,
      key: show.slug,
      name: show.title,
      url: `/episode/${show.slug}`,
      slug: show.slug,
      pictures: {
        small: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        thumbnail: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        medium_mobile: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        medium: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        large: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        "320wx320h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        extra_large: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        "640wx640h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        "768wx768h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        "1024wx1024h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
      },
      created_time: show.metadata?.broadcast_date || show.created_at,
      updated_time: show.modified_at || show.created_at,
      play_count: 0,
      favorite_count: 0,
      comment_count: 0,
      listener_count: 0,
      repost_count: 0,
      tags: (show.metadata?.genres || []).map((genre: any) => ({
        key: genre.slug || genre.id,
        url: `/genre/${genre.slug}`,
        name: genre.title || genre.id,
      })),
      user: {
        key: show.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm",
        url: `/hosts/${show.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm"}`,
        name: show.metadata?.regular_hosts?.[0]?.title || "Worldwide FM",
        username: show.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm",
        pictures: {
          small: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
          thumbnail: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
          medium_mobile: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
          medium: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
          large: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
          "320wx320h": show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
          extra_large: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
          "640wx640h": show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
        },
      },
    }));

    // Helper function to get latest shows by genre (same as in DashboardClient)
    async function getShowsByGenre(genreId: string, limit = 4): Promise<any[]> {
      try {
        const cosmicResponse = await getRadioShows({
          filters: { genre: genreId },
          limit,
          sort: "-metadata.broadcast_date",
        });

        if (cosmicResponse.objects && cosmicResponse.objects.length > 0) {
          const genreMap = new Map(allGenres.map((g: any) => [g.id, g.title]));

          return cosmicResponse.objects.map((show: any) => ({
            ...show,
            key: show.slug,
            name: show.title,
            url: `/episode/${show.slug}`,
            slug: show.slug,
            pictures: {
              small: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              thumbnail: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              medium_mobile: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              medium: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              large: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "320wx320h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              extra_large: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "640wx640h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "768wx768h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "1024wx1024h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            },
            created_time: show.metadata?.broadcast_date || show.created_at,
            updated_time: show.modified_at || show.created_at,
            play_count: 0,
            favorite_count: 0,
            comment_count: 0,
            listener_count: 0,
            repost_count: 0,
            tags: (show.metadata?.genres || []).map((genre: any) => ({
              key: genre.slug || genre.id,
              url: `/genre/${genre.slug}`,
              name: String(genre.title || genreMap.get(genre.id) || genre.id),
            })),
            user: {
              key: show.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm",
              url: `/hosts/${show.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm"}`,
              name: show.metadata?.regular_hosts?.[0]?.title || "Worldwide FM",
              username: show.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm",
              pictures: {
                small: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                thumbnail: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                medium_mobile: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                medium: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                large: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                "320wx320h": show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                extra_large: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                "640wx640h": show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
              },
            },
          }));
        }

        return [];
      } catch (error: any) {
        // 404 means no shows found for this genre, which is normal
        if (error?.status === 404) {
          return [];
        }
        console.error("Error fetching shows by genre:", error);
        return [];
      }
    }

    // Helper function to get latest shows by host (same as in DashboardClient)
    async function getShowsByHost(hostId: string, limit = 4): Promise<any[]> {
      try {
        const cosmicResponse = await getRadioShows({
          filters: { host: hostId },
          limit,
          sort: "-metadata.broadcast_date",
        });

        if (cosmicResponse.objects && cosmicResponse.objects.length > 0) {
          const genreMap = new Map(allGenres.map((g: any) => [g.id, g.title]));

          return cosmicResponse.objects.map((show: any) => ({
            ...show,
            key: show.slug,
            name: show.title,
            url: `/episode/${show.slug}`,
            slug: show.slug,
            pictures: {
              small: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              thumbnail: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              medium_mobile: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              medium: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              large: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "320wx320h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              extra_large: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "640wx640h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "768wx768h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "1024wx1024h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            },
            created_time: show.metadata?.broadcast_date || show.created_at,
            updated_time: show.modified_at || show.created_at,
            play_count: 0,
            favorite_count: 0,
            comment_count: 0,
            listener_count: 0,
            repost_count: 0,
            tags: (show.metadata?.genres || []).map((genre: any) => ({
              key: genre.slug || genre.id,
              url: `/genre/${genre.slug}`,
              name: String(genre.title || genreMap.get(genre.id) || genre.id),
            })),
            user: {
              key: show.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm",
              url: `/hosts/${show.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm"}`,
              name: show.metadata?.regular_hosts?.[0]?.title || "Worldwide FM",
              username: show.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm",
              pictures: {
                small: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                thumbnail: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                medium_mobile: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                medium: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                large: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                "320wx320h": show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                extra_large: show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
                "640wx640h": show.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
              },
            },
          }));
        }

        return [];
      } catch (error: any) {
        // 404 means no shows found for this host, which is normal
        if (error?.status === 404) {
          return [];
        }
        console.error("Error fetching shows by host:", error);
        return [];
      }
    }

    // Fetch shows for favorite genres and hosts
    const genreShows: { [key: string]: any[] } = {};
    const hostShows: { [key: string]: any[] } = {};

    if (userData.metadata?.favourite_genres) {
      for (const genre of userData.metadata.favourite_genres) {
        const shows = await getShowsByGenre(genre.id, 4);
        if (shows.length > 0) {
          genreShows[genre.id] = shows;
        }
      }
    }

    if (userData.metadata?.favourite_hosts) {
      for (const host of userData.metadata.favourite_hosts) {
        const shows = await getShowsByHost(host.id, 4);
        if (shows.length > 0) {
          hostShows[host.id] = shows;
        }
      }
    }

    // Process favourite shows to have proper structure for ShowCard
    const favouriteShows = await Promise.all(
      (userData.metadata?.favourite_shows || []).map(async (show: any) => {
        const genreMap = new Map(allGenres.map((g: any) => [g.id, g.title]));

        // If the show doesn't have full genre objects, fetch the complete show data
        let fullShow = show;
        if (!show.metadata?.genres || show.metadata.genres.length === 0 || typeof show.metadata.genres[0] === "string") {
          try {
            const { object: fetchedShow } = await cosmic.objects
              .findOne({
                id: show.id,
                type: "radio-shows",
              })
              .props("id,slug,title,metadata")
              .depth(1);

            if (fetchedShow) {
              fullShow = fetchedShow;
            }
          } catch (error) {
            console.error("Error fetching full show data:", error);
          }
        }

        const processedShow = {
          ...fullShow,
          key: fullShow.slug,
          name: fullShow.title,
          url: `/episode/${fullShow.slug}`,
          pictures: {
            small: fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
            thumbnail: fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
            medium_mobile: fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
            medium: fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
            large: fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
            "320wx320h": fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
            extra_large: fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
            "640wx640h": fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
            "768wx768h": fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
            "1024wx1024h": fullShow.metadata?.image?.imgix_url || "/image-placeholder.svg",
          },
          created_time: fullShow.metadata?.broadcast_date || fullShow.created_at,
          updated_time: fullShow.modified_at || fullShow.created_at,
          play_count: 0,
          favorite_count: 0,
          comment_count: 0,
          listener_count: 0,
          repost_count: 0,
          tags: (fullShow.metadata?.genres || []).map((genre: any) => ({
            key: genre.slug || genre.id,
            url: `/genre/${genre.slug}`,
            name: String(genre.title || genre.name || genreMap.get(genre.id) || genre.id),
          })),
          user: {
            key: fullShow.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm",
            url: `/hosts/${fullShow.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm"}`,
            name: fullShow.metadata?.regular_hosts?.[0]?.title || "Worldwide FM",
            username: fullShow.metadata?.regular_hosts?.[0]?.slug || "worldwide-fm",
            pictures: {
              small: fullShow.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
              thumbnail: fullShow.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
              medium_mobile: fullShow.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
              medium: fullShow.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
              large: fullShow.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "320wx320h": fullShow.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
              extra_large: fullShow.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
              "640wx640h": fullShow.metadata?.regular_hosts?.[0]?.metadata?.image?.imgix_url || "/image-placeholder.svg",
            },
          },
        };

        return processedShow;
      })
    );

    // Use favourite arrays directly from userData.metadata (already full objects)
    const favouriteGenres = userData.metadata?.favourite_genres || [];
    const favouriteHosts = userData.metadata?.favourite_hosts || [];

    return {
      data: {
        userData,
        allGenres,
        allHosts,
        allShows,
        allEpisodes,
        canonicalGenres,
        genreShows,
        hostShows,
        favouriteGenres,
        favouriteHosts,
        favouriteShows,
      },
      error: null,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return { data: null, error: `Failed to fetch dashboard data: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}
