var GmailFetcher = {
  /**
   * DATA HUB FETCHER (Previously GmailFetcher)
   * Connects to the Central Data Hub (Shared Drive Folder) to retrieve standardized reports.
   * This eliminates the need for MRB to scan emails directly.
   */
  getLatestReportData: function() {
    var HUB_FOLDER_ID = "13f-KJPJ5mzHkrE5_JU16dc62gv3WEzQN"; // The PMD/Central Hub Folder
    var debugLog = [];
    debugLog.push("=== START DATA HUB FETCH ===");
    debugLog.push("Connecting to Shared Folder: " + HUB_FOLDER_ID);

    try {
      var folder = DriveApp.getFolderById(HUB_FOLDER_ID);
      var rawData = {
        vacancies: [],
        moveOuts: [],
        inspections: [],
        workOrders: []
      };

      // Configuration: Map MRB Data Types to Hub Files (Priority 1 = CORE, Priority 2 = Legacy)
      var fileMap = [
        { type: "vaccancy",   core: "CORE_Vacancy.csv",      legacy: "Vacancies.csv",        target: "vacancies" },
        { type: "moveout",    core: "CORE_MoveOuts.csv",     legacy: "TenantMovement.csv",   target: "moveOuts" },
        { type: "inspection", core: "CORE_Inspections.csv",  legacy: "Inspections_Raw.csv",  target: "inspections" }, // Legacy might not exist
        { type: "workorder",  core: "CORE_WorkOrders.csv",   legacy: "WorkOrders_Raw.csv",   target: "workOrders" }
      ];

      for (var i = 0; i < fileMap.length; i++) {
          var config = fileMap[i];
          var file = null;
          var sourceName = "";

          // 1. Try CORE (New Standard)
          var coreFiles = folder.getFilesByName(config.core);
          if (coreFiles.hasNext()) {
              file = coreFiles.next();
              sourceName = config.core;
          } 
          // 2. Try LEGACY (Fallback)
          else {
              var legacyFiles = folder.getFilesByName(config.legacy);
              if (legacyFiles.hasNext()) {
                  file = legacyFiles.next();
                  sourceName = config.legacy;
              }
          }

          if (file) {
              debugLog.push(`[${config.type.toUpperCase()}] Found source: ${sourceName}`);
              var csvString = file.getBlob().getDataAsString();
              var rows = this.parseCSV(csvString, debugLog, sourceName);
              
              if (rows.length > 0) {
                  rawData[config.target] = rawData[config.target].concat(rows);
                  debugLog.push(`    -> Loaded ${rows.length} rows.`);
              } else {
                  debugLog.push(`    -> WARNING: File was empty or unparseable.`);
              }
          } else {
              debugLog.push(`[${config.type.toUpperCase()}] ERROR: No file found (Checked ${config.core} & ${config.legacy})`);
          }
      }

      var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm:ss");
      debugLog.push("=== PROCESSING COMPLETE ===");
      
      // MRB Logic used to reverse chronological order for overlapping email imports. 
      // Since we are reading single "State of Truth" files now, order usually matters less, 
      // but AppFolio exports are usually sorted by Unit or Date. 
      // We will maintain the reverse() just in case the frontend relies on specifically newest-at-bottom behavior, 
      // though typically "Unit Vacancy" is just a list.
      // Actually, if it's a list of current vacancies, order doesn't matter.
      // Move Outs are date based. Reversing might affect queue. keeping it safe.

      return {
        vacancies: rawData.vacancies.reverse(),
        moveOuts: rawData.moveOuts.reverse(),
        inspections: rawData.inspections.reverse(),
        workOrders: rawData.workOrders.reverse(),
        timestamp: timestamp,
        debug: debugLog
      };

    } catch (e) {
      debugLog.push("CRITICAL ERROR: " + e.toString());
      return { vacancies: [], moveOuts: [], inspections: [], workOrders: [], timestamp: "Error", debug: debugLog };
    }
  },

  // Helper to parse CSV string into Array of Objects
  parseCSV: function(csvString, debugLog, filename) {
      if (!csvString) return [];
      
      try {
        var table = Utilities.parseCsv(csvString);
        if (!table || table.length < 2) {
            if(debugLog) debugLog.push("          -> CSV Parser: File '" + filename + "' is empty or has no header.");
            return []; 
        }

        // FIND HEADER ROW DYNAMICALLY
        var headerRowIndex = -1;
        var headers = [];

        for (var i = 0; i < Math.min(table.length, 20); i++) {
            var rowStr = table[i].join(" ").toLowerCase();
            // Look for "Unit" AND "Tags" or "Property" to be sure it's the header
             // Enhanced detection for different report types
            if ((rowStr.includes("unit") && rowStr.includes("tags")) || rowStr.includes("property name") || rowStr.includes("unit status")) {
                headerRowIndex = i;
                headers = table[i];
                break;
            }
        }

        if (headerRowIndex === -1) {
            headerRowIndex = 0;
            headers = table[0];
            if(debugLog) debugLog.push("          -> WARNING: Could not detect standard headers. Using Row 0.");
        }

        // Clean headers
        for(var h=0; h<headers.length; h++) headers[h] = headers[h].trim();

        var result = [];
        // Start processing AFTER the header row
        for (var i = headerRowIndex + 1; i < table.length; i++) {
            var row = table[i];
            if (row.length === 0) continue; // Skip totally empty lines
            
            var obj = {};
            // Map header to value
            for (var j = 0; j < headers.length; j++) {
                if (j < row.length) {
                    obj[headers[j]] = row[j];
                } else {
                    obj[headers[j]] = ""; 
                }
            }

            // FILTER: SKIP GROUP HEADERS AND SUMMARIES
            var unitVal = obj['Unit'] || "";
            var propVal = obj['Property'] || obj['Property Name'] || "";

            if (unitVal.trim().startsWith("->")) continue; // Skip Group Header
            if (!propVal && !unitVal) continue; // Skip Empty/Junk Row
            if (unitVal === "Total") continue;

            result.push(obj);
        }
        return result;
      } catch (e) {
          if(debugLog) debugLog.push("          -> CSV PARSE ERROR in '" + filename + "': " + e.message);
          return [];
      }
  }
};
