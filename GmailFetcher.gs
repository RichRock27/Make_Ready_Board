var GmailFetcher = {
  getLatestReportData: function() {
    // 1. SEARCH PHASE
    // Strict query matching the screenshot: 'MRB Daily Reports'
    var query = 'subject:"MRB Daily Reports" has:attachment newer_than:2d';
    // Fetch up to 20 threads to ensure we get all the separate emails (Vacancy, WO, Insp, etc)
    var threads = GmailApp.search(query, 0, 20);
    
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

    // Set timestamp to the date of the newest thread found
    var newestDate = threads[0].getLastMessageDate();
    result.timestamp = newestDate.toLocaleString();
    debugLog.push("Newest Email Date: " + result.timestamp);

    // 2. PROCESSING PHASE: Iterate through ALL threads
    // The user receives separate emails for each report type, so we must scan all of them.
    for (var i = 0; i < threads.length; i++) {
        var thread = threads[i];
        var msgs = thread.getMessages();
        var msg = msgs[msgs.length - 1]; // Get latest message in this specific thread
        var subject = msg.getSubject();
        
        debugLog.push("[" + i + "] Scanning: '" + subject + "'");

        var attachments = msg.getAttachments();
        for (var j = 0; j < attachments.length; j++) {
            var att = attachments[j];
            var name = att.getName().toLowerCase();
            var parsedData = [];
            
            try {
                var content = att.getDataAsString();
                
                if (name.indexOf('tenant_tickler') > -1 || name.indexOf('tenant tickler') > -1) {
                     parsedData = this.parseCSV(content, debugLog);
                     result.moveOuts = result.moveOuts.concat(parsedData);
                     debugLog.push("    -> MATCH: Move Out/Tickler (" + parsedData.length + " rows)");
                } 
                else if (name.indexOf('unit_vacancy') > -1 || name.indexOf('unit vacancy') > -1) {
                     parsedData = this.parseCSV(content, debugLog);
                     result.vacancies = result.vacancies.concat(parsedData);
                     debugLog.push("    -> MATCH: Unit Vacancy (" + parsedData.length + " rows)");
                }
                else if (name.indexOf('inspection_detail') > -1 || name.indexOf('inspection detail') > -1) {
                     parsedData = this.parseCSV(content, debugLog);
                     result.inspections = result.inspections.concat(parsedData);
                     debugLog.push("    -> MATCH: Inspection (" + parsedData.length + " rows)");
                }
                else if (name.indexOf('work_order') > -1 || name.indexOf('work order') > -1) {
                     parsedData = this.parseCSV(content, debugLog);
                     result.workOrders = result.workOrders.concat(parsedData);
                     debugLog.push("    -> MATCH: Work Order (" + parsedData.length + " rows)");
                }
                else {
                     debugLog.push("    -> IGNORED: " + name);
                }
            } catch (e) {
                debugLog.push("    -> ERROR processing attachment: " + e.toString());
            }
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
