import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md space-y-3 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/home" className="text-primary underline">
        Back to Home
      </Link>
    </main>
  );
}
