# Make Ready Board | PropAlliance

The **Make Ready Board** is a digital dashboard for tracking unit turnover, vacancies, and maintenance statuses.
It aggregates data from AppFolio reports and displays it in a Kanban-style view.

## 🔗 Quick Links

*   **Script Editor**: [Open in Google Apps Script](https://script.google.com/d/1Xy.../edit) (Check .clasp.json for ID)
*   **Web App (Live)**: [Launch Make Ready Board](https://script.google.com/macros/s/AKfycbyPog4jXWO_ORUfVuILEqsqba_6koEOGIm12Pyi-bfEjgWnKL4pU2Fn5Ef_AGKhJVGy/exec)
*   **Database**: Gmail (Reports are parsed from email attachments)

## 🛠 Reports & Inputs

The system relies on Daily Reports sent via email from AppFolio.
*   **Search Query**: `subject:("MRB Daily Reports" OR "MRB - ")`
*   **Required Attachments**:
    *   `Vacancy.csv` (or similar)
    *   `Move Out.csv`
    *   `Inspection.csv`
    *   `Work Order.csv`
*   **Frequency**: Daily (Script looks for reports `newer_than:7d`).

## 📂 Project Structure

*   **`Code.gs`**: Main Web App logic (`doGet`) and API.
*   **`GmailFetcher.gs`**: Parser for finding and reading CSVs from Gmail.
*   **`index.html`**: The Frontend Dashboard (Vue.js/HTML).

## 🔄 Workflow Protocol

This project follows the **Standard PropAlliance Protocol**.
1.  **Backup**: Run `clasp pull` and snapshot to `_BACKUPS/` before editing.
2.  **Sync**: Commit to Git and Push to Drive (`clasp push`) upon completion.
