const bcrypt = require("bcrypt");
const db = require("../db/db");
const emailService = require("../services/emailService");

const DURATE_SERVIZI = {
  taglio: 30,
  sfumatura: 30,
  barba: 30,
  completo: 60,
  colore: 120
};

const PREZZI_SERVIZI = {
  taglio: 13,
  sfumatura: 16,
  barba: 7,
  completo: 18,
  colore: 55
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

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
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

function normalizzaServizio(servizio) {
  const valore = String(servizio || "").trim().toLowerCase();
  return ALIAS_SERVIZI[valore] || valore;
}

function slugify(valore) {
  return String(valore || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function formatDateInput(data) {
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, "0");
  const giorno = String(data.getDate()).padStart(2, "0");
  return `${anno}-${mese}-${giorno}`;
}

function dateRange(dataInizio, dataFine) {
  const inizio = parseDateInput(dataInizio);
  const fine = parseDateInput(dataFine || dataInizio);
  const giorni = [];

  for (const cursor = new Date(inizio); cursor <= fine; cursor.setDate(cursor.getDate() + 1)) {
    giorni.push(formatDateInput(cursor));
  }

  return giorni;
}

function giornoSettimana(data) {
  return parseDateInput(data).getDay();
}

function oggiInput() {
  return formatDateInput(new Date());
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

function oraInMinuti(ora) {
  const [ore, minuti] = String(ora || "").split(":").map(Number);
  return ore * 60 + minuti;
}

function minutiInOra(minutiTotali) {
  const ore = String(Math.floor(minutiTotali / 60)).padStart(2, "0");
  const minuti = String(minutiTotali % 60).padStart(2, "0");
  return `${ore}:${minuti}`;
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

function slotAllineato(ora) {
  const inizio = oraInMinuti(ora);

  return FINESTRE_APERTURA.some((finestra) => {
    const apertura = oraInMinuti(finestra.inizio);
    return inizio >= apertura && (inizio - apertura) % SLOT_STEP_MINUTI === 0;
  });
}

async function getServizioAttivo(servizio) {
  const servizioNormalizzato = normalizzaServizio(servizio);

  const servizioDb = await dbGet(
    `SELECT valore, nome, prezzo, durata_minuti FROM servizi WHERE valore = ? AND attivo = 1`,
    [servizioNormalizzato]
  );

  if (servizioDb) {
    return servizioDb;
  }

  if (!DURATE_SERVIZI[servizioNormalizzato]) {
    return null;
  }

  return {
    valore: servizioNormalizzato,
    nome: servizioNormalizzato,
    prezzo: PREZZI_SERVIZI[servizioNormalizzato] || 0,
    durata_minuti: DURATE_SERVIZI[servizioNormalizzato]
  };
}

function durataRiga(row) {
  return row.durata_minuti || row.servizio_durata || DURATE_SERVIZI[normalizzaServizio(row.servizio)] || 30;
}

function prezzoRiga(row) {
  return Number(row.servizio_prezzo ?? PREZZI_SERVIZI[normalizzaServizio(row.servizio)] ?? 0);
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

function serializzaPrenotazione(row) {
  const durataMinuti = durataRiga(row);
  const prezzo = prezzoRiga(row);

  return {
    id: row.id,
    user_id: row.user_id,
    data: row.data,
    ora: row.ora,
    oraFine: row.ora_fine || calcolaOraFine(row.ora, durataMinuti),
    durataMinuti,
    stato: row.stato || "confermata",
    servizio: row.servizio,
    servizioNome: row.servizio_nome || row.servizio,
    prezzo,
    note: row.note || "",
    cliente: {
      id: row.user_id,
      nome: row.cliente_nome || "",
      cognome: row.cliente_cognome || "",
      email: row.cliente_email || "",
      telefono: row.cliente_telefono || ""
    }
  };
}

function serializzaRegolaDisponibilita(row) {
  return {
    id: row.id,
    giornoSettimana: row.giorno_settimana,
    oraInizio: row.ora_inizio,
    oraFine: row.ora_fine,
    interaGiornata: !!row.intera_giornata,
    motivo: row.motivo || "",
    validaDal: row.valida_dal || "",
    validaAl: row.valida_al || "",
    attiva: row.attiva !== 0
  };
}

async function slotOccupato(data, ora, durataMinuti, excludeId = null) {
  const inizio = oraInMinuti(ora);
  const fine = inizio + durataMinuti;
  const params = [data, fine, inizio];
  const filtroId = excludeId ? "AND id != ?" : "";

  if (excludeId) {
    params.push(excludeId);
  }

  const row = await dbGet(
    `
      SELECT id
      FROM prenotazioni
      WHERE data = ?
        AND COALESCE(stato, 'confermata') != 'annullata'
        AND (
          CAST(substr(ora, 1, 2) AS INTEGER) * 60
          + CAST(substr(ora, 4, 2) AS INTEGER)
        ) < ?
        AND (
          CASE
            WHEN ora_fine IS NOT NULL AND ora_fine != '' THEN
              CAST(substr(ora_fine, 1, 2) AS INTEGER) * 60
              + CAST(substr(ora_fine, 4, 2) AS INTEGER)
            ELSE
              CAST(substr(ora, 1, 2) AS INTEGER) * 60
              + CAST(substr(ora, 4, 2) AS INTEGER)
              + COALESCE(durata_minuti, 30)
          END
        ) > ?
        ${filtroId}
      LIMIT 1
    `,
    params
  );

  return !!row;
}

async function prenotazioniInConflitto(giorni, oraInizio, oraFine) {
  if (giorni.length === 0) {
    return [];
  }

  const inizio = oraInMinuti(oraInizio);
  const fine = oraInMinuti(oraFine);
  const placeholders = giorni.map(() => "?").join(",");

  const rows = await dbAll(
    `
      SELECT
        p.*,
        u.nome AS cliente_nome,
        u.cognome AS cliente_cognome,
        u.email AS cliente_email,
        u.telefono AS cliente_telefono,
        s.nome AS servizio_nome,
        s.prezzo AS servizio_prezzo,
        s.durata_minuti AS servizio_durata
      FROM prenotazioni p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN servizi s ON s.valore = LOWER(TRIM(p.servizio))
      WHERE p.data IN (${placeholders})
        AND COALESCE(p.stato, 'confermata') != 'annullata'
        AND (
          CAST(substr(p.ora, 1, 2) AS INTEGER) * 60
          + CAST(substr(p.ora, 4, 2) AS INTEGER)
        ) < ?
        AND (
          CASE
            WHEN p.ora_fine IS NOT NULL AND p.ora_fine != '' THEN
              CAST(substr(p.ora_fine, 1, 2) AS INTEGER) * 60
              + CAST(substr(p.ora_fine, 4, 2) AS INTEGER)
            ELSE
              CAST(substr(p.ora, 1, 2) AS INTEGER) * 60
              + CAST(substr(p.ora, 4, 2) AS INTEGER)
              + COALESCE(p.durata_minuti, 30)
          END
        ) > ?
      ORDER BY p.data ASC, p.ora ASC
    `,
    [...giorni, fine, inizio]
  );

  return rows.map(serializzaPrenotazione);
}

async function blocchiEsistentiInConflitto(giorni, oraInizio, oraFine) {
  if (giorni.length === 0) {
    return [];
  }

  const inizio = oraInMinuti(oraInizio);
  const fine = oraInMinuti(oraFine);
  const placeholders = giorni.map(() => "?").join(",");

  return dbAll(
    `
      SELECT id, data, ora_inizio, ora_fine, intera_giornata, motivo
      FROM disponibilita_blocchi
      WHERE data IN (${placeholders})
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
    `,
    [...giorni, fine, inizio]
  );
}

function intervalloDisponibilita(disponibilita) {
  if (disponibilita.intera_giornata || disponibilita.interaGiornata) {
    return { inizio: 0, fine: oraInMinuti("23:59") };
  }

  return {
    inizio: oraInMinuti(disponibilita.ora_inizio || disponibilita.oraInizio),
    fine: oraInMinuti(disponibilita.ora_fine || disponibilita.oraFine)
  };
}

function sottraiIntervalli(intervallo, coperture) {
  return coperture
    .sort((a, b) => a.inizio - b.inizio)
    .reduce((scoperti, copertura) => {
      const prossimi = [];

      for (const scoperto of scoperti) {
        if (copertura.fine <= scoperto.inizio || copertura.inizio >= scoperto.fine) {
          prossimi.push(scoperto);
          continue;
        }

        if (copertura.inizio > scoperto.inizio) {
          prossimi.push({ inizio: scoperto.inizio, fine: Math.min(copertura.inizio, scoperto.fine) });
        }

        if (copertura.fine < scoperto.fine) {
          prossimi.push({ inizio: Math.max(copertura.fine, scoperto.inizio), fine: scoperto.fine });
        }
      }

      return prossimi;
    }, [intervallo])
    .filter((scoperto) => scoperto.fine > scoperto.inizio);
}

function fasceScoperteDaDisponibilita(giorni, disponibilita, oraInizio, oraFine, interaGiornata) {
  const inizio = oraInMinuti(oraInizio);
  const fine = oraInMinuti(oraFine);

  return giorni.flatMap((giorno) => {
    const coperture = disponibilita
      .filter((item) => item.data === giorno)
      .map(intervalloDisponibilita);
    const scoperti = sottraiIntervalli({ inizio, fine }, coperture);

    if (interaGiornata) {
      return scoperti.length === 0
        ? []
        : [{ data: giorno, oraInizio, oraFine, interaGiornata: true }];
    }

    return scoperti.map((scoperto) => ({
      data: giorno,
      oraInizio: minutiInOra(scoperto.inizio),
      oraFine: minutiInOra(scoperto.fine),
      interaGiornata: false
    }));
  });
}

async function prenotazioniInConflittoConFasce(fasce) {
  const conflittiById = new Map();

  for (const fascia of fasce) {
    const conflitti = await prenotazioniInConflitto([fascia.data], fascia.oraInizio, fascia.oraFine);

    for (const conflitto of conflitti) {
      conflittiById.set(conflitto.id, conflitto);
    }
  }

  return Array.from(conflittiById.values())
    .sort((a, b) => `${a.data} ${a.ora}`.localeCompare(`${b.data} ${b.ora}`));
}

async function regoleRicorrentiInConflittoConGiorni(giorni, oraInizio, oraFine) {
  const inizio = oraInMinuti(oraInizio);
  const fine = oraInMinuti(oraFine);
  const conflitti = [];

  for (const giorno of giorni) {
    const rows = await dbAll(
      `
        SELECT id, giorno_settimana, ora_inizio, ora_fine, intera_giornata, motivo, valida_dal, valida_al, attiva
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
      `,
      [giornoSettimana(giorno), giorno, giorno, fine, inizio]
    );

    conflitti.push(...rows.map((row) => ({
      ...serializzaRegolaDisponibilita(row),
      data: giorno
    })));
  }

  return conflitti;
}

async function regolaRicorrenteEsistenteInConflitto(giorno, oraInizio, oraFine, validaDal, validaAl) {
  const inizio = oraInMinuti(oraInizio);
  const fine = oraInMinuti(oraFine);
  const params = [giorno, fine, inizio, validaDal];
  const limiteFineNuova = validaAl ? "AND (valida_dal IS NULL OR valida_dal = '' OR valida_dal <= ?)" : "";

  if (validaAl) {
    params.push(validaAl);
  }

  return dbGet(
    `
      SELECT id
      FROM disponibilita_regole
      WHERE attiva = 1
        AND giorno_settimana = ?
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
        AND (valida_al IS NULL OR valida_al = '' OR valida_al >= ?)
        ${limiteFineNuova}
      LIMIT 1
    `,
    params
  );
}

async function prenotazioniInConflittoRicorrente(giorno, oraInizio, oraFine, validaDal, validaAl) {
  const inizio = oraInMinuti(oraInizio);
  const fine = oraInMinuti(oraFine);
  const params = [giorno, validaDal];
  const filtroValidaAl = validaAl ? "AND p.data <= ?" : "";

  if (validaAl) {
    params.push(validaAl);
  }

  params.push(fine, inizio);

  const rows = await dbAll(
    `
      SELECT
        p.*,
        u.nome AS cliente_nome,
        u.cognome AS cliente_cognome,
        u.email AS cliente_email,
        u.telefono AS cliente_telefono,
        s.nome AS servizio_nome,
        s.prezzo AS servizio_prezzo,
        s.durata_minuti AS servizio_durata
      FROM prenotazioni p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN servizi s ON s.valore = LOWER(TRIM(p.servizio))
      WHERE CAST(strftime('%w', p.data) AS INTEGER) = ?
        AND p.data >= ?
        ${filtroValidaAl}
        AND COALESCE(p.stato, 'confermata') != 'annullata'
        AND (
          CAST(substr(p.ora, 1, 2) AS INTEGER) * 60
          + CAST(substr(p.ora, 4, 2) AS INTEGER)
        ) < ?
        AND (
          CASE
            WHEN p.ora_fine IS NOT NULL AND p.ora_fine != '' THEN
              CAST(substr(p.ora_fine, 1, 2) AS INTEGER) * 60
              + CAST(substr(p.ora_fine, 4, 2) AS INTEGER)
            ELSE
              CAST(substr(p.ora, 1, 2) AS INTEGER) * 60
              + CAST(substr(p.ora, 4, 2) AS INTEGER)
              + COALESCE(p.durata_minuti, 30)
          END
        ) > ?
      ORDER BY p.data ASC, p.ora ASC
    `,
    params
  );

  return rows.map(serializzaPrenotazione);
}

async function notificaRiprogrammazione(conflitti, motivo) {
  for (const prenotazione of conflitti) {
    const notificaEsistente = await dbGet(
      `
        SELECT id
        FROM notifiche
        WHERE user_id = ?
          AND prenotazione_id = ?
          AND letta = 0
          AND titolo = 'Appuntamento da riprogrammare'
        LIMIT 1
      `,
      [prenotazione.user_id, prenotazione.id]
    );

    if (notificaEsistente) {
      continue;
    }

    await dbRun(
      `
        INSERT INTO notifiche (user_id, prenotazione_id, titolo, messaggio)
        VALUES (?, ?, ?, ?)
      `,
      [
        prenotazione.user_id,
        prenotazione.id,
        "Appuntamento da riprogrammare",
        `Il tuo appuntamento del ${prenotazione.data} alle ${prenotazione.ora} non e piu disponibile${motivo ? `: ${motivo}` : "."}. Scegli un nuovo giorno dalla tua area appuntamenti.`
      ]
    );

    emailService.inviaAvvisoDaRiprogrammare({
      utente: prenotazione.cliente,
      prenotazione,
      motivo
    }).catch((emailErr) => {
      console.error("Errore invio email appuntamento da riprogrammare:", emailErr.message);
    });
  }
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

async function clienteDaRichiesta(body) {
  const userId = Number(body.user_id || body.userId);

  if (userId) {
    const user = await dbGet(`SELECT id FROM users WHERE id = ? AND COALESCE(ruolo, 'user') != 'admin'`, [userId]);
    if (!user) {
      throw Object.assign(new Error("Cliente non trovato"), { status: 404 });
    }

    return user.id;
  }

  const cliente = body.cliente || {};
  const nome = String(cliente.nome || "").trim();
  const cognome = String(cliente.cognome || "").trim();
  const email = String(cliente.email || "").trim().toLowerCase();
  const telefono = String(cliente.telefono || "").trim();

  if (!nome || !cognome || !email || !telefono) {
    throw Object.assign(new Error("Cliente, email e telefono sono obbligatori"), { status: 400 });
  }

  const existingUser = await dbGet(`SELECT id, COALESCE(ruolo, 'user') AS ruolo FROM users WHERE email = ?`, [email]);

  if (existingUser) {
    if (existingUser.ruolo === "admin") {
      throw Object.assign(new Error("Non puoi prenotare per un account admin"), { status: 409 });
    }

    return existingUser.id;
  }

  const password = await bcrypt.hash(`Cliente-${Date.now()}!`, 10);
  const result = await dbRun(
    `INSERT INTO users (nome, cognome, email, password, telefono, ruolo) VALUES (?, ?, ?, ?, ?, 'user')`,
    [nome, cognome, email, password, telefono]
  );

  return result.id;
}

async function validaPrenotazione({ data, ora, servizio, excludeId = null }) {
  if (!data || !ora || !servizio) {
    throw Object.assign(new Error("Data, ora e servizio sono obbligatori"), { status: 400 });
  }

  if (!formatoDataValido(data) || !formatoOraValido(ora)) {
    throw Object.assign(new Error("Data o ora non valide"), { status: 400 });
  }

  const servizioConfigurato = await getServizioAttivo(servizio);

  if (!servizioConfigurato) {
    throw Object.assign(new Error("Servizio non valido"), { status: 400 });
  }

  const durataMinuti = servizioConfigurato.durata_minuti;
  const servizioNormalizzato = servizioConfigurato.valore;

  if (!slotDentroOrarioApertura(ora, durataMinuti) || !slotAllineato(ora)) {
    throw Object.assign(new Error("Slot non valido per gli orari del salone"), { status: 409 });
  }

  if (await slotBloccato(data, ora, durataMinuti)) {
    throw Object.assign(new Error("Questo slot e bloccato nella disponibilita"), { status: 409 });
  }

  if (await slotOccupato(data, ora, durataMinuti, excludeId)) {
    throw Object.assign(new Error("Questo slot si sovrappone a una prenotazione esistente"), { status: 409 });
  }

  return {
    servizioNormalizzato,
    durataMinuti,
    oraFine: calcolaOraFine(ora, durataMinuti)
  };
}

exports.getPrenotazioni = async (req, res) => {
  try {
    const { data, da, a } = req.query;
    const where = [];
    const params = [];

    if (data) {
      where.push("p.data = ?");
      params.push(data);
    }

    if (da) {
      where.push("p.data >= ?");
      params.push(da);
    }

    if (a) {
      where.push("p.data <= ?");
      params.push(a);
    }

    const rows = await dbAll(
      `
        SELECT
          p.*,
          u.nome AS cliente_nome,
          u.cognome AS cliente_cognome,
          u.email AS cliente_email,
          u.telefono AS cliente_telefono,
          s.nome AS servizio_nome,
          s.prezzo AS servizio_prezzo,
          s.durata_minuti AS servizio_durata
        FROM prenotazioni p
        LEFT JOIN users u ON u.id = p.user_id
        LEFT JOIN servizi s ON s.valore = LOWER(TRIM(p.servizio))
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY p.data ASC, p.ora ASC
      `,
      params
    );

    res.json(rows.map(serializzaPrenotazione));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.creaPrenotazione = async (req, res) => {
  try {
    const userId = await clienteDaRichiesta(req.body);
    const { data, ora, servizio, note } = req.body;
    const prenotazione = await validaPrenotazione({ data, ora, servizio });
    const result = await dbRun(
      `
        INSERT INTO prenotazioni (user_id, data, ora, ora_fine, durata_minuti, servizio, note, stato)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'confermata')
      `,
      [userId, data, ora, prenotazione.oraFine, prenotazione.durataMinuti, prenotazione.servizioNormalizzato, note || ""]
    );

    res.status(201).json({
      message: "Prenotazione creata",
      id: result.id,
      oraFine: prenotazione.oraFine,
      durataMinuti: prenotazione.durataMinuti
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, error: err.message });
  }
};

exports.updatePrenotazione = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await dbGet(`SELECT * FROM prenotazioni WHERE id = ?`, [id]);

    if (!existing) {
      return res.status(404).json({ message: "Prenotazione non trovata" });
    }

    const data = req.body.data || existing.data;
    const ora = req.body.ora || existing.ora;
    const servizio = req.body.servizio || existing.servizio;
    const note = req.body.note ?? existing.note;
    const userId = Number(req.body.user_id || req.body.userId || existing.user_id);
    const prenotazione = await validaPrenotazione({ data, ora, servizio, excludeId: id });

    await dbRun(
      `
        UPDATE prenotazioni
        SET user_id = ?, data = ?, ora = ?, ora_fine = ?, durata_minuti = ?, servizio = ?, note = ?, stato = 'confermata'
        WHERE id = ?
      `,
      [userId, data, ora, prenotazione.oraFine, prenotazione.durataMinuti, prenotazione.servizioNormalizzato, note || "", id]
    );

    await dbRun(
      `UPDATE notifiche SET letta = 1 WHERE prenotazione_id = ?`,
      [id]
    );

    res.json({ message: "Prenotazione aggiornata" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message, error: err.message });
  }
};

exports.deletePrenotazione = async (req, res) => {
  try {
    const result = await dbRun(`DELETE FROM prenotazioni WHERE id = ?`, [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Prenotazione non trovata" });
    }

    await dbRun(
      `UPDATE notifiche SET letta = 1 WHERE prenotazione_id = ?`,
      [req.params.id]
    );

    res.json({ message: "Prenotazione eliminata" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getClienti = async (req, res) => {
  try {
    const ricerca = String(req.query.search || "").trim().toLowerCase();
    const params = [];
    let filtroRicerca = "";

    if (ricerca) {
      filtroRicerca = `
        AND (
          LOWER(u.nome) LIKE ?
          OR LOWER(u.cognome) LIKE ?
          OR LOWER(u.email) LIKE ?
          OR LOWER(u.telefono) LIKE ?
        )
      `;
      const like = `%${ricerca}%`;
      params.push(like, like, like, like);
    }

    const rows = await dbAll(
      `
        SELECT
          u.id, u.nome, u.cognome, u.email, u.telefono, COALESCE(u.ruolo, 'user') AS ruolo,
          COUNT(p.id) AS totale_appuntamenti,
          MAX(p.data || ' ' || p.ora) AS ultimo_appuntamento
        FROM users u
        LEFT JOIN prenotazioni p ON p.user_id = u.id
        WHERE COALESCE(u.ruolo, 'user') != 'admin'
        ${filtroRicerca}
        GROUP BY u.id
        ORDER BY u.cognome ASC, u.nome ASC
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCliente = async (req, res) => {
  try {
    const cliente = await dbGet(
      `SELECT id, nome, cognome, email, telefono, COALESCE(ruolo, 'user') AS ruolo FROM users WHERE id = ?`,
      [req.params.id]
    );

    if (!cliente) {
      return res.status(404).json({ message: "Cliente non trovato" });
    }

    const prenotazioni = await dbAll(
      `
        SELECT p.*, s.nome AS servizio_nome, s.prezzo AS servizio_prezzo, s.durata_minuti AS servizio_durata
        FROM prenotazioni p
        LEFT JOIN servizi s ON s.valore = LOWER(TRIM(p.servizio))
        WHERE p.user_id = ?
        ORDER BY p.data DESC, p.ora DESC
      `,
      [req.params.id]
    );

    res.json({
      cliente,
      prenotazioni: prenotazioni.map((row) => serializzaPrenotazione({
        ...row,
        cliente_nome: cliente.nome,
        cliente_cognome: cliente.cognome,
        cliente_email: cliente.email,
        cliente_telefono: cliente.telefono
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDisponibilita = async (req, res) => {
  try {
    const params = [oggiInput()];
    let filtro = "WHERE data >= ?";

    if (req.query.data) {
      filtro += " AND data = ?";
      params.push(req.query.data);
    }

    const rows = await dbAll(
      `
        SELECT id, data, ora_inizio AS oraInizio, ora_fine AS oraFine, intera_giornata AS interaGiornata, motivo
        FROM disponibilita_blocchi
        ${filtro}
        ORDER BY data DESC, ora_inizio ASC
      `,
      params
    );

    res.json(rows.map((row) => ({
      ...row,
      interaGiornata: !!row.interaGiornata
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.creaDisponibilita = async (req, res) => {
  try {
    const data = req.body.data;
    const dataFine = req.body.dataFine || req.body.data_fine || data;
    const interaGiornata = !!req.body.interaGiornata || !!req.body.intera_giornata;
    const oraInizio = interaGiornata ? "00:00" : (req.body.oraInizio || req.body.ora_inizio);
    const oraFine = interaGiornata ? "23:59" : (req.body.oraFine || req.body.ora_fine);
    const motivo = String(req.body.motivo || "").trim();
    const confermaRiprogrammazione = !!req.body.confermaRiprogrammazione || !!req.body.conferma_riprogrammazione;

    if (!formatoDataValido(data) || !formatoDataValido(dataFine) || !formatoOraValido(oraInizio) || !formatoOraValido(oraFine)) {
      return res.status(400).json({ message: "Data o orari non validi" });
    }

    if (parseDateInput(dataFine) < parseDateInput(data)) {
      return res.status(400).json({ message: "La data di fine deve essere successiva o uguale alla data di inizio" });
    }

    if (parseDateInput(data) < parseDateInput(oggiInput())) {
      return res.status(400).json({ message: "Non puoi creare blocchi in date passate" });
    }

    if (oraInMinuti(oraFine) <= oraInMinuti(oraInizio)) {
      return res.status(400).json({ message: "L'orario di fine deve essere successivo all'inizio" });
    }

    const giorni = dateRange(data, dataFine);
    const blocchiInConflitto = await blocchiEsistentiInConflitto(giorni, oraInizio, oraFine);
    const regoleInConflitto = await regoleRicorrentiInConflittoConGiorni(giorni, oraInizio, oraFine);
    const fasceDaBloccare = fasceScoperteDaDisponibilita(
      giorni,
      [...blocchiInConflitto, ...regoleInConflitto],
      oraInizio,
      oraFine,
      interaGiornata
    );

    const conflitti = await prenotazioniInConflittoConFasce(fasceDaBloccare);

    if (conflitti.length > 0 && !confermaRiprogrammazione) {
      return res.status(409).json({
        message: `Ci sono ${conflitti.length} prenotazioni nel periodo selezionato.`,
        requiresConfirmation: true,
        conflitti
      });
    }

    const blocchiCreati = [];

    for (const fascia of fasceDaBloccare) {
      const result = await dbRun(
        `
          INSERT INTO disponibilita_blocchi (data, ora_inizio, ora_fine, intera_giornata, motivo)
          VALUES (?, ?, ?, ?, ?)
        `,
        [fascia.data, fascia.oraInizio, fascia.oraFine, fascia.interaGiornata ? 1 : 0, motivo]
      );

      blocchiCreati.push({ id: result.id, data: fascia.data, oraInizio: fascia.oraInizio, oraFine: fascia.oraFine });
    }

    if (conflitti.length > 0) {
      const ids = conflitti.map((prenotazione) => prenotazione.id);
      const placeholders = ids.map(() => "?").join(",");

      await dbRun(
        `UPDATE prenotazioni SET stato = 'da_riprogrammare' WHERE id IN (${placeholders})`,
        ids
      );

      await notificaRiprogrammazione(conflitti, motivo || "chiusura del salone");
    }

    res.status(201).json({
      message: conflitti.length > 0
        ? "Disponibilita bloccata e clienti notificati per riprogrammare"
        : blocchiCreati.length > 0
          ? "Disponibilita bloccata"
          : "Il periodo selezionato era gia coperto da blocchi o regole ricorrenti",
      id: blocchiCreati[0]?.id,
      creati: blocchiCreati.length,
      ignorati: giorni.length - new Set(blocchiCreati.map((blocco) => blocco.data)).size,
      blocchi: blocchiCreati,
      conflitti: conflitti.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDisponibilita = async (req, res) => {
  try {
    const result = await dbRun(`DELETE FROM disponibilita_blocchi WHERE id = ?`, [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Blocco non trovato" });
    }

    res.json({ message: "Blocco rimosso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDisponibilitaRicorrente = async (_req, res) => {
  try {
    const rows = await dbAll(
      `
        SELECT id, giorno_settimana, ora_inizio, ora_fine, intera_giornata, motivo, valida_dal, valida_al, attiva
        FROM disponibilita_regole
        WHERE attiva = 1
          AND (valida_al IS NULL OR valida_al >= ?)
        ORDER BY giorno_settimana ASC, ora_inizio ASC
      `,
      [oggiInput()]
    );

    res.json(rows.map(serializzaRegolaDisponibilita));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.creaDisponibilitaRicorrente = async (req, res) => {
  try {
    const giorno = Number(req.body.giornoSettimana ?? req.body.giorno_settimana);
    const interaGiornata = !!req.body.interaGiornata || !!req.body.intera_giornata;
    const oraInizio = interaGiornata ? "00:00" : (req.body.oraInizio || req.body.ora_inizio);
    const oraFine = interaGiornata ? "23:59" : (req.body.oraFine || req.body.ora_fine);
    const motivo = String(req.body.motivo || "").trim();
    const validaDal = req.body.validaDal || req.body.valida_dal || oggiInput();
    const validaAl = req.body.validaAl || req.body.valida_al || "";
    const confermaRiprogrammazione = !!req.body.confermaRiprogrammazione || !!req.body.conferma_riprogrammazione;

    if (!Number.isInteger(giorno) || giorno < 0 || giorno > 6) {
      return res.status(400).json({ message: "Giorno della settimana non valido" });
    }

    if (!formatoOraValido(oraInizio) || !formatoOraValido(oraFine) || !formatoDataValido(validaDal)) {
      return res.status(400).json({ message: "Data o orari non validi" });
    }

    if (validaAl && !formatoDataValido(validaAl)) {
      return res.status(400).json({ message: "Data fine validita non valida" });
    }

    if (validaAl && parseDateInput(validaAl) < parseDateInput(validaDal)) {
      return res.status(400).json({ message: "La data fine validita deve essere successiva o uguale alla data iniziale" });
    }

    if (parseDateInput(validaDal) < parseDateInput(oggiInput())) {
      return res.status(400).json({ message: "Non puoi creare regole ricorrenti con inizio nel passato" });
    }

    if (validaAl && parseDateInput(validaAl) < parseDateInput(oggiInput())) {
      return res.status(400).json({ message: "La data fine validita non puo essere nel passato" });
    }

    if (oraInMinuti(oraFine) <= oraInMinuti(oraInizio)) {
      return res.status(400).json({ message: "L'orario di fine deve essere successivo all'inizio" });
    }

    const regolaEsistente = await regolaRicorrenteEsistenteInConflitto(giorno, oraInizio, oraFine, validaDal, validaAl);

    if (regolaEsistente) {
      return res.status(409).json({ message: "Esiste gia una regola ricorrente su questa fascia" });
    }

    const conflitti = await prenotazioniInConflittoRicorrente(giorno, oraInizio, oraFine, validaDal, validaAl);

    if (conflitti.length > 0 && !confermaRiprogrammazione) {
      return res.status(409).json({
        message: `Ci sono ${conflitti.length} prenotazioni nel giorno ricorrente selezionato.`,
        requiresConfirmation: true,
        conflitti
      });
    }

    const result = await dbRun(
      `
        INSERT INTO disponibilita_regole (giorno_settimana, ora_inizio, ora_fine, intera_giornata, motivo, valida_dal, valida_al)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [giorno, oraInizio, oraFine, interaGiornata ? 1 : 0, motivo, validaDal, validaAl || null]
    );

    if (conflitti.length > 0) {
      const ids = conflitti.map((prenotazione) => prenotazione.id);
      const placeholders = ids.map(() => "?").join(",");

      await dbRun(
        `UPDATE prenotazioni SET stato = 'da_riprogrammare' WHERE id IN (${placeholders})`,
        ids
      );

      await notificaRiprogrammazione(conflitti, motivo || "chiusura ricorrente del salone");
    }

    res.status(201).json({
      message: conflitti.length > 0
        ? "Regola ricorrente salvata e clienti notificati per riprogrammare"
        : "Regola ricorrente salvata",
      id: result.id,
      conflitti: conflitti.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDisponibilitaRicorrente = async (req, res) => {
  try {
    const result = await dbRun(`DELETE FROM disponibilita_regole WHERE id = ?`, [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Regola ricorrente non trovata" });
    }

    res.json({ message: "Regola ricorrente rimossa" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getContattiSalone = async (_req, res) => {
  try {
    const row = await dbGet(`SELECT * FROM contatti_salone WHERE id = 1`);
    res.json(serializzaContatti(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateContattiSalone = async (req, res) => {
  try {
    const nome = String(req.body.nome || "MyBarber").trim();
    const indirizzo = String(req.body.indirizzo || "").trim();
    const telefono = String(req.body.telefono || "").trim();
    const email = String(req.body.email || "").trim();
    const orari = Array.isArray(req.body.orari)
      ? req.body.orari.map((riga) => String(riga || "").trim()).filter(Boolean).join("|")
      : String(req.body.orari || "").split("\n").map((riga) => riga.trim()).filter(Boolean).join("|");
    const latitudine = Number(req.body.latitudine);
    const longitudine = Number(req.body.longitudine);
    const mapsUrl = String(req.body.mapsUrl || req.body.maps_url || "").trim();
    const instagramUrl = String(req.body.instagramUrl || req.body.instagram_url || "").trim();
    const facebookUrl = String(req.body.facebookUrl || req.body.facebook_url || "").trim();
    const tiktokUrl = String(req.body.tiktokUrl || req.body.tiktok_url || "").trim();

    if (!nome || !indirizzo || !telefono || !email || !orari) {
      return res.status(400).json({ message: "Nome, indirizzo, telefono, email e orari sono obbligatori" });
    }

    if (!Number.isFinite(latitudine) || !Number.isFinite(longitudine)) {
      return res.status(400).json({ message: "Coordinate mappa non valide" });
    }

    await dbRun(
      `
        INSERT INTO contatti_salone
          (id, nome, indirizzo, telefono, email, orari, latitudine, longitudine, maps_url, instagram_url, facebook_url, tiktok_url, updated_at)
        VALUES
          (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          nome = excluded.nome,
          indirizzo = excluded.indirizzo,
          telefono = excluded.telefono,
          email = excluded.email,
          orari = excluded.orari,
          latitudine = excluded.latitudine,
          longitudine = excluded.longitudine,
          maps_url = excluded.maps_url,
          instagram_url = excluded.instagram_url,
          facebook_url = excluded.facebook_url,
          tiktok_url = excluded.tiktok_url,
          updated_at = CURRENT_TIMESTAMP
      `,
      [nome, indirizzo, telefono, email, orari, latitudine, longitudine, mapsUrl, instagramUrl, facebookUrl, tiktokUrl]
    );

    const row = await dbGet(`SELECT * FROM contatti_salone WHERE id = 1`);
    res.json({ message: "Contatti salone aggiornati", contatti: serializzaContatti(row) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getServizi = async (_req, res) => {
  try {
    const rows = await dbAll(
      `
        SELECT id, valore, nome, descrizione, prezzo, durata_minuti AS durataMinuti, badge, immagine, dettagli, attivo
        FROM servizi
        ORDER BY attivo DESC, nome ASC
      `
    );

    res.json(rows.map((row) => ({
      ...row,
      attivo: !!row.attivo,
      dettagli: row.dettagli ? String(row.dettagli).split("|").filter(Boolean) : []
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.creaServizio = async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const valore = slugify(req.body.valore || nome);
    const prezzo = Number(req.body.prezzo);
    const durataMinuti = Number(req.body.durataMinuti || req.body.durata_minuti);
    const dettagli = Array.isArray(req.body.dettagli)
      ? req.body.dettagli.join("|")
      : String(req.body.dettagli || "");

    if (!nome || !valore || !Number.isFinite(prezzo) || !Number.isFinite(durataMinuti) || durataMinuti <= 0) {
      return res.status(400).json({ message: "Nome, prezzo e durata sono obbligatori" });
    }

    const result = await dbRun(
      `
        INSERT INTO servizi (valore, nome, descrizione, prezzo, durata_minuti, badge, immagine, dettagli, attivo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        valore,
        nome,
        req.body.descrizione || "",
        prezzo,
        durataMinuti,
        req.body.badge || "",
        req.body.immagine || "",
        dettagli
      ]
    );

    res.status(201).json({ message: "Servizio creato", id: result.id, valore });
  } catch (err) {
    res.status(err.message.includes("UNIQUE") ? 409 : 500).json({ message: "Servizio non salvato", error: err.message });
  }
};

exports.updateServizio = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await dbGet(`SELECT * FROM servizi WHERE id = ?`, [id]);

    if (!existing) {
      return res.status(404).json({ message: "Servizio non trovato" });
    }

    const dettagli = Array.isArray(req.body.dettagli)
      ? req.body.dettagli.join("|")
      : String(req.body.dettagli ?? existing.dettagli ?? "");
    const nome = String(req.body.nome ?? existing.nome ?? "").trim();
    const prezzo = Number(req.body.prezzo ?? existing.prezzo);
    const durataMinuti = Number(req.body.durataMinuti ?? req.body.durata_minuti ?? existing.durata_minuti);

    if (!nome || !Number.isFinite(prezzo) || prezzo < 0 || !Number.isFinite(durataMinuti) || durataMinuti <= 0) {
      return res.status(400).json({ message: "Nome, prezzo e durata validi sono obbligatori" });
    }

    await dbRun(
      `
        UPDATE servizi
        SET nome = ?, descrizione = ?, prezzo = ?, durata_minuti = ?, badge = ?, immagine = ?, dettagli = ?, attivo = ?
        WHERE id = ?
      `,
      [
        nome,
        req.body.descrizione ?? existing.descrizione,
        prezzo,
        durataMinuti,
        req.body.badge ?? existing.badge,
        req.body.immagine ?? existing.immagine,
        dettagli,
        req.body.attivo === undefined ? existing.attivo : (req.body.attivo ? 1 : 0),
        id
      ]
    );

    res.json({ message: "Servizio aggiornato" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteServizio = async (req, res) => {
  try {
    const result = await dbRun(`UPDATE servizi SET attivo = 0 WHERE id = ?`, [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Servizio non trovato" });
    }

    res.json({ message: "Servizio disattivato" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStatistiche = async (_req, res) => {
  try {
    const today = new Date();
    const yyyyMmDd = (date) => {
      const anno = date.getFullYear();
      const mese = String(date.getMonth() + 1).padStart(2, "0");
      const giorno = String(date.getDate()).padStart(2, "0");
      return `${anno}-${mese}-${giorno}`;
    };

    const inizioSettimana = new Date(today);
    inizioSettimana.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const inizioMese = new Date(today.getFullYear(), today.getMonth(), 1);
    const quattordiciGiorniFa = new Date(today);
    quattordiciGiorniFa.setDate(today.getDate() - 13);

    const prezzoSql = `
      COALESCE(
        s.prezzo,
        CASE LOWER(TRIM(p.servizio))
          WHEN 'taglio' THEN 13
          WHEN 'sfumatura' THEN 16
          WHEN 'barba' THEN 7
          WHEN 'completo' THEN 18
          WHEN 'colore' THEN 55
          ELSE 0
        END
      )
    `;
    const soloConfermateSql = "COALESCE(p.stato, 'confermata') = 'confermata'";

    const riepilogo = async (where, params) => dbGet(
      `
        SELECT COUNT(p.id) AS appuntamenti, COALESCE(SUM(${prezzoSql}), 0) AS incasso
        FROM prenotazioni p
        LEFT JOIN servizi s ON s.valore = LOWER(TRIM(p.servizio))
        WHERE ${where}
          AND ${soloConfermateSql}
      `,
      params
    );

    const [oggi, settimana, mese, serviziRichiesti, clientiFrequenti, andamento] = await Promise.all([
      riepilogo("p.data = ?", [yyyyMmDd(today)]),
      riepilogo("p.data >= ?", [yyyyMmDd(inizioSettimana)]),
      riepilogo("p.data >= ?", [yyyyMmDd(inizioMese)]),
      dbAll(
        `
          SELECT p.servizio, COALESCE(s.nome, p.servizio) AS nome, COUNT(*) AS totale, COALESCE(SUM(${prezzoSql}), 0) AS incasso
          FROM prenotazioni p
          LEFT JOIN servizi s ON s.valore = LOWER(TRIM(p.servizio))
          WHERE ${soloConfermateSql}
          GROUP BY p.servizio, s.nome
          ORDER BY totale DESC
          LIMIT 8
        `
      ),
      dbAll(
        `
          SELECT u.id, u.nome, u.cognome, u.telefono, COUNT(p.id) AS totale
          FROM prenotazioni p
          JOIN users u ON u.id = p.user_id
          WHERE ${soloConfermateSql}
          GROUP BY u.id
          ORDER BY totale DESC
          LIMIT 8
        `
      ),
      dbAll(
        `
          SELECT p.data, COUNT(*) AS appuntamenti, COALESCE(SUM(${prezzoSql}), 0) AS incasso
          FROM prenotazioni p
          LEFT JOIN servizi s ON s.valore = LOWER(TRIM(p.servizio))
          WHERE p.data >= ?
            AND ${soloConfermateSql}
          GROUP BY p.data
          ORDER BY p.data ASC
        `,
        [yyyyMmDd(quattordiciGiorniFa)]
      )
    ]);

    res.json({
      oggi,
      settimana,
      mese,
      serviziRichiesti,
      clientiFrequenti,
      andamento
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
