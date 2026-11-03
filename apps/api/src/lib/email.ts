import net from "node:net";
import tls from "node:tls";
import { logger } from "./logger.js";

export type EmailMessage = { to: string; subject: string; text: string };
export interface EmailProvider { send(to: string, subject: string, text: string): Promise<void> }
type MailTransport = { send(message: EmailMessage): Promise<void> };
type SmtpConfig = { host: string; port: number; secure: boolean; user: string; password: string; from: string };

const localOutbox: EmailMessage[] = [];
let testTransport: MailTransport | undefined;

function readSmtpConfig(): SmtpConfig | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  const values = [SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM];
  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value?.trim())) {
    throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured together.");
  }
  const port = Number(SMTP_PORT || "465");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT must be a valid TCP port.");
  return { host: SMTP_HOST!.trim(), port, secure: SMTP_SECURE ? SMTP_SECURE === "true" : port === 465, user: SMTP_USER!, password: SMTP_PASSWORD!, from: SMTP_FROM! };
}

export function validateProductionEmailConfiguration() {
  if (process.env.NODE_ENV === "production" && !readSmtpConfig()) {
    throw new Error("Production email is not configured. Provide SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.");
  }
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_EMAIL?.trim()) {
    throw new Error("Production requires ADMIN_EMAIL for affiliate application review notifications.");
  }
}

function assertHeader(value: string, label: string) {
  if (/[\r\n]/.test(value)) throw new Error(`Invalid email ${label}.`);
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value)) throw new Error(`Invalid email ${label}.`);
}

async function sendSmtp(config: SmtpConfig, message: EmailMessage) {
  assertHeader(message.to, "recipient");
  assertHeader(config.from, "sender");
  assertHeader(message.subject, "subject");
  let socket: net.Socket | tls.TLSSocket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });
  socket.setTimeout(15_000, () => socket.destroy(new Error("SMTP connection timed out")));

  let buffer = "";
  const pendingLines: string[] = [];
  let wakeReader: (() => void) | undefined;
  const onData = (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let newline = buffer.indexOf("\r\n");
    while (newline >= 0) {
      pendingLines.push(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 2);
      wakeReader?.();
      newline = buffer.indexOf("\r\n");
    }
  };
  socket.on("data", onData);
  const readLine = async () => {
    while (!pendingLines.length) await new Promise<void>((resolve, reject) => {
      const finish = () => {
        socket.off("error", onError);
        socket.off("close", onClose);
        wakeReader = undefined;
        resolve();
      };
      const onError = (error: Error) => {
        socket.off("close", onClose);
        reject(error);
      };
      const onClose = () => {
        socket.off("error", onError);
        reject(new Error("SMTP connection closed"));
      };
      wakeReader = finish;
      socket.once("error", onError);
      socket.once("close", onClose);
    });
    return pendingLines.shift()!;
  };
  const readReply = async () => {
    const first = await readLine();
    const code = Number(first.slice(0, 3));
    const lines = [first];
    let current = first;
    while (current.slice(0, 3) === first.slice(0, 3) && current[3] === "-") {
      current = await readLine();
      lines.push(current);
    }
    return { code, text: lines.join("\n") };
  };
  const expect = async (allowed: number[]) => {
    const reply = await readReply();
    if (!allowed.includes(reply.code)) throw new Error(`SMTP command rejected with status ${reply.code}.`);
  };
  const command = async (value: string, allowed: number[]) => {
    await new Promise<void>((resolve, reject) => socket.write(`${value}\r\n`, (error) => error ? reject(error) : resolve()));
    await expect(allowed);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once(config.secure ? "secureConnect" : "connect", resolve);
      socket.once("error", reject);
    });
    await expect([220]);
    await command("EHLO devsphere.local", [250]);
    if (!config.secure) {
      await command("STARTTLS", [220]);
      socket.removeListener("data", onData);
      socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const upgraded = tls.connect({ socket, servername: config.host }, () => resolve(upgraded));
        upgraded.once("error", reject);
      });
      buffer = "";
      pendingLines.length = 0;
      socket.on("data", onData);
      await command("EHLO devsphere.local", [250]);
    }
    const auth = Buffer.from(`\0${config.user}\0${config.password}`).toString("base64");
    await command(`AUTH PLAIN ${auth}`, [235]);
    await command(`MAIL FROM:<${config.from}>`, [250]);
    await command(`RCPT TO:<${message.to}>`, [250, 251]);
    await command("DATA", [354]);
    const encodedSubject = `=?UTF-8?B?${Buffer.from(message.subject).toString("base64")}?=`;
    const body = message.text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    await new Promise<void>((resolve, reject) => socket.write(
      `From: ${config.from}\r\nTo: ${message.to}\r\nSubject: ${encodedSubject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${body}\r\n.\r\n`,
      (error) => error ? reject(error) : resolve(),
    ));
    await expect([250]);
    await command("QUIT", [221]);
  } finally {
    socket.destroy();
  }
}

const smtpTransport: MailTransport = {
  async send(message) {
    const config = readSmtpConfig();
    if (!config) throw new Error("SMTP configuration is unavailable.");
    await sendSmtp(config, message);
  },
};

export function configureEmailTransportForTests(transport?: MailTransport) { testTransport = transport; }
export function clearLocalEmailOutbox() { localOutbox.length = 0; }
export function getLocalEmailOutbox() { return [...localOutbox]; }

export const emailProvider: EmailProvider = {
  async send(to, subject, text) {
    const message = { to, subject, text };
    if (testTransport) return testTransport.send(message);
    const config = readSmtpConfig();
    if (config) return smtpTransport.send(message);
    if (process.env.NODE_ENV === "production") throw new Error("SMTP configuration is unavailable.");
    localOutbox.push(message);
  },
};

export async function sendEmailSafely(to: string, subject: string, text: string) {
  try {
    await emailProvider.send(to, subject, text);
    return true;
  } catch (error) {
    logger.error("email_delivery_failed", { error });
    return false;
  }
}

export const affiliateEmails = {
  applicationReceived(email: string) { return sendEmailSafely(email, "Affiliate application received", "We received your DevSphere Affiliate Hub application. We will email you after it has been reviewed."); },
  applicationNotice(email: string) { return sendEmailSafely(email, "Affiliate application needs review", "A new DevSphere Affiliate Hub application is ready for administrator review."); },
  applicationDecision(email: string, status: "APPROVED" | "REJECTED" | "SUSPENDED", reason?: string | null) {
    const copy = status === "APPROVED" ? "Your affiliate application was approved." : `Your affiliate application was ${status.toLowerCase()}.`;
    return sendEmailSafely(email, `Affiliate application ${status.toLowerCase()}`, `${copy}${reason ? `\nReview note: ${reason}` : ""}`);
  },
  commissionPending(email: string, amount: string) { return sendEmailSafely(email, "Affiliate commission pending", `A verified purchase created a pending commission of ${amount}. Earnings remain pending and are not payable until a release workflow is introduced.`); },
  payoutStatus(email: string, status: string, reference: string) { return sendEmailSafely(email, "Affiliate payout update", `Your payout ${reference} status is ${status}.`); },
};
