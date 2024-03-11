import asyncRetry from "async-retry";
import { logger } from "./logger";

const DEFAULT_RETRY_OPTION = {
  retries: 5,
  onRetry: (error: Error): void => {
    logger.error("retrying on error:", error);
  },
};

export function retry<T>(
  func: () => Promise<T>,
  retryOption = DEFAULT_RETRY_OPTION
) {
  return asyncRetry(func, retryOption);
}
