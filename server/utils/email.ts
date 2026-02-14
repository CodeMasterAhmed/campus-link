import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "@/lib/env";

let transporter: Transporter | null = null;

function getSmtpConfig() {
  const env = getEnv();
  const host = env.SMTP_HOST.trim();
  const port = Number(env.SMTP_PORT ?? 587);
  const secure = Boolean(env.SMTP_SECURE);
  const user = env.SMTP_USER.trim();
  const pass = env.SMTP_PASS;
  const from = env.SMTP_FROM.trim() || user;

  if (!host || !port || !user || !pass || !from) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env."
    );
  }

  return { host, port, secure, user, pass, from };
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const smtp = getSmtpConfig();
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, body: string) {
  const smtp = getSmtpConfig();
  const mailer = getTransporter();

  await mailer.sendMail({
    from: smtp.from,
    to,
    subject,
    text: body,
  });

  return true;
}
