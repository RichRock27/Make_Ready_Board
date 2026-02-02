# Make Ready Board
**Project Type:** Google Apps Script Web Application  
**Last Updated:** 2026-02-01  
**Status:** ✅ Production

---

## 📋 What This Project Does

A specialized dashboard for tracking vacant unit make-ready progress. Monitors:
- **Vacant Units** - Properties awaiting turnover
- **Inspection Status** - NONE, NEW, IN PROGRESS, DONE
- **Work Orders** - Active maintenance for make-ready
- **Rent Ready Status** - Units cleared for leasing
- **Marketing Status** - Website/internet listing status
- **Days Vacant Tracking** - Turnaround time metrics

**Key Feature:** Automatically fetches unit data from **email reports** sent to a designated Gmail account.

---

## 🏗️ Architecture

### File Structure
```
Make_Ready_Board/
├── Code.gs              # Server-side logic (minimal - just doGet, include, getData)
├── BrainSync.gs         # Optional sync functionality
├── GmailFetcher.gs      # EMAIL PARSING LOGIC (critical!)
├── index.html           # Complete application (30KB+ monolith)
├── easter_egg.html      # Modular Easter Egg
├── Inspection Detail.csv          # Sample data
├── Move Out.csv                   # Sample data  
├── Unit Vacancy.csv               # Sample data
└── appsscript.json      # Manifest file
```

### Critical Understanding

**This app gets data from EMAIL, not spreadsheets!**

The `GmailFetcher.gs` script:
1. Searches Gmail for specific subject lines
2. Extracts CSV attachments from emails
3. Parses CSV data into JSON
4. Returns combined dataset to the UI

---

## 📊 Data Sources

### Email-Based CSV Reports

**Gmail Search Query:** (configured in `GmailFetcher.gs`)
```
subject:("Unit Vacancy" OR "Move Out" OR "Inspection Detail") has:attachment
```

**Expected CSV Files:**
1. **Unit Vacancy.csv** - Vacant units list
   - Property Code, Unit, Bed/Bath, Available Date, Rent Ready
2. **Move Out.csv** - Recent move-outs
   - Unit, Move Out Date, Reason
3. **Inspection Detail.csv** - Inspection records
   - Unit, Inspection Status, Date, Notes

### Fallback Sample Data
If Gmail fetch fails, app uses hardcoded sample data in `Code.gs`:
```javascript
function getSampleData() {
  return [
    {territory: 'Aurora', propertyName: '1388 Dayton St', unit: '1', ...},
    // ... sample units
  ];
}
```

---

## 🎨 UI Features

- **Multi-Select Territory Filter** - Checkbox dropdowns
- **Inspection Status Filter** - NONE/NEW/IN PROGRESS/DONE
- **Rent Ready Toggle** - Show only move-in ready units
- **Marketing Filters** - Website/Internet posting status
- **Hidden Units Mode** - Personal unit hiding (saved per user)
- **Pagination** - 10/25/50/All units per page
- **Search** - Real-time property/unit filtering
- **Stats Cards** - Clickable quick filters (Total Vacant, Not Ready, No Inspection)

---

## ⚠️ Known Issues

### 1. Gmail Permission Errors
**Symptom:** "Access denied" or "Authorization required"  
**Cause:** Script doesn't have Gmail access  
**Fix:**
1. In Apps Script editor: **Services** → Add **Gmail API**
2. Run any function to trigger auth
3. Grant Gmail read permissions when prompted

### 2. CSV Parsing Failures
**Symptom:** Empty dashboard or "No data"  
**Cause:** Email format changed or CSV structure differs  
**Fix:**
- Check `GmailFetcher.gs` - update search query
- Verify `getLatestReportData()` CSV parsing logic
- Add logging to troubleshoot:
```javascript
Logger.log("Found attachments: " + attachments.length);
Logger.log("CSV Content: " + csvContent.substring(0, 200));
```

### 3. Old Easter Egg CSS Conflict (RESOLVED 2026-02-01)
**Symptom:** Old particle animation instead of matrix/neon  
**Cause:** Leftover inline CSS from previous version  
**Fix:** Already resolved - removed lines 465-501 in index.html

### 4. Hidden Units Not Syncing Across Users
**Symptom:** User A's hidden units don't hide for User B  
**Cause:** By design - uses `ScriptProperties` (shared) but can be changed  
**Fix:** If you want shared hiding:
```javascript
// In index.html, change:
PropertiesService.getScriptProperties() // Shared across all users
// Instead of:
PropertiesService.getUserProperties()   // Per-user
```

---

## 🚀 Deployment

### Gmail Setup (ONE-TIME):
1. Create a dedicated Gmail label: "MakeReadyReports"
2. Set up filter to auto-label emails:
   - From: `reports@propertymanagement.com`
   - Subject contains: "Unit Vacancy"
   - Action: Apply label "MakeReadyReports"
3. Update `GmailFetcher.gs` with label name

### Apps Script Deployment:
1. Add **Gmail API** service
2. **Deploy** → **New deployment**
3. Execute as: **Me** (needs your Gmail access)
4. Access: "Anyone with Google account"
5. **IMPORTANT:** User must authorize Gmail first time

---

## 🔧 Common Fixes

### No Data Loading
1. **Check Gmail access:**
```javascript
function testGmail() {
  const threads = GmailApp.search('subject:"Unit Vacancy"', 0, 1);
  Logger.log("Found threads: " + threads.length);
}
```
2. **Verify email exists** - Send test email with CSV attachment
3. **Check CSV format** - Ensure headers match expected columns

### Filters Not Working
1. Ensure filter IDs match HTML element IDs
2. Check JavaScript console for errors
3. Verify `renderDashboard()` is called after filter changes

### Hide/Unhide Broken
1. Check `setHiddenUnits()` function in `Code.gs`
2. Verify `ScriptProperties` quota not exceeded (9KB limit per property)
3. Clear properties if corrupted:
```javascript
function resetHidden() {
  PropertiesService.getScriptProperties().deleteProperty('mrb_hidden_list');
}
```

---

## 📝 Quick Edits

### Add New Filter
```html
<!-- In index.html -->
<select id="filter-newfield" aria-label="Filter New Field">
  <option value="all">All</option>
  <option value="yes">Yes</option>
  <option value="no">No</option>
</select>
```

```javascript
// In setupFilters() function:
document.getElementById('filter-newfield').addEventListener('input', renderDashboard);
```

### Change Gmail Search Query
Edit `GmailFetcher.gs`:
```javascript
const SEARCH_QUERY = 'subject:"Your Custom Subject" has:attachment';
const LABEL_NAME = 'YourLabel'; // Optional
```

### Adjust Territory Mapping
```javascript
// If CSV has property codes like "12-100", "13-200"
const TERRITORY_MAP = {
  '12': 'Colorado Springs',
  '13': 'Denver Central',
  // Add more as needed
};
```

---

## 🔗 Related

Projects **Getting Data FROM** Make Ready Board:
- None currently (data is consumed here, not provided)

Projects **Providing Data TO** Make Ready Board:
- External email system sending CSV reports

---

## 💡 Tips for Future AI Agents

1. **GmailFetcher.gs is the HEART of this app** - Don't modify without understanding email dependencies
2. **Test email parsing separately** - Use `testFunction()` stubs before full deployment
3. **Large files = slow** - index.html is 60KB+. Consider splitting if modifying heavily
4. **Hidden units use shared state** - Be careful with PropertiesService quotas
5. **The app is READ-ONLY** - It doesn't write back to Gmail or sheets
6. **Easter Egg must stay** - Modular version in `easter_egg.html`
7. **If Gmail API breaks, use sample data** - Always have a fallback

---

## 🐛 Debugging Checklist

- [ ] Gmail API enabled in Services
- [ ] Test email with CSV attachment sent
- [ ] GmailFetcher.gs search query matches email subject
- [ ] CSV headers match expected column names  
- [ ] Browser console clear of errors
- [ ] `include()` function exists in Code.gs
- [ ] `easter_egg.html` file present
