/**
 * BRAIN SYNC v1.0
 * Pushes Make Ready Board status to the Master Intelligence Hub (The Brain).
 */

var BRAIN_CONFIG = {
  FOLDER_ID: '1PZA9tvrtFzpPIo-fteXt8VKCGEC9j4ZK',
  FILENAME: 'MRB_LIVE_STATUS.json'
};

function syncToBrain() {
  const log = [];
  log.push("Starting Sync to Brain...");
  
  try {
    // 1. Fetch Latest Data
    const result = GmailFetcher.getLatestReportData();
    if (!result || !result.vacancies) {
      throw new Error("Failed to fetch Gmail Data");
    }
    
    // 2. Synthesize Status Map
    // Key: PropertyCode_Unit (Normalized)
    // Value: { status: "Vacant", days: 10, type: "Vacancy" }
    const statusMap = {};
    
    // A. Vacancies
    result.vacancies.forEach(row => {
      const key = generateKey(row['Property'], row['Unit']);
      if (key) {
        statusMap[key] = {
           status: "Vacant",
           days: row['Days Vacant'],
           available: row['Available Date'],
           notes: row['Tags']
        };
      }
    });

    // B. Move Outs (Future)
    result.moveOuts.forEach(row => {
      const key = generateKey(row['Property'], row['Unit']);
      if (key && !statusMap[key]) { // Vacancy takes precedence
        statusMap[key] = {
           status: "Notice Given",
           moveOut: row['Move Out Date'],
           notes: "Future Move Out"
        };
      }
    });
    
    // C. Inspections
    result.inspections.forEach(row => {
       // Only care if incomplete?
    });

    log.push(`Synthesized ${Object.keys(statusMap).length} unit statuses.`);
    
    // 3. Save to Drive
    const folder = DriveApp.getFolderById(BRAIN_CONFIG.FOLDER_ID);
    const files = folder.getFilesByName(BRAIN_CONFIG.FILENAME);
    
    let file;
    if (files.hasNext()) {
      file = files.next();
      file.setContent(JSON.stringify(statusMap, null, 2));
    } else {
      file = folder.createFile(BRAIN_CONFIG.FILENAME, JSON.stringify(statusMap, null, 2), MimeType.PLAIN_TEXT);
    }
    
    log.push("Successfully saved to Brain Folder.");
    console.log(log.join("\n"));
    return "Success";
    
  } catch (e) {
    console.error(e);
    log.push("ERROR: " + e.toString());
    return log.join("\n");
  }
}

function generateKey(prop, unit) {
  if (!prop || !unit) return null;
  // Normalize: 17FITZ + 101 -> 17FITZ_101
  const p = prop.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const u = String(unit).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${p}_${u}`;
}
