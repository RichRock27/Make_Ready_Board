var GmailFetcher = {
  getLatestReportData: function() {
    // UPDATED: Search for "MRB Daily Reports" within the last 2 days (48h)
    // This buffer ensures we catch the latest batch even if it arrived yesterday.
    var query = 'subject:"MRB Daily Reports" has:attachment newer_than:2d';
    
    // Fetch up to 20 threads to ensure we get all the split parts (Vacancy, WO, etc)
    var threads = GmailApp.search(query, 0, 20);
    
    // Diagnostic Log for Client Side
    var debugLog = [];
    debugLog.push("Query: " + query);
    debugLog.push("Threads found: " + threads.length);

    var result = {
      moveOuts: [], 
      vacancies: [], 
      inspections: [], 
      workOrders: [],
      timestamp: "No Data",
      debug: debugLog
    };

    if (threads.length === 0) {
       debugLog.push("ERROR: No email found with subject 'MRB Daily Reports' in last 48h.");
       return result;
    }

    // --- BATCHING LOGIC (Past 24h Cycle) ---
    // The reports arrive as separate emails (Split Reports). 
    // We group them by finding the NEWEST email and grabbing everything 
    // that arrived within a 4-hour window of that timestamp.
    
    // 1. Establish the "Anchor" time from the very newest thread found.
    var newestDate = threads[0].getLastMessageDate();
    result.timestamp = newestDate.toLocaleString();
    debugLog.push("Newest Email Date: " + result.timestamp);

    // 2. Define a time window (4 hours) to group the set.
    //    Anything outside this window is considered an "Old Batch" (e.g. yesterday's duplicate).
    var TIME_WINDOW_MS = 4 * 60 * 60 * 1000; 

    // Iterate through all found threads
    for (var i = 0; i < threads.length; i++) {
        var thread = threads[i];
        var threadDate = thread.getLastMessageDate();
        var diff = Math.abs(newestDate - threadDate);

        // Skip if this email is part of an older batch
        if (diff > TIME_WINDOW_MS) {
            continue; 
        }

        // Process the messages in this thread (usually just one)
        var msgs = thread.getMessages();
        var msg = msgs[msgs.length - 1]; // Latest msg in thread
        var subject = msg.getSubject();
        var attachments = msg.getAttachments();
        
        debugLog.push("Processing Email: " + subject + " (" + attachments.length + " att)");

        for (var j = 0; j < attachments.length; j++) {
            var att = attachments[j];
            var name = att.getName().toLowerCase();
            
            // --- ROBUST CSV PARSING (Server Side) ---
            // We use Utilities.parseCsv to handle spaces in headers and quoted fields correctly.
            var parsedData = [];

            if (name.indexOf('tenant_tickler') > -1) {
                 parsedData = this.parseCSV(att.getDataAsString());
                 result.moveOuts = result.moveOuts.concat(parsedData);
            } 
            else if (name.indexOf('unit_vacancy') > -1) {
                 parsedData = this.parseCSV(att.getDataAsString());
                 result.vacancies = result.vacancies.concat(parsedData);
            }
            else if (name.indexOf('inspection_detail') > -1) {
                 parsedData = this.parseCSV(att.getDataAsString());
                 result.inspections = result.inspections.concat(parsedData);
            }
            else if (name.indexOf('work_order') > -1) {
                 parsedData = this.parseCSV(att.getDataAsString());
                 result.workOrders = result.workOrders.concat(parsedData);
            }
            
            if (parsedData.length > 0) {
                 debugLog.push("  -> MATCH: " + name + " (" + parsedData.length + " rows)");
            }
        }
    }
    
    return result;
  },

  // Helper: Use Google's native CSV parser for reliability
  parseCSV: function(csvString) {
    try {
      var table = Utilities.parseCsv(csvString);
      if (!table || table.length < 2) return []; // Need header + data

      // Extract Headers (Row 0)
      var headers = table[0].map(function(h) { return h.trim(); });
      var data = [];

      // Extract Data (Row 1+)
      for (var i = 1; i < table.length; i++) {
        var row = table[i];
        if (row.length === 0 || (row.length === 1 && row[0] === '')) continue; // Skip empty rows
        
        var obj = {};
        for (var k = 0; k < headers.length; k++) {
           // Safely map if row has value
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
