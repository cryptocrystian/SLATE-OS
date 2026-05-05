#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Dev-only utility: probe SMTP AUTH against an SMTP host using credentials
 * already in `.env.local`. Issues nothing more than a 220 banner read,
 * EHLO, STARTTLS, EHLO, AUTH LOGIN, and QUIT — never sends or queues mail.
 *
 * Prints only the high-level outcome:
 *   - "auth ok"  (235)
 *   - "auth failed: 535 ..."  (with sanitized server message)
 *   - "stage failed at <stage>: <code> <line>"
 *   - "connection error: ..."
 *
 * Never echoes the username, password, or any banner field that contains
 * the project's secrets.
 *
 * Required env (via `.env.local`):
 *   MAILGUN_SMTP_USER
 *   MAILGUN_SMTP_PASSWORD
 *
 * Optional env:
 *   SMTP_HOST  — default smtp.mailgun.org
 *   SMTP_PORT  — default 587  (STARTTLS)
 *
 * Usage:
 *   node scripts/dev/probe-smtp-auth.cjs
 */

const path = require("path");
const net = require("net");
const tls = require("tls");

const HOST = process.env.SMTP_HOST || "smtp.mailgun.org";
const PORT = Number(process.env.SMTP_PORT || 587);

(async () => {
  try {
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(path.resolve(__dirname, "..", ".."));
  } catch {
    console.error("Could not load @next/env. Run `npm install` first.");
    process.exit(1);
  }

  const user = process.env.MAILGUN_SMTP_USER;
  const pass = process.env.MAILGUN_SMTP_PASSWORD;
  if (!user || !pass) {
    console.error(
      "missing required env vars: MAILGUN_SMTP_USER and/or MAILGUN_SMTP_PASSWORD",
    );
    process.exit(1);
  }

  console.log(`probing ${HOST}:${PORT} (STARTTLS)…`);

  let socket;
  try {
    socket = await connectPlain(HOST, PORT);
  } catch (err) {
    console.error("connection error:", String(err && err.message) || err);
    process.exit(1);
  }

  try {
    await expect(socket, 220, "banner");
    await sendCmd(socket, "EHLO probe.slate.local");
    await expect(socket, 250, "EHLO");
    await sendCmd(socket, "STARTTLS");
    await expect(socket, 220, "STARTTLS");

    socket = await upgradeTls(socket, HOST);

    await sendCmd(socket, "EHLO probe.slate.local");
    await expect(socket, 250, "EHLO (post-TLS)");

    await sendCmd(socket, "AUTH LOGIN");
    await expect(socket, 334, "AUTH LOGIN");

    await sendCmd(socket, Buffer.from(user, "utf8").toString("base64"));
    await expect(socket, 334, "username");

    await sendCmd(socket, Buffer.from(pass, "utf8").toString("base64"));
    const final = await readResponse(socket);

    if (final.code === 235) {
      console.log("✓ auth ok (235)");
    } else {
      console.error(`✗ auth failed: ${final.code} ${redact(final.text)}`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(
      err && err.stage
        ? `stage failed at ${err.stage}: ${err.code} ${redact(err.text || "")}`
        : `error: ${String((err && err.message) || err)}`,
    );
    process.exitCode = 1;
  } finally {
    try {
      await sendCmd(socket, "QUIT");
    } catch {}
    try {
      socket.destroy();
    } catch {}
  }
})();

function connectPlain(host, port) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    sock.setEncoding("utf8");
    sock.once("connect", () => resolve(sock));
    sock.once("error", reject);
    sock.setTimeout(15000, () => {
      reject(new Error("connection timeout"));
      sock.destroy();
    });
  });
}

function upgradeTls(plainSocket, servername) {
  return new Promise((resolve, reject) => {
    const tlsSocket = tls.connect({
      socket: plainSocket,
      servername,
      // Mailgun has a valid public CA cert; do not disable verification.
    });
    tlsSocket.setEncoding("utf8");
    tlsSocket.once("secureConnect", () => resolve(tlsSocket));
    tlsSocket.once("error", reject);
  });
}

function sendCmd(socket, line) {
  return new Promise((resolve, reject) => {
    socket.write(line + "\r\n", (err) => (err ? reject(err) : resolve()));
  });
}

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk;
      // SMTP allows multi-line responses with "<code>-" continuations and
      // a final "<code> ". Read until we see the terminator line.
      const lines = buf.split(/\r?\n/);
      const last = lines[lines.length - 2]; // last full line
      if (last && /^\d{3} /.test(last)) {
        socket.off("data", onData);
        socket.off("error", onErr);
        const code = Number(last.slice(0, 3));
        const text = lines
          .slice(0, -1)
          .map((l) => l.replace(/^\d{3}[- ]/, ""))
          .join(" | ")
          .trim();
        resolve({ code, text });
      }
    };
    const onErr = (e) => {
      socket.off("data", onData);
      reject(e);
    };
    socket.on("data", onData);
    socket.on("error", onErr);
    socket.setTimeout(15000, () =>
      reject(new Error("response timeout")),
    );
  });
}

async function expect(socket, expectedCode, stage) {
  const r = await readResponse(socket);
  if (r.code !== expectedCode) {
    const e = new Error(`expected ${expectedCode}, got ${r.code}`);
    e.stage = stage;
    e.code = r.code;
    e.text = r.text;
    throw e;
  }
  return r;
}

function redact(s) {
  if (!s) return "";
  return String(s)
    .replace(/key-[A-Za-z0-9]{20,}/g, "<mailgun-key>")
    .replace(/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>")
    .slice(0, 240);
}
