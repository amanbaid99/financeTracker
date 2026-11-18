import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/data", () => ({ requireUser: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import { radarAccess, requireRadar } from "@/lib/radar/data";
import { requireUser } from "@/lib/data";
it("denies archived Radar access before querying owner data or providers", async () => {
  expect(await radarAccess()).toEqual({ enabled: false, unavailable: false });
  await expect(requireRadar()).rejects.toThrow("NOT_FOUND");
  expect(requireUser).not.toHaveBeenCalled();
});
