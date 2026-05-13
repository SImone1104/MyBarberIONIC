export type ServizioOfferto = {
  valore: string;
  nome: string;
  descrizione: string;
  prezzo: string;
  badge: string;
  durataMinuti: number;
  immagine: string;
  dettagli: string[];
};

export const SERVIZI_OFFERTI: ServizioOfferto[] = [
  {
    valore: 'taglio',
    nome: 'Taglio',
    descrizione: 'Linee pulite, rifinitura precisa e styling finale.',
    prezzo: '13€',
    badge: 'Classico',
    durataMinuti: 30,
    immagine: 'assets/services/taglio-classico.png',
    dettagli: ['Consulenza stile', 'Rifinitura collo', 'Styling incluso']
  },
  {
    valore: 'sfumatura',
    nome: 'Taglio e shampoo',
    descrizione: 'Fade basso, medio o alto con dettagli netti e naturali.',
    prezzo: '16€',
    badge: 'Trend',
    durataMinuti: 30,
    immagine: 'assets/services/sfumatura.png',
    dettagli: ['Fade personalizzato', 'Controllo simmetria', 'Finish opaco']
  },
  {
    valore: 'barba',
    nome: 'Barba',
    descrizione: 'Modellatura barba, panno caldo e prodotti dedicati.',
    prezzo: '7€',
    badge: 'Relax',
    durataMinuti: 30,
    immagine: 'assets/services/barba.png',
    dettagli: ['Panno caldo', 'Olio barba', 'Rasatura contorni']
  },
  {
    valore: 'completo',
    nome: 'Taglio e Barba',
    descrizione: 'Servizio completo per un look ordinato e curato.',
    prezzo: '18€',
    badge: 'Completo',
    durataMinuti: 60,
    immagine: 'assets/services/taglio-barba.png',
    dettagli: ['Taglio su misura', 'Barba completa', 'Styling finale']
  },
  {
    valore: 'colore',
    nome: 'Taglio + colore',
    descrizione: 'Taglio, applicazione colore e finitura completa.',
    prezzo: '55€',
    badge: 'Premium',
    durataMinuti: 120,
    immagine: 'assets/services/colore.png',
    dettagli: ['Consulenza colore', 'Applicazione tecnica', 'Finish protettivo']
  }
];

export function servizioByValore(valore: string): ServizioOfferto | undefined {
  return SERVIZI_OFFERTI.find((servizio) => servizio.valore === valore);
}

export function normalizzaServizioApi(servizio: any): ServizioOfferto {
  return {
    valore: servizio.valore,
    nome: servizio.nome,
    descrizione: servizio.descrizione || '',
    prezzo: typeof servizio.prezzo === 'number' ? `${servizio.prezzo}€` : String(servizio.prezzo || ''),
    badge: servizio.badge || '',
    durataMinuti: Number(servizio.durataMinuti || servizio.durata_minuti || 30),
    immagine: servizio.immagine || '',
    dettagli: Array.isArray(servizio.dettagli)
      ? servizio.dettagli
      : String(servizio.dettagli || '').split('|').filter(Boolean)
  };
}
