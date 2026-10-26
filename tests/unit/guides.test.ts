import { describe, expect, it } from "vitest";
import { LATEST_RELEASE, pendingReleases, RELEASES } from "@/lib/guides";

describe("what's new", () => {
  it("shows releases launched after joining that haven't been read", () => {
    expect(
      pendingReleases(null, "2026-10-20T10:00:00Z").map((r) => r.date),
    ).toEqual(RELEASES.filter((r) => r.date > "2026-10-20").map((r) => r.date));
  });
  it("shows nothing to someone who joined after the latest launch", () => {
    expect(pendingReleases(null, `${LATEST_RELEASE}T09:00:00Z`)).toEqual([]);
  });
  it("shows nothing once the latest has been read", () => {
    expect(pendingReleases(LATEST_RELEASE, "2026-01-01T00:00:00Z")).toEqual([]);
  });
  it("only shows releases newer than the last one read", () => {
    const older = RELEASES[RELEASES.length - 1].date;
    expect(
      pendingReleases(older, "2026-01-01T00:00:00Z").every(
        (r) => r.date > older,
      ),
    ).toBe(true);
  });
});
