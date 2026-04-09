# zu_monitor

Static “airport board” website that lists incidents in the order they were opened, with:

- Name
- Location
- Open date/time
- Time left until 2 hours since opening
- Row color by age: green (<30m), yellow (30–60m), red (>60m)

The site lives in [docs/](file:///c:/Users/manserv/OneDrive%20-%20MANSERV/%C3%81rea%20de%20Trabalho/Projetos_Wesley/zu_monitor/docs) so it can be published with GitHub Pages. Incident data is stored in [docs/data/incidents.json](file:///c:/Users/manserv/OneDrive%20-%20MANSERV/%C3%81rea%20de%20Trabalho/Projetos_Wesley/zu_monitor/docs/data/incidents.json) and refreshed by GitHub Actions every 10 minutes.

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. In GitHub: **Settings → Pages**
3. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/docs**
4. Save. Your site URL will appear there.

## Automated refresh (every 10 minutes)

The workflow is in [.github/workflows/update-data.yml](file:///c:/Users/manserv/OneDrive%20-%20MANSERV/%C3%81rea%20de%20Trabalho/Projetos_Wesley/zu_monitor/.github/workflows/update-data.yml). It:

1. Runs `python scripts/build_data.py`
2. Writes updated JSON into `docs/data/`
3. Commits and pushes changes (only when data changes)

## Connect your API request code (from Insomnia)

This repo uses a small request wrapper in:

- [insomnia_api_request.py](file:///c:/Users/manserv/OneDrive%20-%20MANSERV/%C3%81rea%20de%20Trabalho/Projetos_Wesley/zu_monitor/scripts/insomnia_api_request.py)

Put your huge form payload into:

- [request_payload.txt](file:///c:/Users/manserv/OneDrive%20-%20MANSERV/%C3%81rea%20de%20Trabalho/Projetos_Wesley/zu_monitor/scripts/request_payload.txt)

The data builder will normalize common field names into the website schema:

```json
{
  "id": "string",
  "name": "string",
  "location": "string",
  "opened_at": "ISO-8601 string"
}
```

### Optional: GitHub Secrets for API auth

If your API needs credentials, add GitHub repository secrets (use only what you need):

- `API_URL` (full URL, overrides everything)
- `API_BASE_URL` (default: https://prisma4.manserv.com.br)
- `API_TOKEN` (used as Authorization: Bearer ...)
- `API_COOKIE` (if the API is cookie-based)
- `PRISMA_REQUEST_VERIFICATION_TOKEN` (if required by Prisma anti-forgery)
- `PRISMA_SIGNALR_ID_CONNECTION` (if required)
- `API_HEADERS_JSON` (JSON object string for extra headers)
- `API_PAYLOAD` (optional alternative to filling request_payload.txt)

They are already passed into the workflow environment (but your pasted Insomnia code must read them).

## Run locally

1. Install Python dependencies:
   - `pip install -r requirements.txt`
2. Generate data:
   - `python scripts/build_data.py`
3. Serve the site:
   - `python -m http.server --directory docs 8000`
4. Open `http://localhost:8000`

## Google Sheets?

With 1–20 rows, committing `docs/data/incidents.json` is the simplest approach and keeps the site fully static. If later you want a non-GitHub data store, we can switch the data source to Google Sheets (via a scheduled workflow that reads Sheets and rewrites the JSON).
