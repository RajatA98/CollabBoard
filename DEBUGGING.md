# Debugging the AI Assistant (internal error, traces, Docker)

## 1. Fix the "internal error" — see the real error

When the AI Assistant fails, Firebase callable functions surface it as a generic **internal error**. The real cause is now logged server-side.

- **Local (emulator):** Check the terminal where `firebase emulators:start --only functions` (or Docker) is running. Look for:
  ```text
  [aiCommand] runAgent failed: <actual error message> <stack>
  ```
- **Deployed:** In [Firebase Console](https://console.firebase.google.com) → your project → Functions → Logs. Search for `[aiCommand]` or the error message.

When the **emulator** is running (`FUNCTIONS_EMULATOR=true`), the client also receives a short error message that includes the real cause (e.g. missing API key, rate limit, tool error). In production the client only sees a generic message; use logs or Langfuse for details.

---

## 2. Environment variables and .env format

The AI command runs in Cloud Functions and needs:

- `ANTHROPIC_API_KEY` — required for the model.
- **Langfuse (traces):** `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, and either `LANGFUSE_HOST` or `LANGFUSE_BASE_URL` (e.g. `https://us.cloud.langfuse.com`).

Use **no spaces** around `=` in `.env`. Wrong vs right:

```bash
# Wrong (key can be read as "LANGFUSE_SECRET_KEY " and break)
LANGFUSE_SECRET_KEY = "sk-lf-..."

# Right
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

The code accepts either `LANGFUSE_HOST` or `LANGFUSE_BASE_URL` for the Langfuse server URL.

---

## 3. Viewing traces (Langfuse)

Traces are sent to **Langfuse** from `functions/src/lib/observability.ts` (not LangSmith; the agent uses the Anthropic SDK directly).

1. Set in `.env` (no spaces around `=`):
   - `LANGFUSE_SECRET_KEY=...`
   - `LANGFUSE_PUBLIC_KEY=...`
   - `LANGFUSE_BASE_URL=https://us.cloud.langfuse.com` (or your self-hosted URL)

2. Run the AI Assistant (locally or deployed). Each `aiCommand` call creates a trace named `board-ai-command` with input, tool spans, token usage, and errors.

3. **How to check Langfuse (step by step):**
   - Open **[https://us.cloud.langfuse.com](https://us.cloud.langfuse.com)** in your browser (or your `LANGFUSE_BASE_URL` if self-hosted).
   - **Sign in** (or create an account; use the same org/project that your `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` belong to).
   - In the left sidebar, go to **Traces** (or **Generations**).
   - You’ll see a list of traces. Each AI Assistant run appears as a trace named **`board-ai-command`**.
   - **Click a trace** to open it. You’ll see:
     - **Input:** the user command and `boardId` / `userId`
     - **Spans:** each tool call (e.g. `getBoardState`, `createStickyNote`) and its result or error
     - **Output / metadata:** token usage, `totalInputTokens`, `totalOutputTokens`, and if it failed, **error** or **status: "error"**
   - To find a failed run: look for traces with status **Error** or with **output.error** in the details. You can filter by trace name `board-ai-command` or by metadata (e.g. your `boardId`) to narrow it down.

**LangSmith:** The repo has a `langsmith` dependency but the current agent does not use the LangChain/LangSmith SDK; traces go to Langfuse. To use LangSmith you’d need to add instrumentation (e.g. LangChain with LangSmith tracing) alongside or instead of the current observability layer.

### No traces in production (deployed function)

If you see **"Check function logs or Langfuse for details"** and **no traces in Langfuse**, the app is calling the **deployed** function. The deployed function does not read your local `.env`; it needs keys from Firebase/Google Cloud.

The function is configured to use **Firebase params**: secrets for API keys and a string for the Langfuse URL. You must set those so production can send traces and call the AI:

1. **Create secrets in Firebase (one-time)**  
   From the repo root, with the Firebase CLI logged in (`firebase login`):

   ```bash
   # Create secrets — run each command alone; you will be prompted to paste the value (do not pass the value on the command line)
   firebase functions:secrets:set ANTHROPIC_API_KEY
   firebase functions:secrets:set LANGFUSE_SECRET_KEY
   firebase functions:secrets:set LANGFUSE_PUBLIC_KEY
   ```

   For each command, when prompted, paste the value from your `.env` and press Enter.

2. **Optional: Langfuse URL**  
   The function uses `LANGFUSE_BASE_URL` with default `https://us.cloud.langfuse.com`. To override (e.g. self-hosted), create a param file and set it:

   ```bash
   # In functions/.env.projectId (created on first deploy) or set when prompted
   LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
   ```

3. **Redeploy the function**  
   After secrets exist, deploy so the function uses them:

   ```bash
   firebase deploy --only functions
   ```

4. **Verify**  
   Use the AI Assistant again in the live app. Traces should appear in Langfuse within a few seconds. If they don’t, check Firebase Functions logs for `[aiCommand]` and any Langfuse/Anthropic errors.

---

## 4. Running with Docker (emulator + your .env) — step by step

Docker runs the **Functions emulator** with env vars from your `.env` (Anthropic, Langfuse, etc.).

### Step 1: Prerequisites

- **Docker** installed (Docker Desktop or Engine).
- **`.env`** at the **repo root** with no spaces around `=`:
  - `ANTHROPIC_API_KEY=...`
  - `LANGFUSE_SECRET_KEY=...`, `LANGFUSE_PUBLIC_KEY=...`, `LANGFUSE_BASE_URL=https://us.cloud.langfuse.com`
  - Your `VITE_*` Firebase vars (same as for the app).

### Step 2: Open a terminal at the repo root

```bash
cd /path/to/CollabBoard   # your repo root (where firebase.json and docker-compose.yml are)
```

### Step 3: Build and start the emulator in Docker

```bash
docker compose up --build
```

- First time: builds the image (Node 24, Firebase CLI, installs and builds `functions/`), then starts the emulator.
- The Functions emulator listens on **port 5001**.
- All log output from the emulator (including `[aiCommand] runAgent failed: ...`) appears in this terminal.

Leave this terminal running.

### Step 4: Point the app at the emulator

In **another terminal**:

1. Create or edit `CollabBoard/.env` and add:
   ```bash
   VITE_USE_FUNCTIONS_EMULATOR=true
   ```
   (Or add that line to your repo-root `.env` and run the frontend from the repo root with env loaded.)

2. Start the frontend:
   ```bash
   cd CollabBoard
   npm run dev
   ```

3. In the browser, open the app (e.g. `http://localhost:5173`), sign in, open a board, and use the **AI Assistant**.

### Step 5: Where to “see” everything in Docker

| What you want to see | Where |
|----------------------|--------|
| **Emulator logs** (including real AI errors) | The terminal where `docker compose up --build` is running. Look for `[aiCommand] runAgent failed:` and stack traces. |
| **Traces** (inputs, tools, tokens, errors) | [Langfuse](https://us.cloud.langfuse.com) → Traces; filter by name `board-ai-command` or by `boardId` / `userId`. |
| **Stop Docker** | In the `docker compose up` terminal: `Ctrl+C`. Then `docker compose down` if you want to remove the container. |

### Optional: Rebuild after changing `functions/` code

```bash
docker compose up --build
```

To develop without rebuilding every time, you can uncomment the `volumes` section in `docker-compose.yml` (mount `./functions` into the container) and run `npm run build` inside the container when you change code.

---

## 5. "Can't connect to server" — troubleshooting

If the app can't reach the Functions emulator (e.g. AI Assistant fails to connect or Safari says the server dropped the connection):

1. **Use the app, not the emulator URL in the browser**  
   Don’t open `http://127.0.0.1:5001` in a browser. Open your app at `http://localhost:5173` and use the AI Assistant there. The app talks to the emulator in the background.

2. **Confirm emulator mode and env**  
   - In `CollabBoard/.env` (or wherever the frontend loads env), set:
     ```bash
     VITE_USE_FUNCTIONS_EMULATOR=true
     ```
   - Restart the dev server (`npm run dev`) after changing env so the variable is picked up.

3. **Check that the emulator is running and loaded**  
   In the terminal where you ran `docker compose up --build`, you should see:
   - `✔  functions: Loaded functions definitions from source: aiCommand.`
   - `✔  All emulators ready!`  
   If you see `Failed to load function definition`, the emulator won’t serve the AI correctly — fix that first (e.g. rebuild with the lazy Firestore fix).

4. **Test from the host**  
   In a terminal on your Mac (not inside Docker), run:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5001
   ```
   You should get a response (e.g. `400` or `404`), not "Connection refused". If it’s refused, Docker may not be running or port 5001 isn’t mapped.

5. **Try the emulator on the host (no Docker)**  
   If Docker networking is the issue, run the emulator locally:
   ```bash
   cd /path/to/CollabBoard
   export $(grep -v '^#' .env | xargs)   # load .env (no spaces around = in .env)
   firebase emulators:start --only functions
   ```
   Keep the app’s `VITE_USE_FUNCTIONS_EMULATOR=true` and use the AI Assistant again. If it works here, the problem is Docker/network.

6. **Optional: custom host/port**  
   If you need a different host or port, set in `CollabBoard/.env`:
   ```bash
   VITE_FUNCTIONS_EMULATOR_HOST=127.0.0.1
   VITE_FUNCTIONS_EMULATOR_PORT=5001
   ```
   Then restart `npm run dev`.

---

## 6. Quick checklist

| Step | Action |
|------|--------|
| See real error | Check emulator terminal or Firebase Functions logs for `[aiCommand] runAgent failed:` |
| Fix .env | No spaces around `=`, use `LANGFUSE_BASE_URL` or `LANGFUSE_HOST` |
| Traces | Set Langfuse keys and URL in `.env`, then open Langfuse dashboard and look for `board-ai-command` |
| Docker | From repo root: `docker compose up --build`, then use app with emulator on port 5001 |
| Can't connect | Set `VITE_USE_FUNCTIONS_EMULATOR=true` in `CollabBoard/.env`, restart dev server; open app at localhost:5173, not 127.0.0.1:5001 |

---

## 7. "Container Healthcheck failed" / "failed to start and listen on PORT" on deploy

If `firebase deploy --only functions` fails with **Container Healthcheck failed** or **The user-provided container failed to start and listen on the port defined by PORT=8080**:

1. **Check the Cloud Run logs** (use the Logs URL printed in the error). In the logs, look for the **first error or stack trace** when the container starts (e.g. missing module, uncaught exception, or timeout). That usually points to the real cause.

2. **Common causes**
   - **Missing dependency:** Every package you `require`/`import` must be in `functions/package.json` `dependencies` (not only in the repo root). Install with `cd functions && npm install <pkg> --save`.
   - **Code throwing at load time:** Something in your code or a dependency runs when the module loads and throws (e.g. reading a file that isn’t in the deployed bundle). The init code in `index.ts` is wrapped in try/catch so dotenv won’t crash the process.
   - **Node version:** If the logs don’t show a clear error, try Node 20: in `functions/package.json` set `"engines": { "node": "20" }`, then redeploy.

3. **Redeploy after fixes**  
   After changing code or dependencies, run `firebase deploy --only functions` again.
