// jest.config.js
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Nested git worktrees live under .claude/worktrees/; the parent checkout's
  // Jest must not discover their duplicate test files.
  testPathIgnorePatterns: ["<rootDir>/.claude/worktrees/"],
};

export default createJestConfig(customJestConfig);
