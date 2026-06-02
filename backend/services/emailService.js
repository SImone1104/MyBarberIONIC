const nodemailer = require("nodemailer");

function mailEnabled() {
  return process.env.MAIL_ENABLED !== "false";
}

function smtpConfigurato() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_PORT
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
    && process.env.MAIL_FROM
  );
}

function creaTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function formattaData(data) {
  const [anno, mese, giorno] = String(data || "").split("-");

  if (!anno || !mese || !giorno) {
    return data;
  }

  return `${giorno}/${mese}/${anno}`;
}

function testoConfermaPrenotazione({ utente, prenotazione }) {
  const nome = utente?.nome || "cliente";
  const servizio = prenotazione.servizioNome || prenotazione.servizio;
  const note = prenotazione.note ? `\nNote: ${prenotazione.note}` : "";

  return [
    `Ciao ${nome},`,
    "",
    "la tua prenotazione da MyBarber è stata confermata.",
    "",
    `Servizio: ${servizio}`,
    `Data: ${formattaData(prenotazione.data)}`,
    `Ora: ${prenotazione.ora}`,
    `Fine prevista: ${prenotazione.oraFine}`,
    `Durata: ${prenotazione.durataMinuti} minuti${note}`,
    "",
    "Ti aspettiamo!",
    "MyBarber"
  ].join("\n");
}

function htmlConfermaPrenotazione({ utente, prenotazione }) {
  const nome = utente?.nome || "cliente";
  const servizio = prenotazione.servizioNome || prenotazione.servizio;
  const note = prenotazione.note
    ? `<p><strong>Note:</strong> ${escapeHtml(prenotazione.note)}</p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Prenotazione confermata</h2>
      <p>Ciao ${escapeHtml(nome)},</p>
      <p>la tua prenotazione da <strong>MyBarber</strong> è stata confermata.</p>
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 18px 0;">
        <p><strong>Servizio:</strong> ${escapeHtml(servizio)}</p>
        <p><strong>Data:</strong> ${escapeHtml(formattaData(prenotazione.data))}</p>
        <p><strong>Ora:</strong> ${escapeHtml(prenotazione.ora)}</p>
        <p><strong>Fine prevista:</strong> ${escapeHtml(prenotazione.oraFine)}</p>
        <p><strong>Durata:</strong> ${escapeHtml(String(prenotazione.durataMinuti))} minuti</p>
        ${note}
      </div>
      <p>Ti aspettiamo!</p>
      <p><strong>MyBarber</strong></p>
    </div>
  `;
}

function testoCancellazionePrenotazione({ utente, prenotazione }) {
  const nome = utente?.nome || "cliente";
  const servizio = prenotazione.servizioNome || prenotazione.servizio;

  return [
    `Ciao ${nome},`,
    "",
    "ti confermiamo che la tua prenotazione da MyBarber è stata cancellata.",
    "",
    `Servizio: ${servizio}`,
    `Data: ${formattaData(prenotazione.data)}`,
    `Ora: ${prenotazione.ora}`,
    "",
    "MyBarber"
  ].join("\n");
}

function htmlCancellazionePrenotazione({ utente, prenotazione }) {
  const nome = utente?.nome || "cliente";
  const servizio = prenotazione.servizioNome || prenotazione.servizio;

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Prenotazione cancellata</h2>
      <p>Ciao ${escapeHtml(nome)},</p>
      <p>ti confermiamo che la tua prenotazione da <strong>MyBarber</strong> è stata cancellata.</p>
      <div style="border: 1px solid #fee2e2; border-radius: 8px; padding: 16px; margin: 18px 0; background: #fff7f7;">
        <p><strong>Servizio:</strong> ${escapeHtml(servizio)}</p>
        <p><strong>Data:</strong> ${escapeHtml(formattaData(prenotazione.data))}</p>
        <p><strong>Ora:</strong> ${escapeHtml(prenotazione.ora)}</p>
      </div>
      <p>Se vuoi, puoi prenotare un nuovo appuntamento dalla tua area personale.</p>
      <p><strong>MyBarber</strong></p>
    </div>
  `;
}

function testoAvvisoDaRiprogrammare({ utente, prenotazione, motivo }) {
  const nome = utente?.nome || "cliente";
  const servizio = prenotazione.servizioNome || prenotazione.servizio;
  const motivoTesto = motivo ? `\nMotivo: ${motivo}` : "";

  return [
    `Ciao ${nome},`,
    "",
    "il tuo appuntamento da MyBarber non è piu disponibile e deve essere riprogrammato.",
    "",
    `Servizio: ${servizio}`,
    `Data: ${formattaData(prenotazione.data)}`,
    `Ora: ${prenotazione.ora}${motivoTesto}`,
    "",
    "Accedi alla tua area appuntamenti e scegli una nuova data disponibile.",
    "MyBarber"
  ].join("\n");
}

function htmlAvvisoDaRiprogrammare({ utente, prenotazione, motivo }) {
  const nome = utente?.nome || "cliente";
  const servizio = prenotazione.servizioNome || prenotazione.servizio;
  const motivoHtml = motivo
    ? `<p><strong>Motivo:</strong> ${escapeHtml(motivo)}</p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Appuntamento da riprogrammare</h2>
      <p>Ciao ${escapeHtml(nome)},</p>
      <p>il tuo appuntamento da <strong>MyBarber</strong> non è piu disponibile e deve essere riprogrammato.</p>
      <div style="border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 18px 0; background: #fff7ed;">
        <p><strong>Servizio:</strong> ${escapeHtml(servizio)}</p>
        <p><strong>Data:</strong> ${escapeHtml(formattaData(prenotazione.data))}</p>
        <p><strong>Ora:</strong> ${escapeHtml(prenotazione.ora)}</p>
        ${motivoHtml}
      </div>
      <p>Accedi alla tua area appuntamenti e scegli una nuova data disponibile.</p>
      <p><strong>MyBarber</strong></p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function inviaConfermaPrenotazione({ utente, prenotazione }) {
  if (!mailEnabled() || !smtpConfigurato() || !utente?.email) {
    return;
  }

  const transporter = creaTransporter();

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: utente.email,
    subject: "Conferma prenotazione MyBarber",
    text: testoConfermaPrenotazione({ utente, prenotazione }),
    html: htmlConfermaPrenotazione({ utente, prenotazione })
  });
}

async function inviaCancellazionePrenotazione({ utente, prenotazione }) {
  if (!mailEnabled() || !smtpConfigurato() || !utente?.email) {
    return;
  }

  const transporter = creaTransporter();

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: utente.email,
    subject: "Cancellazione prenotazione MyBarber",
    text: testoCancellazionePrenotazione({ utente, prenotazione }),
    html: htmlCancellazionePrenotazione({ utente, prenotazione })
  });
}

async function inviaAvvisoDaRiprogrammare({ utente, prenotazione, motivo }) {
  if (!mailEnabled() || !smtpConfigurato() || !utente?.email) {
    return;
  }

  const transporter = creaTransporter();

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: utente.email,
    subject: "Appuntamento da riprogrammare - MyBarber",
    text: testoAvvisoDaRiprogrammare({ utente, prenotazione, motivo }),
    html: htmlAvvisoDaRiprogrammare({ utente, prenotazione, motivo })
  });
}

module.exports = {
  inviaConfermaPrenotazione,
  inviaCancellazionePrenotazione,
  inviaAvvisoDaRiprogrammare
};
