import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteShell } from "@/components/SiteShell";

// Mock useProgress
vi.mock("@/lib/use-progress", () => ({
  useProgress: () => ({
    progress: {},
    isLoaded: true,
    completeChapter: vi.fn(),
    markVisited: vi.fn(),
    reset: vi.fn(),
  }),
}));

// Mock Sidebar to avoid deep dependency chain
vi.mock("@/components/Sidebar", () => ({
  Sidebar: ({ progress, isLoaded }: { progress: unknown; isLoaded: boolean }) => (
    <div data-testid="sidebar-mock">
      Sidebar: {isLoaded ? "loaded" : "loading"}, {JSON.stringify(progress)}
    </div>
  ),
}));

describe("SiteShell", () => {
  it("renders children inside the shell", () => {
    render(
      <SiteShell>
        <div data-testid="child">Hello from chapter</div>
      </SiteShell>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByText("Hello from chapter")).toBeDefined();
  });

  it("renders the sidebar", () => {
    render(
      <SiteShell>
        <div>content</div>
      </SiteShell>,
    );
    expect(screen.getByTestId("sidebar-mock")).toBeDefined();
  });

  it("has a flex layout with sidebar and content area", () => {
    const { container } = render(
      <SiteShell>
        <div>content</div>
      </SiteShell>,
    );
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("flex");
    expect(shell.className).toContain("h-screen");
  });
});
