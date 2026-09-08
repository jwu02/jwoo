import {
  KEY_PRESS_DEPTH_M,
  createSpring,
  springIsSettled,
  stepSpring,
} from "@/components/telemetry/keyboard-spring";

const DT = 1 / 60;

describe("createSpring", () => {
  it("starts at rest (value = target, zero velocity)", () => {
    expect(createSpring(0)).toEqual({ value: 0, velocity: 0, target: 0 });
    expect(createSpring(1)).toEqual({ value: 1, velocity: 0, target: 1 });
  });
});

describe("stepSpring", () => {
  it("leaves an already-settled spring unchanged", () => {
    const spring = createSpring(0);
    const stepped = stepSpring(spring, 0, DT);
    expect(stepped.value).toBeCloseTo(0, 6);
    expect(stepped.velocity).toBeCloseTo(0, 6);
  });

  it("is pure — does not mutate the input state", () => {
    const spring = createSpring(0);
    stepSpring(spring, 1, DT);
    expect(spring.value).toBe(0);
  });

  it("moves a rested spring toward a press target", () => {
    const spring = createSpring(0);
    const stepped = stepSpring(spring, 1, DT);
    expect(stepped.value).toBeGreaterThan(0);
    expect(stepped.target).toBe(1);
  });

  it("converges to the pressed target over time", () => {
    let spring = createSpring(0);
    for (let i = 0; i < 120; i++) spring = stepSpring(spring, 1, DT);
    expect(spring.value).toBeCloseTo(1, 1);
    expect(springIsSettled(spring)).toBe(true);
  });

  it("springs back to rest after release (with a visible bounce)", () => {
    let spring = createSpring(1);
    for (let i = 0; i < 120; i++) spring = stepSpring(spring, 0, DT);
    expect(spring.value).toBeCloseTo(0, 1);
    expect(springIsSettled(spring)).toBe(true);
  });

  it("underline shows a bounded overshoot (snappy, not unstable)", () => {
    // Step to pressed and track the peak; the overshoot must be modest.
    let spring = createSpring(0);
    let peak = 0;
    for (let i = 0; i < 90; i++) {
      spring = stepSpring(spring, 1, DT);
      if (spring.value > peak) peak = spring.value;
    }
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.15);
  });
});

describe("springIsSettled", () => {
  it("is true only when both value error and velocity are small", () => {
    const settled = createSpring(0);
    expect(springIsSettled(settled)).toBe(true);

    const moving = { value: 0.4, velocity: 12, target: 1 };
    expect(springIsSettled(moving)).toBe(false);

    const wrongTarget = { value: 1, velocity: 0, target: 0 };
    expect(springIsSettled(wrongTarget)).toBe(false);
  });
});

describe("KEY_PRESS_DEPTH_M", () => {
  it("is a small positive travel in metres", () => {
    expect(KEY_PRESS_DEPTH_M).toBeGreaterThan(0);
    expect(KEY_PRESS_DEPTH_M).toBeLessThan(0.01);
  });
});
