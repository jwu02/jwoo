import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardHeader } from "@/components/polled/dashboard-header";

describe("DashboardHeader", () => {
  it("reports the range the viewer picks", () => {
    const onRangeChange = jest.fn();
    render(
      <DashboardHeader
        lastUpdated={new Date()}
        range="24h"
        onRangeChange={onRangeChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "1y" }));

    expect(onRangeChange).toHaveBeenCalledWith("1y");
  });

  it("says when the data on screen arrived", () => {
    render(
      <DashboardHeader
        lastUpdated={new Date("2026-08-18T10:00:00.000Z")}
        range="24h"
        onRangeChange={jest.fn()}
      />
    );

    expect(screen.getByText(/^Last updated:/)).toBeInTheDocument();
  });

  it("keeps the range control before the first response", () => {
    render(
      <DashboardHeader
        lastUpdated={null}
        range="24h"
        onRangeChange={jest.fn()}
      />
    );

    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "24h" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30d" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1y" })).toBeInTheDocument();
  });
});
