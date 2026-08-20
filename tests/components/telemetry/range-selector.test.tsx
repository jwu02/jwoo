import { render, screen, fireEvent } from "@testing-library/react";
import {
  RangeSelector,
  TELEMETRY_RANGE_OPTIONS,
} from "@/components/telemetry/range-selector";

describe("RangeSelector", () => {
  it("calls onChange when a range is clicked", () => {
    const onChange = jest.fn();
    render(
      <RangeSelector
        value="24h"
        onChange={onChange}
        options={TELEMETRY_RANGE_OPTIONS}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "30d" }));
    expect(onChange).toHaveBeenCalledWith("30d");
  });

  it("renders the provided options", () => {
    const onChange = jest.fn();
    render(
      <RangeSelector
        value="24h"
        onChange={onChange}
        options={[
          { value: "24h", label: "24h" },
          { value: "30d", label: "30d" },
          { value: "1y", label: "1y" },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: "30d" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "7d" })
    ).not.toBeInTheDocument();
  });
});
