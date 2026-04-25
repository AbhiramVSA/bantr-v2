import { describe, expect, it } from "vitest";
import { formatDate, titleCase } from "../../src/utils/format";

describe("formatDate", () => {
  it("returns a stable empty-state label for missing dates", () => {
    expect(formatDate(null)).toBe("Not available");
  });

  it("formats valid ISO dates for display", () => {
    expect(formatDate("2026-04-25T09:00:00.000Z")).toContain("2026");
  });
});

describe("titleCase", () => {
  it("converts underscore status values into display labels", () => {
    expect(titleCase("not_started")).toBe("Not Started");
  });
});
