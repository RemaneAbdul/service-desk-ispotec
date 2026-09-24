const nodemailer = require("nodemailer");

function transporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendMail({ to, subject, text }) {
  const t = transporter();
  if (!t || !to) return false;
  await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
  return true;
}

module.exports = { sendMail };
