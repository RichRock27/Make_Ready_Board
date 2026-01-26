var GmailFetcher = {
  getLatestReportData: function() {
    var debugLog = [];
    debugLog.push("=== START DEBUG LOG (MAX VERBOSITY) ===");

    try {
      // 1. SEARCH PHASE
      // Updated to match both "MRB Daily Reports" and manual "MRB - Type" emails
      var query = 'subject:("MRB Daily Reports" OR "MRB - ") has:attachment newer_than:5d';
      debugLog.push("[1] Searching Gmail...");
      debugLog.push("    -> Query: [" + query + "]");
      
      // Fetch up to 50 threads to ensure we catch the latest among many emails
      var threads = GmailApp.search(query, 0, 50);
      debugLog.push("    -> Threads Found: " + threads.length);

      if (threads.length === 0) {
        debugLog.push("    -> ERROR: No emails found matching the query.");
        return { vacancies: [], moveOuts: [], inspections: [], workOrders: [], timestamp: "No Data", debug: debugLog };
      }

      // flags to ensure we only take the NEWEST of each type
      var foundTypes = {
          VACANCY: false,
          MOVEOUT: false,
          INSPECTION: false,
          WORKORDER: false
      };

      var rawData = {
        vacancies: [],
        moveOuts: [],
        inspections: [],
        workOrders: []
      };

      // 2. ITERATE ALL THREADS TO COLLECT ATTACHMENTS
      // GmailApp.search returns newest first. We iterate in order.
      debugLog.push("[2] Scanning Threads & Attachments (Newest First)...");
      
      for (var i = 0; i < threads.length; i++) {
        var thread = threads[i];
        var messages = thread.getMessages();
        // The last message in the thread is the newest one in that conversation
        var msg = messages[messages.length - 1]; 
        var subject = msg.getSubject();
        var date = msg.getDate();

        debugLog.push("    -> Thread [" + i + "]: Subject='" + subject + "', Date=" + date);

        var attachments = msg.getAttachments();
        debugLog.push("       -> Attachment Count: " + attachments.length);

        for (var j = 0; j < attachments.length; j++) {
            var att = attachments[j];
            var name = att.getName();
            var lowerName = name.toLowerCase();

            // IDENTIFY TYPE BEFORE PARSING
            var currentType = "UNKNOWN";
            if (lowerName.includes('vacancy')) currentType = "VACANCY";
            else if (lowerName.includes('move not') || lowerName.includes('move-out') || lowerName.includes('move out') || lowerName.includes('tickler')) currentType = "MOVEOUT";
            else if (lowerName.includes('inspection')) currentType = "INSPECTION";
            else if (lowerName.includes('work order')) currentType = "WORKORDER";

            // CHECK IF WE SHOULD PROCESS THIS FILE
            // We want to aggregate ALL relevant files:
            // - Vacancy: 1 file
            // - Move Out/Tickler: 2 files (Last 90, Next 90)
            // - Inspection: 2 files (Last 90, Next 90)
            // - Work Order: 2 files (Last 90, Next 90)
            // Total: 7 potential files per daily run.
            
            // We will NOT skip if we already found one, because we need both (Last 90 + Next 90).
            // However, we must be careful not to process the *same* file twice if it appears in multiple threads (e.g. yesterday's email).
            // Since we are iterating newest to oldest, we could theoretically just grab everything from the newest batch.
            // But relying on "Newest Thread" is safer if we just process everything found in the Search Window 
            // and rely on the fact that we increased the search limit to 50 to catch them all.
            // Better strategy: Just aggregate everything found. Duplicate rows (if any) will overlap but likely not break the board logic 
            // since we use a Map by Property-Unit to merge data. The latest data will overwrite.
            
            if (currentType !== "UNKNOWN") {
                 // No "foundTypes" check anymore - we want ALL parts (Past & Next)
                 // Logic: Just process and add.
            }

            // 3. PARSE CSV CONTENT
            if (att.getContentType() === 'text/csv' || name.endsWith('.csv')) {
                var csvString = att.getDataAsString();
                var rows = this.parseCSV(csvString, debugLog, name);
                
                if (rows.length > 0) {
                    // Fallback Type Check (Columns) if filename failed
                    if (currentType === "UNKNOWN") {
                         if(rows[0]['Days Vacant']) currentType = "VACANCY";
                         else if (rows[0]['Move Out Date']) currentType = "MOVEOUT";
                    }

                    // Assign Data
                    if (currentType === "VACANCY") {
                        rawData.vacancies = rawData.vacancies.concat(rows);
                        debugLog.push("          -> ADDED: Vacancy Data (" + rows.length + " rows)");
                    } else if (currentType === "MOVEOUT") {
                        rawData.moveOuts = rawData.moveOuts.concat(rows);
                        debugLog.push("          -> ADDED: Move Out Data (" + rows.length + " rows)");
                    } else if (currentType === "INSPECTION") {
                        rawData.inspections = rawData.inspections.concat(rows);
                        debugLog.push("          -> ADDED: Inspection Data (" + rows.length + " rows)");
                    } else if (currentType === "WORKORDER") {
                        rawData.workOrders = rawData.workOrders.concat(rows);
                        debugLog.push("          -> ADDED: Work Order Data (" + rows.length + " rows)");
                    } else {
                         debugLog.push("          -> IGNORED: Unknown type.");
                    }
                }
            }
        }
      }


      var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm:ss");
      debugLog.push("=== PROCESSING COMPLETE ===");
      debugLog.push("Final Counts: Vacancies=" + rawData.vacancies.length + ", MoveOuts=" + rawData.moveOuts.length + ", Insp=" + rawData.inspections.length + ", WOs=" + rawData.workOrders.length);

      // REVERSE DATA ARRAYS
      // Gmail search returns NEWEST first. We processed them in that order (Newest -> Oldest).
      // So 'rawData' currently has [NewestData, ..., OldestData].
      // The Front End iterates through this array 0..length.
      // If we leave it as is, the Oldest Data (at the end) would overwrite the Newest Data (at the start) in the Front End's Map.
      // By REVERSING here, we send [OldestData, ..., NewestData].
      // The Front End will process Oldest first, then Newest. The Newest data will correctly overwrite the Oldest.
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
      debugLog.push("Stack: " + e.stack);
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

        var headers = table[0];
        // Clean headers
        for(var h=0; h<headers.length; h++) headers[h] = headers[h].trim();

        var result = [];
        for (var i = 1; i < table.length; i++) {
            var row = table[i];
            if (row.length === 0) continue; // Skip totally empty lines
            
            var obj = {};
            // Map header to value, being careful not to overflow if row is short
            for (var j = 0; j < headers.length; j++) {
                if (j < row.length) {
                    obj[headers[j]] = row[j];
                } else {
                    obj[headers[j]] = ""; // Fill missing cols with empty string
                }
            }
            result.push(obj);
        }
        return result;
      } catch (e) {
          if(debugLog) debugLog.push("          -> CSV PARSE ERROR in '" + filename + "': " + e.message);
          return [];
      }
  }
};
