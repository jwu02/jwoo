import { render, screen, fireEvent } from "@testing-library/react";
import AiUsagePage from "@/app/ai-usage/page";

jest.mock("@/components/ai-usage/usage-chart", () => ({
  UsageChart: () => <div data-testid="usage-chart" />,
}));

const response = {
  totals: {
    costYuan: 2.5,
    totalTokens: 6000,
    promptTokens: 5000,
    completionTokens: 1000,
    cacheHitTokens: 4000,
    cacheMissTokens: 2000,
    requests: 6,
  },
  byModel: [
    { model: "claude-opus-5", costYuan: 1.2, totalTokens: 3000, requests: 3 },
    { model: "deepseek-v4-flash", costYuan: 0.8, totalTokens: 2000, requests: 2 },
  ],
  byProject: [
    {
      project: "work",
      costYuan: 1.5,
      totalTokens: 4000,
      requests: 4,
    },
    {
      project: "personal-website",
      costYuan: 1.0,
      totalTokens: 2000,
      requests: 2,
    },
    {
      project: "others",
      costYuan: 0.5,
      totalTokens: 500,
      requests: 1,
    },
  ],
  byHarness: [
    {
      harness: "claude-code",
      costYuan: 2.0,
      totalTokens: 5000,
      requests: 5,
    },
    {
      harness: "api",
      costYuan: 0.5,
      totalTokens: 1000,
      requests: 1,
    },
  ],
  timeSeries: [],
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
    expect(await screen.findByText("claude-opus-5")).toBeInTheDocument();
    expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.queryByText("jwoo")).not.toBeInTheDocument();
  });

  it("switches to the by-project view on toggle", async () => {
    render(<AiUsagePage />);
    await screen.findByText("claude-opus-5");

    fireEvent.click(screen.getByRole("button", { name: "By project" }));

    expect(await screen.findByText("work")).toBeInTheDocument();
    expect(screen.getByText("personal-website")).toBeInTheDocument();
    expect(screen.getByText("others")).toBeInTheDocument();
    expect(screen.queryByText("claude-opus-5")).not.toBeInTheDocument();
  });

  it("switches to the by-harness view on toggle", async () => {
    render(<AiUsagePage />);
    await screen.findByText("claude-opus-5");

    fireEvent.click(screen.getByRole("button", { name: "By harness" }));

    expect(await screen.findByText("claude-code")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
    expect(screen.queryByText("claude-opus-5")).not.toBeInTheDocument();
  });
});
