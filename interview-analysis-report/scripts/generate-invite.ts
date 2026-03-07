import "dotenv/config";
import fs from "fs";
import { createInviteCode } from "../server/lib/invite.js";

const args = process.argv.slice(2);
let days = 7;
let count = 1;
let outFile: string | null = null;

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const daysArg = getArg("--days");
if (daysArg) {
  const parsed = parseInt(daysArg, 10);
  if (isNaN(parsed) || parsed <= 0) { console.error("Error: --days must be a positive integer"); process.exit(1); }
  days = parsed;
}

const countArg = getArg("--count");
if (countArg) {
  const parsed = parseInt(countArg, 10);
  if (isNaN(parsed) || parsed <= 0) { console.error("Error: --count must be a positive integer"); process.exit(1); }
  count = parsed;
}

const outArg = getArg("--out");
if (outArg) outFile = outArg;

const privateKeyPem = (process.env.INVITE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
if (!privateKeyPem) {
  console.error("Error: INVITE_PRIVATE_KEY not set in .env");
  process.exit(1);
}

const codes: string[] = [];
for (let i = 0; i < count; i++) {
  codes.push(createInviteCode(privateKeyPem, days));
}

const header = `${count} invite code${count === 1 ? "" : "s"} (expires in ${days} day${days === 1 ? "" : "s"})`;

if (outFile) {
  fs.writeFileSync(outFile, codes.join("\n") + "\n", "utf-8");
  console.log(`${header} -> ${outFile}`);
} else {
  console.log(`${header}:\n`);
  codes.forEach(c => console.log(c));
}
