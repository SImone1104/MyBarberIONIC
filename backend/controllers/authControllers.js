const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const db = require("../db/db");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const DURATE_SERVIZI = {
  taglio: 30,
  sfumatura: 30,
  barba: 30,
  completo: 60,
  colore: 120
};

const ALIAS_SERVIZI = {
  "taglio classico": "taglio",
  "cura barba": "barba",
  "taglio + barba": "completo",
  "taglio barba": "completo",
  "taglio e barba": "completo",
  "taglio + colore": "colore",
  "taglio colore": "colore",
  "taglio e colore": "colore"
};

const FINESTRE_APERTURA = [
  { inizio: "09:00", fine: "13:00" },
  { inizio: "15:00", fine: "19:00" }
];

const SLOT_STEP_MINUTI = 30;

function oraInMinuti(ora) {
  const [ore, minuti] = String(ora || "").split(":").map(Number);
  return ore * 60 + minuti;
}

function formatoDataValido(data) {
  const valore = String(data || "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valore)) {
    return false;
  }

  const [anno, mese, giorno] = valore.split("-").map(Number);
  const dataVerificata = new Date(anno, mese - 1, giorno);

  return dataVerificata.getFullYear() === anno
    && dataVerificata.getMonth() === mese - 1
    && dataVerificata.getDate() === giorno;
}

function parseDateInput(data) {
  const [anno, mese, giorno] = data.split("-").map(Number);
  return new Date(anno, mese - 1, giorno);
}

function giornoSettimana(data) {
  return parseDateInput(data).getDay();
}

function formatoOraValido(ora) {
  if (!/^\d{2}:\d{2}$/.test(String(ora || ""))) {
    return false;
  }

  const [ore, minuti] = ora.split(":").map(Number);
  return Number.isInteger(ore)
    && Number.isInteger(minuti)
    && ore >= 0
    && ore <= 23
    && minuti >= 0
    && minuti <= 59;
}

function minutiInOra(minutiTotali) {
  const ore = String(Math.floor(minutiTotali / 60)).padStart(2, "0");
  const minuti = String(minutiTotali % 60).padStart(2, "0");
  return `${ore}:${minuti}`;
}

function normalizzaServizio(servizio) {
  const valore = String(servizio || "").trim().toLowerCase();
  return ALIAS_SERVIZI[valore] || valore;
}

function durataServizio(servizio) {
  return DURATE_SERVIZI[normalizzaServizio(servizio)] || 30;
}

function serializzaContatti(row) {
  return {
    nome: row?.nome || "MyBarber",
    indirizzo: row?.indirizzo || "Via Roma, 123 - 90100 Palermo (PA)",
    telefono: row?.telefono || "+39 091 1234567",
    email: row?.email || "info@mybarber.it",
    orari: row?.orari ? String(row.orari).split("|").filter(Boolean) : [],
    latitudine: Number(row?.latitudine ?? 38.1157),
    longitudine: Number(row?.longitudine ?? 13.3613),
    mapsUrl: row?.maps_url || "https://www.google.com/maps/dir/?api=1&destination=38.1157,13.3613",
    instagramUrl: row?.instagram_url || "https://www.instagram.com/",
    facebookUrl: row?.facebook_url || "https://www.facebook.com/",
    tiktokUrl: row?.tiktok_url || "https://www.tiktok.com/"
  };
}

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getServizioAttivo(servizio) {
  const servizioNormalizzato = normalizzaServizio(servizio);

  return dbGet(
    `SELECT valore, durata_minuti FROM servizi WHERE valore = ? AND attivo = 1`,
    [servizioNormalizzato]
  );
}

async function slotBloccato(data, ora, durataMinuti) {
  const inizio = oraInMinuti(ora);
  const fine = inizio + durataMinuti;

  const bloccoPuntuale = await dbGet(
    `
      SELECT id
      FROM disponibilita_blocchi
      WHERE data = ?
        AND (
          intera_giornata = 1
          OR (
            CAST(substr(ora_inizio, 1, 2) AS INTEGER) * 60
            + CAST(substr(ora_inizio, 4, 2) AS INTEGER)
          ) < ?
          AND (
            CAST(substr(ora_fine, 1, 2) AS INTEGER) * 60
            + CAST(substr(ora_fine, 4, 2) AS INTEGER)
          ) > ?
        )
      LIMIT 1
    `,
    [data, fine, inizio]
  );

  if (bloccoPuntuale) {
    return true;
  }

  const bloccoRicorrente = await dbGet(
    `
      SELECT id
      FROM disponibilita_regole
      WHERE attiva = 1
        AND giorno_settimana = ?
        AND (valida_dal IS NULL OR valida_dal = '' OR valida_dal <= ?)
        AND (valida_al IS NULL OR valida_al = '' OR valida_al >= ?)
        AND (
          intera_giornata = 1
          OR (
            CAST(substr(ora_inizio, 1, 2) AS INTEGER) * 60
            + CAST(substr(ora_inizio, 4, 2) AS INTEGER)
          ) < ?
          AND (
            CAST(substr(ora_fine, 1, 2) AS INTEGER) * 60
            + CAST(substr(ora_fine, 4, 2) AS INTEGER)
          ) > ?
        )
      LIMIT 1
    `,
    [giornoSettimana(data), data, data, fine, inizio]
  );

  return !!bloccoRicorrente;
}

function calcolaOraFine(ora, durataMinuti) {
  return minutiInOra(oraInMinuti(ora) + durataMinuti);
}

function slotDentroOrarioApertura(ora, durataMinuti) {
  const inizio = oraInMinuti(ora);
  const fine = inizio + durataMinuti;

  return FINESTRE_APERTURA.some((finestra) => {
    const apertura = oraInMinuti(finestra.inizio);
    const chiusura = oraInMinuti(finestra.fine);
    return inizio >= apertura && fine <= chiusura;
  });
}

function slotAllineatoAllaDurata(ora, durataMinuti) {
  const inizio = oraInMinuti(ora);

  return FINESTRE_APERTURA.some((finestra) => {
    const apertura = oraInMinuti(finestra.inizio);
    return inizio >= apertura && (inizio - apertura) % SLOT_STEP_MINUTI === 0;
  });
}

function slotNelPassato(data, ora) {
  const [anno, mese, giorno] = data.split("-").map(Number);
  const [ore, minuti] = ora.split(":").map(Number);
  const inizioSlot = new Date(anno, mese - 1, giorno, ore, minuti, 0, 0);

  return inizioSlot <= new Date();
}

function intervalliSovrapposti(nuovoInizio, nuovoFine, prenotazione) {
  const esistenteInizio = oraInMinuti(prenotazione.ora);
  const esistenteFine = prenotazione.ora_fine
    ? oraInMinuti(prenotazione.ora_fine)
    : esistenteInizio + (prenotazione.durata_minuti || durataServizio(prenotazione.servizio));

  return nuovoInizio < esistenteFine && nuovoFine > esistenteInizio;
}

const DURATA_SERVIZIO_SQL = `
  COALESCE(
    (SELECT durata_minuti FROM servizi WHERE valore = LOWER(TRIM(servizio))),
    CASE LOWER(TRIM(servizio))
      WHEN 'taglio' THEN 30
      WHEN 'taglio classico' THEN 30
      WHEN 'sfumatura' THEN 30
      WHEN 'barba' THEN 30
      WHEN 'cura barba' THEN 30
      WHEN 'completo' THEN 60
      WHEN 'taglio + barba' THEN 60
      WHEN 'taglio barba' THEN 60
      WHEN 'taglio e barba' THEN 60
      WHEN 'colore' THEN 120
      WHEN 'taglio + colore' THEN 120
      WHEN 'taglio colore' THEN 120
      WHEN 'taglio e colore' THEN 120
      ELSE 30
    END
  )
`;

const INIZIO_PRENOTAZIONE_SQL = `
  CAST(substr(ora, 1, 2) AS INTEGER) * 60
  + CAST(substr(ora, 4, 2) AS INTEGER)
`;

const FINE_PRENOTAZIONE_SQL = `
  CASE
    WHEN ora_fine IS NOT NULL AND ora_fine != '' THEN
      CAST(substr(ora_fine, 1, 2) AS INTEGER) * 60
      + CAST(substr(ora_fine, 4, 2) AS INTEGER)
    ELSE
      ${INIZIO_PRENOTAZIONE_SQL}
      + COALESCE(durata_minuti, ${DURATA_SERVIZIO_SQL})
  END
`;

exports.register = async (req, res) => {
  try {
    const nomeUtente = (req.body.nome || "").trim();
    const cognomeUtente = (req.body.cognome || "").trim();
    const emailUtente = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password;
    const telefonoUtente = (req.body.telefono || req.body.cellulare || "").trim();

    if (!nomeUtente || !cognomeUtente || !emailUtente || !password || !telefonoUtente) {
      return res.status(400).json({ message: "Nome, cognome, email, password e telefono sono obbligatori" });
    }

    const existingUser = await User.findByEmail(emailUtente);
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      nome: nomeUtente,
      cognome: cognomeUtente,
      email: emailUtente,
      password: hashedPassword,
      telefono: telefonoUtente,
      ruolo: "user"
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    const user = await User.findByEmail(email);
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email, ruolo: user.ruolo || "user" }, SECRET, { expiresIn: "1h" });
    const { password: passwordHash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utente non trovato" });
    const { password, ...safeUser } = user;
    res.json({
      ...safeUser,
      nome: safeUser.nome || safeUser.email?.split("@")[0] || "",
      cognome: safeUser.cognome || "",
      telefono: safeUser.telefono || "",
      ruolo: safeUser.ruolo || "user"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profileData = {
      nome: (req.body.nome || "").trim(),
      cognome: (req.body.cognome || "").trim(),
      email: (req.body.email || "").trim().toLowerCase(),
      telefono: (req.body.telefono || "").trim()
    };

    if (!profileData.nome || !profileData.cognome || !profileData.email || !profileData.telefono) {
      return res.status(400).json({ message: "Nome, cognome, email e telefono sono obbligatori" });
    }

    const existingUser = await User.findByEmail(profileData.email);

    if (existingUser && existingUser.id !== Number(userId)) {
      return res.status(409).json({ message: "Email gia utilizzata da un altro account" });
    }

    const updatedUser = await User.updateProfile(userId, profileData);

    if (!updatedUser) {
      return res.status(404).json({ message: "Utente non trovato" });
    }

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.creaPrenotazione = async (req, res) => {
  try {
    const { data, ora, servizio, note } = req.body;
    const userId = req.user.id;

    if (!data || !ora || !servizio) {
      return res.status(400).json({ message: "Data, ora e servizio sono obbligatori" });
    }

    if (!formatoDataValido(data) || !formatoOraValido(ora)) {
      return res.status(400).json({ message: "Data o ora non valide" });
    }

    const servizioNormalizzato = normalizzaServizio(servizio);
    const servizioConfigurato = await getServizioAttivo(servizioNormalizzato);

    if (!servizioConfigurato && !DURATE_SERVIZI[servizioNormalizzato]) {
      return res.status(400).json({ message: "Servizio non valido" });
    }

    const durataMinuti = servizioConfigurato?.durata_minuti || durataServizio(servizioNormalizzato);
    const oraFine = calcolaOraFine(ora, durataMinuti);

    if (!slotDentroOrarioApertura(ora, durataMinuti)) {
      return res.status(409).json({ message: "Il servizio scelto non entra nello slot selezionato" });
    }

    if (!slotAllineatoAllaDurata(ora, durataMinuti)) {
      return res.status(409).json({ message: "Lo slot selezionato non e valido per la durata del servizio" });
    }

    if (slotNelPassato(data, ora)) {
      return res.status(409).json({ message: "Non puoi prenotare uno slot passato" });
    }

    if (await slotBloccato(data, ora, durataMinuti)) {
      return res.status(409).json({ message: "Questo slot non e disponibile" });
    }

    const nuovoInizio = oraInMinuti(ora);
    const nuovoFine = oraInMinuti(oraFine);
    const query = `
      INSERT INTO prenotazioni (user_id, data, ora, ora_fine, durata_minuti, servizio, note, stato)
      SELECT ?, ?, ?, ?, ?, ?, ?, 'confermata'
      WHERE NOT EXISTS (
        SELECT 1
        FROM prenotazioni
        WHERE data = ?
          AND COALESCE(stato, 'confermata') != 'annullata'
          AND (${INIZIO_PRENOTAZIONE_SQL}) < ?
          AND (${FINE_PRENOTAZIONE_SQL}) > ?
      )
    `;

    db.run(query, [userId, data, ora, oraFine, durataMinuti, servizioNormalizzato, note || "", data, nuovoFine, nuovoInizio], function(err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed") || err.message.includes("Prenotazione sovrapposta")) {
          return res.status(409).json({ message: "Questo orario si sovrappone a una prenotazione esistente" });
        }

        console.error("Errore INSERT:", err.message);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(409).json({ message: "Questo orario si sovrappone a una prenotazione esistente" });
      }

      res.status(201).json({ message: "Prenotazione salvata!", id: this.lastID, oraFine, durataMinuti });
    });
  } catch (err) {
    console.error("Errore try-catch:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getOrariOccupati = async (req, res) => {
  try {
    const { data } = req.query;

    if (!data) {
      return res.status(400).json({ message: "Data obbligatoria" });
    }

    if (!formatoDataValido(data)) {
      return res.status(400).json({ message: "Data non valida" });
    }

    const query = `
      SELECT ora, ora_fine, durata_minuti, servizio
      FROM prenotazioni
      WHERE data = ?
        AND COALESCE(stato, 'confermata') != 'annullata'
      ORDER BY ora ASC
    `;

    const rows = await dbAll(query, [data]);
    const blocchi = await dbAll(
      `
        SELECT id, ora_inizio, ora_fine, intera_giornata, motivo
        FROM disponibilita_blocchi
        WHERE data = ?
        ORDER BY ora_inizio ASC
      `,
      [data]
    );
    const regoleRicorrenti = await dbAll(
      `
        SELECT id, ora_inizio, ora_fine, intera_giornata, motivo
        FROM disponibilita_regole
        WHERE attiva = 1
          AND giorno_settimana = ?
          AND (valida_dal IS NULL OR valida_dal = '' OR valida_dal <= ?)
          AND (valida_al IS NULL OR valida_al = '' OR valida_al >= ?)
        ORDER BY ora_inizio ASC
      `,
      [giornoSettimana(data), data, data]
    );

    const prenotazioni = rows.map((row) => {
      const durataMinuti = row.durata_minuti || durataServizio(row.servizio);

      return {
        ora: row.ora,
        oraFine: row.ora_fine || calcolaOraFine(row.ora, durataMinuti),
        durataMinuti,
        servizio: row.servizio
      };
    });

    const blocchiOrari = blocchi.map((blocco) => {
      const durataMinuti = Math.max(30, oraInMinuti(blocco.ora_fine) - oraInMinuti(blocco.ora_inizio));

      return {
        ora: blocco.ora_inizio,
        oraFine: blocco.ora_fine,
        durataMinuti,
        servizio: blocco.motivo ? `Blocco: ${blocco.motivo}` : "Blocco disponibilita",
        blocco: true
      };
    });

    const blocchiRicorrenti = regoleRicorrenti.map((regola) => {
      const durataMinuti = Math.max(30, oraInMinuti(regola.ora_fine) - oraInMinuti(regola.ora_inizio));

      return {
        ora: regola.ora_inizio,
        oraFine: regola.ora_fine,
        durataMinuti,
        servizio: regola.motivo ? `Chiusura: ${regola.motivo}` : "Chiusura ricorrente",
        blocco: true,
        ricorrente: true
      };
    });

    res.json([...prenotazioni, ...blocchiOrari, ...blocchiRicorrenti]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPrenotazioniUtente = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `SELECT * FROM prenotazioni WHERE user_id = ? ORDER BY data ASC, ora ASC`;

    db.all(query, [userId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.riprogrammaPrenotazione = async (req, res) => {
  try {
    const prenotazioneId = Number(req.params.id);
    const userId = req.user.id;
    const { data, ora } = req.body;

    const prenotazione = await dbGet(
      `SELECT * FROM prenotazioni WHERE id = ? AND user_id = ?`,
      [prenotazioneId, userId]
    );

    if (!prenotazione) {
      return res.status(404).json({ message: "Prenotazione non trovata" });
    }

    if (prenotazione.stato !== "da_riprogrammare") {
      return res.status(409).json({ message: "Questa prenotazione non richiede riprogrammazione" });
    }

    if (!formatoDataValido(data) || !formatoOraValido(ora)) {
      return res.status(400).json({ message: "Data o ora non valide" });
    }

    const servizioConfigurato = await getServizioAttivo(prenotazione.servizio);

    if (!servizioConfigurato) {
      return res.status(400).json({ message: "Servizio non valido" });
    }

    const durataMinuti = servizioConfigurato.durata_minuti || durataServizio(prenotazione.servizio);
    const oraFine = calcolaOraFine(ora, durataMinuti);

    if (!slotDentroOrarioApertura(ora, durataMinuti) || !slotAllineatoAllaDurata(ora, durataMinuti)) {
      return res.status(409).json({ message: "Lo slot selezionato non e valido per la durata del servizio" });
    }

    if (slotNelPassato(data, ora)) {
      return res.status(409).json({ message: "Non puoi scegliere uno slot passato" });
    }

    if (await slotBloccato(data, ora, durataMinuti)) {
      return res.status(409).json({ message: "Questo slot non e disponibile" });
    }

    const nuovoInizio = oraInMinuti(ora);
    const nuovoFine = oraInMinuti(oraFine);
    const result = await dbRun(
      `
        UPDATE prenotazioni
        SET data = ?, ora = ?, ora_fine = ?, durata_minuti = ?, stato = 'confermata'
        WHERE id = ?
          AND user_id = ?
          AND NOT EXISTS (
            SELECT 1
            FROM prenotazioni
            WHERE id != ?
              AND data = ?
              AND COALESCE(stato, 'confermata') != 'annullata'
              AND (${INIZIO_PRENOTAZIONE_SQL}) < ?
              AND (${FINE_PRENOTAZIONE_SQL}) > ?
          )
      `,
      [data, ora, oraFine, durataMinuti, prenotazioneId, userId, prenotazioneId, data, nuovoFine, nuovoInizio]
    );

    if (result.changes === 0) {
      return res.status(409).json({ message: "Questo slot si sovrappone a una prenotazione esistente" });
    }

    await dbRun(
      `UPDATE notifiche SET letta = 1 WHERE user_id = ? AND prenotazione_id = ?`,
      [userId, prenotazioneId]
    );

    res.json({ message: "Prenotazione riprogrammata", oraFine, durataMinuti });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNotificheUtente = async (req, res) => {
  try {
    const rows = await dbAll(
      `
        SELECT id, prenotazione_id AS prenotazioneId, titolo, messaggio, letta, created_at AS createdAt
        FROM notifiche
        WHERE user_id = ?
        ORDER BY letta ASC, created_at DESC
        LIMIT 20
      `,
      [req.user.id]
    );

    res.json(rows.map((row) => ({
      ...row,
      letta: !!row.letta
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.segnaNotificaLetta = async (req, res) => {
  try {
    const result = await dbRun(
      `UPDATE notifiche SET letta = 1 WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: "Notifica non trovata" });
    }

    res.json({ message: "Notifica letta" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePrenotazione = async (req, res) => {
  try {
    const prenotazioneId = req.params.id;
    const userId = req.user.id;
    const result = await dbRun(`DELETE FROM prenotazioni WHERE id = ? AND user_id = ?`, [prenotazioneId, userId]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Prenotazione non trovata o non autorizzato" });
    }

    await dbRun(
      `UPDATE notifiche SET letta = 1 WHERE user_id = ? AND prenotazione_id = ?`,
      [userId, prenotazioneId]
    );

    res.json({ message: "Prenotazione eliminata con successo" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getServiziPubblici = async (_req, res) => {
  try {
    const rows = await dbAll(
      `
        SELECT id, valore, nome, descrizione, prezzo, durata_minuti, badge, immagine, dettagli
        FROM servizi
        WHERE attivo = 1
        ORDER BY nome ASC
      `
    );

    res.json(rows.map((row) => ({
      id: row.id,
      valore: row.valore,
      nome: row.nome,
      descrizione: row.descrizione || "",
      prezzo: Number(row.prezzo),
      durataMinuti: row.durata_minuti,
      badge: row.badge || "",
      immagine: row.immagine || "",
      dettagli: row.dettagli ? String(row.dettagli).split("|").filter(Boolean) : []
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getContattiSalonePubblici = async (_req, res) => {
  try {
    const row = await dbGet(`SELECT * FROM contatti_salone WHERE id = 1`);
    res.json(serializzaContatti(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
