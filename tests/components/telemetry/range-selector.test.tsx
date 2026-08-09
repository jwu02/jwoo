import { render, screen, fireEvent } from "@testing-library/react";
import { RangeSelector } from "@/components/telemetry/range-selector";

describe("RangeSelector", () => {
  it("calls onChange when a range is clicked", () => {
    const onChange = jest.fn();
    render(<RangeSelector value="24h" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(onChange).toHaveBeenCalledWith("7d");
  });
});
