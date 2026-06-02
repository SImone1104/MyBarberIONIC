# MyBarberIONIC

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

## 3. Avviare backend e database

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

## 4. Creare o aggiornare l'admin

Il progetto contiene uno script per creare o aggiornare l'utente amministratore/barbiere.

Da dentro la cartella `backend` esegui:

```bash
npm run seed:admin
```

Credenziali admin predefinite:

```text
Email: admin@mybarber.local
Password: Admin123!
```

Utenti di esempio creati dal backend:

```text
mario@example.com / password1
lucia@example.com / password2
```

## 5. Installare le dipendenze del frontend

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

## 6. Avviare il sito

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

## Avvio rapido dopo la prima installazione

Dopo aver installato tutto una volta, per riaprire il progetto servono solo due terminali.

Terminale 1:

```bash
cd backend
npm start
```

Terminale 2:

```bash
cd frontend
npm start
```

Poi apri:

```text
http://localhost:4200
```

## Problemi comuni

### Il frontend non comunica con il backend

Controlla che il backend sia acceso su:

```text
http://localhost:3000
```

Il frontend usa `http://localhost:3000` come indirizzo del server API.

### Porta 3000 gia' occupata

Se il backend non parte perche' la porta 3000 e' occupata, chiudi l'altro processo che la sta usando oppure avvia il backend con un'altra porta:

```bash
$env:PORT=3001
npm start
```

Se cambi porta, devi aggiornare anche l'indirizzo del backend nel frontend, nel file:

```text
frontend/src/app/http-int-interceptor.ts
```

### Porta 4200 gia' occupata

Puoi avviare il frontend su un'altra porta:

```bash
npm start -- --port 4201
```

### Voglio ricreare il database da zero

Spegni il backend, elimina il file:

```text
backend/db/database.sqlite
```

Poi riavvia:

```bash
cd backend
npm start
```

Il database verra' ricreato automaticamente.

## Struttura principale

```text
MyBarberIONIC/
  backend/
    server.js
    db/
      db.js
      database.sqlite      # generato localmente, non salvato su GitHub
    scripts/
      seedAdmin.js
  frontend/
    src/
    package.json
  README.md
```

## Comandi utili

Backend:

```bash
cd backend
npm start
npm run seed:admin
```

Frontend:

```bash
cd frontend
npm start
npm run build
```
