var GmailFetcher = {
  getLatestReportData: function() {
    // UPDATED QUERY: Look for "MRB" in subject to catch "MRB Daily Reports" AND "MRB - Unit Vacancy"
    var query = 'subject:MRB has:attachment newer_than:2d';
    // Fetch up to 20 threads to ensure we get all split parts
    var threads = GmailApp.search(query, 0, 20);
    
    // Diagnostic Log
    var debugLog = [];
    debugLog.push("Query: " + query);
    debugLog.push("Threads found: " + threads.length);

    var result = {
      moveOuts: [], vacancies: [], inspections: [], workOrders: [],
      timestamp: "No Data",
      debug: debugLog
    };

    if (threads.length === 0) {
       debugLog.push("ERROR: No email found matching query.");
       return result;
    }

    // --- BATCHING LOGIC ---
    var newestDate = threads[0].getLastMessageDate();
    result.timestamp = newestDate.toLocaleString();
    debugLog.push("Newest Email Date: " + result.timestamp);

    var TIME_WINDOW_MS = 4 * 60 * 60 * 1000; 

    // Iterate threads to gather the batch
    for (var i = 0; i < threads.length; i++) {
        var thread = threads[i];
        if (Math.abs(newestDate - thread.getLastMessageDate()) > TIME_WINDOW_MS) continue; 

        var msgs = thread.getMessages();
        var msg = msgs[msgs.length - 1]; // Latest in thread
        var attachments = msg.getAttachments();
        
        debugLog.push("Processing: " + msg.getSubject());
        
        for (var j = 0; j < attachments.length; j++) {
            var att = attachments[j];
            var name = att.getName().toLowerCase();
            
            // --- PARSE LOGIC (Using Server-Side Utilities) ---
            var parsedData = [];
           
            // MATCHING LOGIC (Handles underscores and spaces)
            if (name.indexOf('tenant_tickler') > -1 || name.indexOf('tenant tickler') > -1) {
                 parsedData = this.parseCSV(att.getDataAsString());
                 result.moveOuts = result.moveOuts.concat(parsedData);
            } 
            else if (name.indexOf('unit_vacancy') > -1 || name.indexOf('unit vacancy') > -1) {
                 parsedData = this.parseCSV(att.getDataAsString());
                 result.vacancies = result.vacancies.concat(parsedData);
            }
            else if (name.indexOf('inspection_detail') > -1 || name.indexOf('inspection detail') > -1) {
                 parsedData = this.parseCSV(att.getDataAsString());
                 result.inspections = result.inspections.concat(parsedData);
            }
            else if (name.indexOf('work_order') > -1 || name.indexOf('work order') > -1) {
                 parsedData = this.parseCSV(att.getDataAsString());
                 result.workOrders = result.workOrders.concat(parsedData);
            }
            
            if (parsedData.length > 0) debugLog.push("  -> MATCH: " + name + " (" + parsedData.length + " rows)");
            else debugLog.push("  -> SAW FILE: " + name + " (No rows added)");
        }
    }
    
    return result;
  },

  parseCSV: function(csvString) {
    try {
      var table = Utilities.parseCsv(csvString);
      if (!table || table.length < 2) return []; 

      var headers = table[0].map(function(h) { return h.trim(); });
      var data = [];

      for (var i = 1; i < table.length; i++) {
        var row = table[i];
        if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;
        
        var obj = {};
        for (var k = 0; k < headers.length; k++) {
           if (k < row.length) {
              obj[headers[k]] = row[k].trim();
           }
        }
        data.push(obj);
      }
      return data;
    } catch (e) {
      Logger.log("Error parsing CSV: " + e.toString());
      return [];
    }
  }
};
