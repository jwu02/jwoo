import { render, screen, fireEvent } from "@testing-library/react";
import AiUsagePage from "@/app/ai-usage/page";

// The chart itself is stubbed out, but its token formatter is real: the donut
// beside it reads token counts through the same function.
jest.mock("@/components/ai-usage/usage-chart", () => ({
  ...jest.requireActual("@/components/ai-usage/usage-chart"),
  UsageChart: () => <div data-testid="usage-chart" />,
}));

const response = {
  totals: {
    costYuan: 2.5,
    totalTokens: 6000,
    promptTokens: 5000,
    completionTokens: 1000,
    cacheHitTokens: 4000,
    cacheMissTokens: 1000,
  },
  byModel: [
    { model: "claude-opus-5", costYuan: 1.2, totalTokens: 3000 },
    { model: "deepseek-v4-flash", costYuan: 0.8, totalTokens: 2000 },
  ],
  byProject: [
    {
      project: "work",
      costYuan: 1.5,
      totalTokens: 4000,
    },
    {
      project: "personal-website",
      costYuan: 1.0,
      totalTokens: 2000,
    },
    {
      project: "Others",
      costYuan: 0.5,
      totalTokens: 500,
    },
  ],
  byHarness: [
    {
      harness: "claude-code",
      costYuan: 2.0,
      totalTokens: 5000,
    },
    {
      harness: "api",
      costYuan: 0.5,
      totalTokens: 1000,
    },
  ],
  bySkill: [
    { skill: "implement", invocations: 1791 },
    { skill: "grill-with-docs", invocations: 299 },
  ],
  timeSeriesByModel: [],
};

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe("AiUsagePage", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }) as unknown as typeof fetch;
  });

  it("defaults to the by-model view", async () => {
    render(<AiUsagePage />);
    // Each label shows once per ring (cost and tokens).
    expect(await screen.findAllByText("claude-opus-5")).toHaveLength(2);
    expect(screen.getAllByText("deepseek-v4-flash")).toHaveLength(2);
    expect(screen.queryByText("jwoo")).not.toBeInTheDocument();
  });

  it("switches to the by-project view on toggle", async () => {
    render(<AiUsagePage />);
    await screen.findAllByText("claude-opus-5");

    fireEvent.click(screen.getByRole("button", { name: "Project" }));

    expect(await screen.findAllByText("work")).toHaveLength(2);
    expect(screen.getAllByText("personal-website")).toHaveLength(2);
    expect(screen.getAllByText("Others")).toHaveLength(2);
    expect(screen.queryByText("claude-opus-5")).not.toBeInTheDocument();
  });

  it("switches to the by-harness view on toggle", async () => {
    render(<AiUsagePage />);
    await screen.findAllByText("claude-opus-5");

    fireEvent.click(screen.getByRole("button", { name: "Harness" }));

    expect(await screen.findAllByText("claude-code")).toHaveLength(2);
    expect(screen.getAllByText("api")).toHaveLength(2);
    expect(screen.queryByText("claude-opus-5")).not.toBeInTheDocument();
  });

  it("puts the range above the data it governs", async () => {
    render(<AiUsagePage />);
    await screen.findAllByText("claude-opus-5");

    const pills = screen.getAllByRole("button", { name: "1y" });
    expect(pills).toHaveLength(1);
    const breakdown = screen.getByText("Usage breakdown");
    expect(
      pills[0].compareDocumentPosition(breakdown) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("ranks the top invoked skills below the chart", async () => {
    render(<AiUsagePage />);
    await screen.findAllByText("claude-opus-5");

    // Counts, not cost or tokens: the count is the only number a skill has.
    expect(screen.getByText("implement")).toBeInTheDocument();
    expect(screen.getByText("1,791")).toBeInTheDocument();
    expect(screen.getByText("grill-with-docs")).toBeInTheDocument();

    const heading = screen.getByRole("heading", {
      name: "Top invoked skills",
    });
    expect(
      screen.getByTestId("usage-chart").compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("leaves the skills list outside the breakdown's pills", async () => {
    render(<AiUsagePage />);
    await screen.findAllByText("claude-opus-5");

    fireEvent.click(screen.getByRole("button", { name: "Harness" }));

    expect(await screen.findAllByText("claude-code")).toHaveLength(2);
    expect(screen.getByText("implement")).toBeInTheDocument();
  });

  it("says so when the range invoked no skills", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...response, bySkill: [] }),
    }) as unknown as typeof fetch;

    render(<AiUsagePage />);

    expect(
      await screen.findByText("No skills invoked in this range.")
    ).toBeInTheDocument();
  });

  it("keeps the range reachable when the range holds no usage", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...response,
        totals: { ...response.totals, totalTokens: 0 },
      }),
    }) as unknown as typeof fetch;

    render(<AiUsagePage />);

    expect(
      await screen.findByText("No AI usage in this range.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30d" })).toBeInTheDocument();
  });
});
