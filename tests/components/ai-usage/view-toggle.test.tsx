import { render, screen, fireEvent } from "@testing-library/react";
import { ViewToggle } from "@/components/ai-usage/view-toggle";

describe("ViewToggle", () => {
  it("renders a button for each view", () => {
    render(<ViewToggle value="model" onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: "By model" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "By project" })
    ).toBeInTheDocument();
  });

  it("marks the active view as pressed", () => {
    const { rerender } = render(
      <ViewToggle value="model" onChange={() => {}} />
    );
    expect(
      screen.getByRole("button", { name: "By model" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "By project" })
    ).toHaveAttribute("aria-pressed", "false");

    rerender(<ViewToggle value="project" onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: "By project" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("fires onChange with the clicked view", () => {
    const onChange = jest.fn();
    render(<ViewToggle value="model" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "By project" }));
    expect(onChange).toHaveBeenCalledWith("project");
  });
});
