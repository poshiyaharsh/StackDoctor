import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getReportJsonSchema } from "../packages/schemas/dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = getReportJsonSchema();
const targetPath = path.resolve(__dirname, "../docs/report.schema.json");

fs.writeFileSync(targetPath, JSON.stringify(schema, null, 2) + "\n", "utf-8");
console.log(`Generated JSON schema at: ${targetPath}`);
