import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryPanel } from "@/components/StoryPanel";
import type { CharacterCard } from "@/lib/chapters";

// Mock react-markdown to avoid ESM issues in jsdom
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

vi.mock("remark-gfm", () => ({
  default: () => () => {},
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid="next-link">
      {children}
    </a>
  ),
}));

const characters: CharacterCard[] = [
  {
    name: "Luca",
    role: "Analyst, protagonist",
    description: "Makes mistakes, learns. You are helping him.",
  },
  {
    name: "The Manager",
    role: "Sets the stakes",
    description: "Asks for reliability and speed. Not technical, but impatient.",
  },
  {
    name: "Giulia",
    role: "Data engineer",
    description:
      "Keeps the dbt project healthy. Teaches Luca the rules — and the reasons.",
  },
];

const defaultProps = {
  chapterId: 1,
  chapterTitle: 'The manager says "use dbt"',
  story: "In the weekly meeting the manager complains.",
  concept: "A dbt model is a `.sql` file inside `models/`.",
  characters,
  tables: ["raw_orders", "raw_products"],
  aiPrompt: "Turn this SQL query into a dbt model.",
  completed: false,
  justCompleted: false,
  nextChapter: { id: 2, slug: "chapter-2" },
};

describe("StoryPanel", () => {
  // ── Rendering ──────────────────────────────────────────────────────

  it("renders the chapter title", () => {
    render(<StoryPanel {...defaultProps} />);
    expect(screen.getByText('Chapter 1: The manager says "use dbt"')).toBeDefined();
  });

  it("renders markdown story content", () => {
    render(<StoryPanel {...defaultProps} />);
    const markdownBlocks = screen.getAllByTestId("markdown");
    expect(markdownBlocks.length).toBeGreaterThanOrEqual(2); // story + concept
    expect(markdownBlocks[0].textContent).toContain(
      "In the weekly meeting the manager complains.",
    );
  });

  it("renders markdown concept content", () => {
    render(<StoryPanel {...defaultProps} />);
    const markdownBlocks = screen.getAllByTestId("markdown");
    expect(markdownBlocks[1].textContent).toContain(
      "A dbt model is a `.sql` file inside `models/`.",
    );
  });

  it("renders all character cards with name and role", () => {
    render(<StoryPanel {...defaultProps} />);
    expect(screen.getByText("Luca")).toBeDefined();
    expect(screen.getByText("The Manager")).toBeDefined();
    expect(screen.getByText("Giulia")).toBeDefined();
    expect(screen.getByText("Analyst, protagonist")).toBeDefined();
    expect(screen.getByText("Sets the stakes")).toBeDefined();
    expect(screen.getByText("Data engineer")).toBeDefined();
  });

  it("renders avatar placeholders with initials using testid", () => {
    render(<StoryPanel {...defaultProps} />);
    // Use data-testid to avoid text conflicts (e.g. "TM" vs "Tables" heading)
    const lucaAvatar = screen.getByTestId("avatar-Luca");
    const managerAvatar = screen.getByTestId("avatar-The-Manager");
    const giuliaAvatar = screen.getByTestId("avatar-Giulia");

    expect(lucaAvatar.textContent).toBe("L");
    expect(managerAvatar.textContent).toBe("TM");
    expect(giuliaAvatar.textContent).toBe("G");
  });

  it("renders the Cast section heading", () => {
    render(<StoryPanel {...defaultProps} />);
    expect(screen.getByText("Cast")).toBeDefined();
  });

  it("renders the Story section heading", () => {
    render(<StoryPanel {...defaultProps} />);
    expect(screen.getByText("Story")).toBeDefined();
  });

  it("renders the Concept section heading", () => {
    render(<StoryPanel {...defaultProps} />);
    expect(screen.getByText("Concept")).toBeDefined();
  });

  it("renders tables list when provided", () => {
    render(<StoryPanel {...defaultProps} />);
    expect(screen.getByText("raw_orders")).toBeDefined();
    expect(screen.getByText("raw_products")).toBeDefined();
  });

  it("renders AI prompt when provided", () => {
    render(<StoryPanel {...defaultProps} />);
    expect(
      screen.getByText("Turn this SQL query into a dbt model."),
    ).toBeDefined();
  });

  it("does not render tables section when tables is empty", () => {
    render(<StoryPanel {...defaultProps} tables={[]} />);
    expect(screen.queryByText("Tables")).toBeNull();
  });

  it("does not render AI prompt section when aiPrompt is undefined", () => {
    render(<StoryPanel {...defaultProps} aiPrompt={undefined} />);
    expect(screen.queryByText("AI prompt to try")).toBeNull();
  });

  it("does not render Cast section when characters is empty", () => {
    render(<StoryPanel {...defaultProps} characters={[]} />);
    expect(screen.queryByText("Cast")).toBeNull();
  });

  // ── Character card toggle ──────────────────────────────────────────

  it("character cards are collapsed by default (description hidden)", () => {
    render(<StoryPanel {...defaultProps} />);
    // Description text should not be visible when collapsed
    expect(
      screen.queryByText("Makes mistakes, learns. You are helping him."),
    ).toBeNull();
  });

  it("clicking a character card toggles its description", () => {
    render(<StoryPanel {...defaultProps} />);

    // Click Luca's card to expand
    const lucaButton = screen.getByText("Luca").closest("button")!;
    fireEvent.click(lucaButton);

    expect(
      screen.getByText("Makes mistakes, learns. You are helping him."),
    ).toBeDefined();

    // Click again to collapse
    fireEvent.click(lucaButton);
    expect(
      screen.queryByText("Makes mistakes, learns. You are helping him."),
    ).toBeNull();
  });

  it("each character card toggles independently", () => {
    render(<StoryPanel {...defaultProps} />);

    // Expand Luca
    fireEvent.click(screen.getByText("Luca").closest("button")!);
    expect(
      screen.getByText("Makes mistakes, learns. You are helping him."),
    ).toBeDefined();

    // Giulia should still be collapsed
    expect(
      screen.queryByText(
        "Keeps the dbt project healthy. Teaches Luca the rules — and the reasons.",
      ),
    ).toBeNull();

    // Expand Giulia
    fireEvent.click(screen.getByText("Giulia").closest("button")!);
    expect(
      screen.getByText(
        "Keeps the dbt project healthy. Teaches Luca the rules — and the reasons.",
      ),
    ).toBeDefined();

    // Collapse Luca — Giulia should stay expanded
    fireEvent.click(screen.getByText("Luca").closest("button")!);
    expect(
      screen.queryByText("Makes mistakes, learns. You are helping him."),
    ).toBeNull();
    expect(
      screen.getByText(
        "Keeps the dbt project healthy. Teaches Luca the rules — and the reasons.",
      ),
    ).toBeDefined();
  });

  it("character card buttons have aria-expanded attribute", () => {
    render(<StoryPanel {...defaultProps} />);

    const lucaButton = screen.getByText("Luca").closest("button")!;
    expect(lucaButton.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(lucaButton);
    expect(lucaButton.getAttribute("aria-expanded")).toBe("true");
  });

  // ── Completion / navigation ────────────────────────────────────────

  it("shows completion section when completed is true", () => {
    render(<StoryPanel {...defaultProps} completed={true} />);
    expect(screen.getByText("Chapter 1 complete!")).toBeDefined();
    expect(screen.getByText("Next: Chapter 2 →")).toBeDefined();
  });

  it("shows completion section when justCompleted is true", () => {
    render(<StoryPanel {...defaultProps} justCompleted={true} />);
    expect(screen.getByText("Chapter 1 complete!")).toBeDefined();
  });

  it("does not show completion section when not completed", () => {
    render(<StoryPanel {...defaultProps} />);
    expect(screen.queryByText("Chapter 1 complete!")).toBeNull();
  });

  it("shows 'last chapter' message when no next chapter exists", () => {
    render(
      <StoryPanel {...defaultProps} nextChapter={null} completed={true} />,
    );
    expect(
      screen.getByText("You finished the last chapter! Module 1 is complete."),
    ).toBeDefined();
  });

  it("next chapter link points to the correct slug", () => {
    render(<StoryPanel {...defaultProps} completed={true} />);
    const link = screen.getByTestId("next-link");
    expect(link.getAttribute("href")).toBe("/chapters/chapter-2");
  });

  // ── Responsive layout ─────────────────────────────────────────────

  it("has a scrollable container", () => {
    const { container } = render(<StoryPanel {...defaultProps} />);
    const scrollable = container.firstChild as HTMLElement;
    expect(scrollable.className).toContain("overflow-y-auto");
  });
});
