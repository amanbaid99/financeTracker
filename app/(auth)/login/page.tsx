import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 space-y-2 text-center">
        <Logo className="justify-center" />
        <p className="text-sm text-muted-foreground">What should your next rupee go toward?</p>
      </div>
      <Card>
        <CardContent className="pt-5 sm:pt-5">
          <LoginForm initialError={error} />
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">Invite only. Your data is private to you.</p>
    </main>
  );
}
