# MyBarber

Progetto web/mobile per la gestione di un salone da barbiere, composto da:

- `backend`: server Node.js/Express con database SQLite.
- `frontend`: applicazione Ionic/Angular.

Questa guida spiega come scaricare il progetto da GitHub per la prima volta e avviare sia database/backend sia sito/frontend.

## Requisiti

Prima di iniziare installa:

- Git
- Node.js 20 o superiore
- npm, incluso con Node.js

Per controllare le versioni:

```bash
node -v
npm -v
git --version
```

## 1. Scaricare il progetto

Clona il repository da GitHub:

```bash
git clone <URL_DEL_REPOSITORY>
cd MyBarberIONIC
```

Sostituisci `<URL_DEL_REPOSITORY>` con il link reale del repository GitHub.

## 2. Installare le dipendenze del backend

Apri un terminale nella cartella principale del progetto, poi esegui:

```bash
cd backend
npm install
```

In alternativa, se vuoi installare esattamente le versioni salvate nel `package-lock.json`:

```bash
npm ci
```

## 3. Configurare il backend

Sempre dentro la cartella `backend`, crea il file `.env` copiando la
configurazione di esempio:

```bash
cp .env.example .env
```

Su Windows, nel Prompt dei comandi, usa:

```bat
copy .env.example .env
```

La configurazione fornita avvia il progetto con l'invio delle email
disattivato. Le funzionalita principali restano disponibili.

## 4. Avviare backend e database

Sempre dentro la cartella `backend`, avvia il server:

```bash
npm start
```

Il backend parte su:

```text
http://localhost:3000
```

Al primo avvio viene creato automaticamente il database SQLite in:

```text
backend/db/database.sqlite
```

Il file del database non e' presente su GitHub perche' e' un file locale generato durante l'esecuzione. Il backend crea automaticamente le tabelle principali, tra cui utenti, prenotazioni, servizi, disponibilita, notifiche e contatti del salone.

Per verificare che il backend funzioni, apri nel browser:

```text
http://localhost:3000
```

Dovresti vedere un messaggio simile a:

```text
Il server e' attivo e funzionante!
```

## 5. Account di prova

Al primo avvio del backend vengono creati automaticamente i due account di
prova.

Credenziali amministratore/barbiere:

```text
Email: admin@mybarber.local
Password: Admin123!
```

Utente standard di esempio creato dal backend:

```text
mario@example.com / password1
```

## 6. Installare le dipendenze del frontend

Lascia il backend acceso nel primo terminale.

Apri un secondo terminale nella cartella principale del progetto, poi esegui:

```bash
cd frontend
npm install
```

Oppure:

```bash
npm ci
```

## 7. Avviare il sito

Sempre dentro la cartella `frontend`, avvia l'app Ionic/Angular:

```bash
npm start
```

Il sito parte di solito su:

```text
http://localhost:4200
```

Apri questo indirizzo nel browser.

Il frontend comunica con il backend tramite:

```text
http://localhost:3000
```

Quindi, per usare login, registrazione, prenotazioni e area barbiere, il backend deve restare acceso.
