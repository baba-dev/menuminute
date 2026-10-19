"use client";

import { useState } from "react";
import Link from "next/link";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { QrCode, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setIsLoading(true);
    setError(null);

    let result;
    try {
      result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });
    } catch {
      setError("Unable to connect. Please try again.");
      return;
    } finally {
      setIsLoading(false);
    }

    if (result?.error) {
      if (result.error.code === "EMAIL_NOT_VERIFIED") {
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
      setError("Invalid email or password. Please try again.");
      return;
    }

    if (result?.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
      router.push("/two-factor");
      return;
    }
    toast.success("Welcome back!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      {/* Header */}
      <div className="flex items-center justify-center pt-12 pb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-brand-600 flex h-9 w-9 items-center justify-center rounded-xl">
            <QrCode className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-stone-900">MenuMinute</span>
        </Link>
      </div>

      {/* Card */}
      <div className="flex flex-1 items-start justify-center px-4">
        <div className="w-full max-w-md">
          <div className="shadow-card rounded-2xl border border-stone-200 bg-white p-8">
            <h1 className="mb-1 text-2xl font-bold text-stone-900">Welcome back</h1>
            <p className="mb-8 text-sm text-stone-500">Sign in to your restaurant dashboard</p>

            {error && (
              <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-stone-700">
                  Email address
                </label>
                <input
                  {...register("email")}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@restaurant.com"
                  className="focus:ring-brand-500 w-full rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition-shadow focus:border-transparent focus:ring-2 focus:outline-none"
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                    Password
                  </label>
                </div>
                <input
                  {...register("password")}
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="focus:ring-brand-500 w-full rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition-shadow focus:border-transparent focus:ring-2 focus:outline-none"
                />
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="bg-brand-600 hover:bg-brand-700 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-orange-700 underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-stone-500">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
                >
                  Create one free
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
