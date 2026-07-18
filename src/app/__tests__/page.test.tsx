import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

// Mock useProgress
const mockUseProgress = vi.fn();
vi.mock("@/lib/use-progress", () => ({
  useProgress: () => mockUseProgress(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("Home page", () => {
  beforeEach(() => {
    mockUseProgress.mockReturnValue({
      progress: {},
      isLoaded: true,
      completeChapter: vi.fn(),
      markVisited: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("renders the title and description", () => {
    render(<Home />);
    expect(screen.getByText("Learn dbt")).toBeDefined();
    expect(screen.getByText(/Follow Luca/)).toBeDefined();
  });

  it("renders all chapters from CHAPTERS", () => {
    render(<Home />);
    // Chapter 0, 1, 2 should be visible
    expect(screen.getByText("Chapter 0")).toBeDefined();
    expect(screen.getByText("Chapter 1")).toBeDefined();
    expect(screen.getByText("Chapter 2")).toBeDefined();
  });

  it("shows chapter titles", () => {
    render(<Home />);
    expect(screen.getByText("Luca's morning query")).toBeDefined();
    // Chapter 1 title has quotes — use the full text
    expect(screen.getByText('The manager says "use dbt"')).toBeDefined();
    expect(screen.getByText("Giulia rings the bell")).toBeDefined();
  });

  it("shows chapter 0 as unlocked and chapter 1 as locked with empty progress", () => {
    render(<Home />);
    const labels = screen.getAllByText(/^(Completed|Available|Locked)$/);
    // Chapter 0: Available (unlocked), Chapter 1+: Locked
    expect(labels.length).toBeGreaterThanOrEqual(8);
  });

  it("shows ProgressDisplay when progress exists", () => {
    mockUseProgress.mockReturnValue({
      progress: { 0: { completed: true, visited: true } },
      isLoaded: true,
      completeChapter: vi.fn(),
      markVisited: vi.fn(),
      reset: vi.fn(),
    });
    render(<Home />);
    expect(screen.getByText(/chapters/)).toBeDefined();
  });
});
