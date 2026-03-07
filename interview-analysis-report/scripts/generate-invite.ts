import "dotenv/config";
import { createInviteCode } from "../server/lib/invite.js";

const args = process.argv.slice(2);
let days = 7;

const daysIdx = args.indexOf("--days");
if (daysIdx !== -1 && args[daysIdx + 1]) {
  const parsed = parseInt(args[daysIdx + 1], 10);
  if (isNaN(parsed) || parsed <= 0) {
    console.error("Error: --days must be a positive integer");
    process.exit(1);
  }
  days = parsed;
}

const privateKeyPem = (process.env.INVITE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
if (!privateKeyPem) {
  console.error("Error: INVITE_PRIVATE_KEY not set in .env");
  process.exit(1);
}

const code = createInviteCode(privateKeyPem, days);

console.log(`Invite code (expires in ${days} day${days === 1 ? "" : "s"}):\n`);
console.log(code);
