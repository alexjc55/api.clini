import { AsyncLocalStorage } from "async_hooks";
import type { EnvironmentMode } from "@shared/schema";

interface EnvironmentContext {
  environment: EnvironmentMode;
}

export const environmentStorage = new AsyncLocalStorage<EnvironmentContext>();

export function getCurrentEnvironment(): EnvironmentMode {
  const ctx = environmentStorage.getStore();
  return ctx?.environment ?? "production";
}

export function isSandboxEnvironment(): boolean {
  return getCurrentEnvironment() === "sandbox";
}
