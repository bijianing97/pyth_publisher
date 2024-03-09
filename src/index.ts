/* eslint-disable @typescript-eslint/no-explicit-any */
import yargs from "yargs";
import { hideBin, Parser } from "yargs/helpers";
import { jsonc } from "jsonc";
import fs from "fs";
import path from "path";
import { Publisher, PublisherConfig } from "./publisher";
import { logger } from "./logger/logger";

const args = yargs(hideBin(process.argv));

function defineConfig<T>(name: string, args: yargs.Argv<T>) {
  return args.config("config", function (_path: string) {
    const config = jsonc.parse(fs.readFileSync(path.resolve(_path), "utf8"));
    if (!(name in config)) {
      throw new Error("missing config for: " + name);
    }

    // merge with default config
    return "default" in config
      ? {
          ...config["default"],
          ...config[name],
        }
      : config[name];
  });
}

function defineCommand<T, U = T>(
  args: yargs.Argv<T>,
  command: string,
  description: string,
  builder: (args: yargs.Argv<T>) => yargs.Argv<U>,
  handler: (args: yargs.ArgumentsCamelCase<U>) => void | Promise<void>
): yargs.Argv<T> {
  return args.command(
    command,
    description,
    (args) => defineConfig(Parser.camelCase(command), builder(args)),
    handler
  );
}

defineCommand(
  args,
  "publisher",
  "Start the publisher",
  (args) => args,
  async (args) => {
    const publisher = new Publisher(args.publisherConfig as PublisherConfig);

    let exiting = false;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.on("SIGINT", async () => {
      if (!exiting) {
        exiting = true;
        logger.info("Main", "exiting...");
        try {
          await publisher.stop();
          logger.info("Main", "exited");
        } catch (err) {
          logger.error("Main", "error:", err);
          process.exit(1);
        }
      }
    });

    // catch errors...
    process.on("uncaughtException", (err) => {
      logger.error("Main", "uncaught exception:", err);
    });

    process.on("unhandledRejection", (err) => {
      logger.error("Main", "unhandled rejection:", err);
    });

    try {
      publisher.start();
    } catch (err) {
      logger.error("Main", "error:", err);
      process.exit(1);
    }
  }
);

args.parse();
