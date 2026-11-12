"use client";

import { ErrorView } from "@/components/error-view";

export default function RootError(props: {
  error: unknown;
  retry: () => void;
}) {
  return <ErrorView {...props} />;
}
