#!/usr/bin/env node
import process from "node:process";
import { runCli } from "./index.js";

runCli().then((code) => {
  process.exit(code);
}).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
