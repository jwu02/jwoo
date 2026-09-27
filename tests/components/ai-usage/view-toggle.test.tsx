import { render, screen, fireEvent } from "@testing-library/react";
import { RangeSelector } from "@/components/polled/range-selector";
import { VIEW_OPTIONS } from "@/components/ai-usage/view-toggle";

// The breakdown view toggle is the shared pill group rendered with the view
// options, so these cover the options themselves rather than the selector.
describe("VIEW_OPTIONS", () => {
  it("renders a button for each view", () => {
    render(
      <RangeSelector value="model" onChange={() => {}} options={VIEW_OPTIONS} />
    );
    expect(screen.getByRole("button", { name: "Model" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Harness" })).toBeInTheDocument();
  });

  it("marks the active view as pressed", () => {
    const { rerender } = render(
      <RangeSelector value="model" onChange={() => {}} options={VIEW_OPTIONS} />
    );
    expect(screen.getByRole("button", { name: "Model" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Project" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Harness" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    rerender(
      <RangeSelector
        value="harness"
        onChange={() => {}}
        options={VIEW_OPTIONS}
      />
    );
    expect(screen.getByRole("button", { name: "Harness" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("fires onChange with the clicked view", () => {
    const onChange = jest.fn();
    render(
      <RangeSelector value="model" onChange={onChange} options={VIEW_OPTIONS} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Harness" }));
    expect(onChange).toHaveBeenCalledWith("harness");
  });
});
