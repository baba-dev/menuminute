"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { QrCode, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterForm) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      if (result.error) {
        setError(result.error.message ?? "Registration failed");
        return;
      }
      toast.success("Account created! Set up your first outlet.");
      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <div className="flex items-center justify-center pt-12 pb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-brand-600 flex h-9 w-9 items-center justify-center rounded-xl">
            <QrCode className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-stone-900">MenuMinute</span>
        </Link>
      </div>

      <div className="flex flex-1 items-start justify-center px-4">
        <div className="w-full max-w-md">
          <div className="shadow-card rounded-2xl border border-stone-200 bg-white p-8">
            <h1 className="mb-1 text-2xl font-bold text-stone-900">Create your account</h1>
            <p className="mb-8 text-sm text-stone-500">Free forever — no credit card required</p>

            {error && (
              <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-stone-700">
                  Your name
                </label>
                <input
                  {...register("name")}
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Restaurant Owner"
                  className="focus:ring-brand-500 w-full rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition-shadow focus:border-transparent focus:ring-2 focus:outline-none"
                />
                {errors.name && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.name.message}</p>
                )}
              </div>

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
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-stone-700"
                >
                  Password
                </label>
                <input
                  {...register("password")}
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="focus:ring-brand-500 w-full rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition-shadow focus:border-transparent focus:ring-2 focus:outline-none"
                />
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-medium text-stone-700"
                >
                  Confirm password
                </label>
                <input
                  {...register("confirmPassword")}
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="focus:ring-brand-500 w-full rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition-shadow focus:border-transparent focus:ring-2 focus:outline-none"
                />
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.confirmPassword.message}</p>
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
                    Creating account...
                  </>
                ) : (
                  "Create free account"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-stone-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
