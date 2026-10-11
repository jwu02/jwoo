import { render, screen } from "@testing-library/react";
import { SkillList } from "@/components/ai-usage/skill-list";

const rows = [
  { skill: "implement", invocations: 1791 },
  { skill: "grill-with-docs", invocations: 299 },
  { skill: "prototype", invocations: 132 },
];

// Twelve skills, each invoked one fewer time than the last, so the tail past
// the tenth is worth 2 + 1.
const manyRows = Array.from({ length: 12 }, (_, i) => ({
  skill: `s${i}`,
  invocations: 12 - i,
}));

describe("SkillList", () => {
  it("carries every skill and its count as text, not only as a bar", () => {
    render(<SkillList rows={rows} />);
    expect(screen.getByText("implement")).toBeInTheDocument();
    expect(screen.getByText("1,791")).toBeInTheDocument();
    expect(screen.getByText("grill-with-docs")).toBeInTheDocument();
    expect(screen.getByText("299")).toBeInTheDocument();
    expect(screen.getByText("prototype")).toBeInTheDocument();
  });

  it("reads most invoked first", () => {
    render(<SkillList rows={rows} />);
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent)
    ).toEqual(["implement1,791", "grill-with-docs299", "prototype132"]);
  });

  it("folds everything past the tenth into one Others row", () => {
    render(<SkillList rows={manyRows} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(11);
    expect(screen.getAllByRole("listitem")[10]?.textContent).toBe("Others3");
  });

  it("draws each bar against the most invoked skill", () => {
    const { container } = render(
      <SkillList
        rows={[
          { skill: "a", invocations: 100 },
          { skill: "b", invocations: 50 },
          { skill: "c", invocations: 25 },
        ]}
      />
    );
    const widthOf = (skill: string) =>
      (
        container.querySelector(`[data-skill-bar="${skill}"]`) as HTMLElement
      ).style.width;

    expect(widthOf("a")).toBe("100%");
    expect(widthOf("b")).toBe("50%");
    expect(widthOf("c")).toBe("25%");
  });

  it("says so when the range invoked no skills", () => {
    render(<SkillList rows={[]} />);
    expect(
      screen.getByText("No skills invoked in this range.")
    ).toBeInTheDocument();
  });
});
