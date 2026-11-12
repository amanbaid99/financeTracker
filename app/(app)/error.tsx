"use client";

import { ErrorView } from "@/components/error-view";

export default function AppError(props: { error: unknown; retry: () => void }) {
  return <ErrorView {...props} />;
}
