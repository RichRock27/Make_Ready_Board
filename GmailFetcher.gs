var GmailFetcher = {
  getLatestReportData: function() {
    // 1. SEARCH PHASE
    // Widen search to 7 days to be absolutely sure we catch something
    var query = 'subject:(MRB OR "Move Out" OR "Daily Report" OR Report) has:attachment newer_than:7d';
    var threads = GmailApp.search(query, 0, 10);
    
    var debugLog = [];
    debugLog.push("=== START DEBUG LOG ===");
    debugLog.push("Query: " + query);
    debugLog.push("Threads found: " + threads.length);

    var result = {
      moveOuts: [], vacancies: [], inspections: [], workOrders: [],
      timestamp: "No Data",
      debug: debugLog
    };

    if (threads.length === 0) {
       debugLog.push("CRITICAL ERROR: No email threads found matching query.");
       return result;
    }

    // 2. EMAIL SELECTION PHASE
    // Iterate through threads to find the most relevant one
    var bestMsg = null;
    
    // Sort threads by date just in case
    // (GmailApp.search usually returns newest first, but let's be safe)
    for (var i = 0; i < threads.length; i++) {
        var thread = threads[i];
        var msgs = thread.getMessages();
        var msg = msgs[msgs.length - 1]; // Get latest message in thread
        var date = msg.getDate();
        var subject = msg.getSubject();
        
        debugLog.push("[" + i + "] Subject: '" + subject + "' | Date: " + date);
        
        // Simple logic: Take the newest one
        // You could add logic here to skip specific subjects if needed
        if (!bestMsg) {
             bestMsg = msg;
        }
    }

    if (!bestMsg) {
        debugLog.push("Error: Could not identify a valid message.");
        return result;
    }

    result.timestamp = bestMsg.getDate().toLocaleString();
    debugLog.push("SELECTED EMAIL: '" + bestMsg.getSubject() + "' from " + result.timestamp);

    // 3. ATTACHMENT PROCESSING PHASE
    var attachments = bestMsg.getAttachments();
    debugLog.push("Attachments found: " + attachments.length);

    for (var j = 0; j < attachments.length; j++) {
        var att = attachments[j];
        var name = att.getName().toLowerCase();
        var parsedData = [];
        
        // Debug file name to see exactly what we are getting
        debugLog.push("Checking File [" + j + "]: " + att.getName());

        try {
            var content = att.getDataAsString();
            
            // LOGIC: Use loose matching to catch variations
            if (name.indexOf('tenant_tickler') > -1 || name.indexOf('tenant tickler') > -1) {
                 parsedData = this.parseCSV(content, debugLog);
                 result.moveOuts = result.moveOuts.concat(parsedData);
                 debugLog.push("  -> MATCH: Identified as Move Out/Tickler. Rows: " + parsedData.length);
            } 
            else if (name.indexOf('unit_vacancy') > -1 || name.indexOf('unit vacancy') > -1) {
                 parsedData = this.parseCSV(content, debugLog);
                 result.vacancies = result.vacancies.concat(parsedData);
                 debugLog.push("  -> MATCH: Identified as Unit Vacancy. Rows: " + parsedData.length);
            }
            else if (name.indexOf('inspection_detail') > -1 || name.indexOf('inspection detail') > -1) {
                 parsedData = this.parseCSV(content, debugLog);
                 result.inspections = result.inspections.concat(parsedData);
                 debugLog.push("  -> MATCH: Identified as Inspection. Rows: " + parsedData.length);
            }
            else if (name.indexOf('work_order') > -1 || name.indexOf('work order') > -1) {
                 parsedData = this.parseCSV(content, debugLog);
                 result.workOrders = result.workOrders.concat(parsedData);
                 debugLog.push("  -> MATCH: Identified as Work Order. Rows: " + parsedData.length);
            }
            else {
                 debugLog.push("  -> IGNORED: Filename did not match any known patterns.");
            }
        } catch (e) {
            debugLog.push("  -> ERROR reading file: " + e.toString());
        }
    }
    
    debugLog.push("=== END DEBUG LOG ===");
    return result;
  },

  parseCSV: function(csvString, debugLog) {
    try {
      var table = Utilities.parseCsv(csvString);
      if (!table || table.length < 2) {
          if(debugLog) debugLog.push("    -> CSV Parser: File empty or no header.");
          return []; 
      }
      
      var headers = table[0].map(function(h) { return h.trim(); });
      // Debug first few headers to ensure we are parsing correctly
      if(debugLog && headers.length > 0) debugLog.push("    -> Headers found: " + headers.slice(0, 3).join(', ') + "...");

      var data = [];
      for (var i = 1; i < table.length; i++) {
        var row = table[i];
        // Skip empty lines
        if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;
        
        var obj = {};
        for (var k = 0; k < headers.length; k++) {
           if (k < row.length) obj[headers[k]] = row[k].trim();
        }
        data.push(obj);
      }
      return data;
    } catch (e) {
      if(debugLog) debugLog.push("    -> CSV Parser Error: " + e.toString());
      return [];
    }
  }
};
