// Test-only PGlite server for the worker contract tests (docs/83 §10).
// Prints {"port": N} once listening; exits on SIGTERM/SIGINT or stdin close.
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const db = await PGlite.create({ extensions: { citext } });
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: Number(process.argv[2] ?? 0) });
await server.start();
const addr = server.server?.address?.() ?? null;
process.stdout.write(JSON.stringify({ port: addr && typeof addr === "object" ? addr.port : Number(process.argv[2]) }) + "\n");
const stop = async () => { try { await server.stop(); await db.close(); } finally { process.exit(0); } };
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
process.stdin.on("end", stop);
process.stdin.resume();
