# Collegare il modulo di registrazione (10 minuti, gratis)

Il sito su GitHub Pages è statico e non può salvare dati né mandare email da solo.
Per questo il modulo invia le risposte a un piccolo script Google (Apps Script).
Lo script:
- salva ogni iscrizione come riga di un Google Sheet (i dati restano nel vostro account Google);
- manda al partecipante l'email di conferma, con il riepilogo e l'eventuale abstract;
- facoltativo: manda una copia a un indirizzo degli organizzatori.

## 1. Crea il foglio e lo script
1. Su Google Drive crea un nuovo **Google Sheet** (es. "Registrazioni Reframing Glioblastoma").
   Conviene usare l'account dell'ente/progetto: le email di conferma partiranno da quell'indirizzo.
2. Nel foglio: **Estensioni → Apps Script**.
3. Cancella il contenuto di `Code.gs` e incolla tutto il file `registration-backend/Code.gs`.
4. In cima al file compila le impostazioni: `EVENT_DATE`, `SITE_URL`, `CONTACT_EMAIL`
   ed eventualmente `ORGANIZER_COPY`. Salva (icona del dischetto).

## 2. Pubblica lo script come web app
1. **Esegui il deployment → Nuovo deployment**. Come tipo scegli **App web**.
2. *Esegui come*: **Me**. *Chi può accedere*: **Chiunque**.
3. Clicca **Esegui il deployment** e autorizza: Google mostrerà un avviso "app non verificata",
   è normale per gli script personali. Clicca *Avanzate → Vai a … (non sicuro)* e consenti.
4. Copia l'**URL dell'app web** (finisce con `/exec`).
   Se lo apri nel browser deve comparire "Registration endpoint … is running".

## 3. Collega il sito
In `assets/register.js`, riga 6, incolla l'URL:
```js
const ENDPOINT = "https://script.google.com/macros/s/XXXXXXXX/exec";
```
Fai commit e push. Prova a registrarti con la tua email: deve comparire la riga nel foglio
e deve arrivarti la conferma.

## Da sapere
- **Se modifichi lo script**, le modifiche vanno online solo con
  *Esegui il deployment → Gestisci deployment → matita → Versione: Nuova versione*.
  L'URL resta lo stesso.
- **Limiti di invio di Google**: circa 100 email al giorno con un account Gmail gratuito,
  circa 1.500 con Google Workspace. Per un workshop di solito basta.
- **Doppie iscrizioni**: con la stessa email si può registrare al massimo 2 volte
  (`MAX_PER_EMAIL` in `Code.gs`), così chi ha sbagliato un dato può reinviare.
  La seconda riga ha "Yes" nella colonna "Already registered?". Dalla terza il modulo
  risponde che l'email è già stata usata.
- **Anti-bot**: oltre al campo trappola nascosto, vengono rifiutati gli invii fatti meno di
  4 secondi dopo l'apertura della pagina (`MIN_SECONDS`, uguale in `Code.gs` e in `assets/register.js`).
  A una persona, se succede, compare solo "controlla i dati e premi di nuovo Register".
- **Chiudere le iscrizioni**: svuota `ENDPOINT` in `register.js`, oppure archivia il deployment.
- **Privacy**: il modulo chiede il consenso al trattamento. Se l'ente ha un'informativa privacy,
  aggiungi il link nel testo della casella in `registration/index.html`.
