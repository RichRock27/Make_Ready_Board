var GmailFetcher = {
  getLatestReportData: function() {
    // Search for threads from the last 2 days to catch the latest batch of reports
    // We expect multiple emails (Vacancy, Tickler, Work Orders, Inspections)
    var query = 'subject:"MRB Daily Reports" has:attachment newer_than:2d';
    
    // Fetch up to 20 threads to ensure we get all the split reports
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

    // --- BATCHING LOGIC ---
    // The reports arrive as separate emails around the same time.
    // We want to group the "latest batch" and ignore older ones (e.g. from yesterday).
    
    // 1. Establish the "Anchor" time from the very newest thread.
    var newestDate = threads[0].getLastMessageDate();
    result.timestamp = newestDate.toLocaleString();
    debugLog.push("Newest Email Date: " + result.timestamp);

    // 2. Define a time window (e.g., 4 hours). Only process emails that arrived 
    //    within 4 hours of the newest email.
    var TIME_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours

    // Iterate through all found threads
    for (var i = 0; i < threads.length; i++) {
        var thread = threads[i];
        var threadDate = thread.getLastMessageDate();
        var diff = Math.abs(newestDate - threadDate);

        // Skip if this email is part of an older batch
        if (diff > TIME_WINDOW_MS) {
            debugLog.push("Skipping older thread [" + i + "] from " + threadDate.toLocaleString());
            continue; 
        }

        // Process the messages in this thread (usually just one)
        var msgs = thread.getMessages();
        var msg = msgs[msgs.length - 1]; // Latest msg in thread
        var subject = msg.getSubject();
        
        debugLog.push("Processing Email: [" + subject + "]");
        
        var attachments = msg.getAttachments();
        debugLog.push("  -> Attachments: " + attachments.length);

        for (var j = 0; j < attachments.length; j++) {
            var att = attachments[j];
            var name = att.getName().toLowerCase();
            debugLog.push("  -> File: " + name);

            // --- CSV PARSING ROUTER ---
            // We use concat because files might be split (e.g. Next 90 Days / Last 90 Days)
            
            if (name.indexOf('tenant_tickler') > -1) {
                 var data = this.parseCSV(att.getDataAsString());
                 result.moveOuts = result.moveOuts.concat(data);
                 debugLog.push("     -> MATCH: Added " + data.length + " move out rows.");
            } 
            else if (name.indexOf('unit_vacancy') > -1) {
                 var data = this.parseCSV(att.getDataAsString());
                 result.vacancies = result.vacancies.concat(data);
                 debugLog.push("     -> MATCH: Added " + data.length + " vacancy rows.");
            }
            else if (name.indexOf('inspection_detail') > -1) {
                 var data = this.parseCSV(att.getDataAsString());
                 result.inspections = result.inspections.concat(data);
                 debugLog.push("     -> MATCH: Added " + data.length + " inspection rows.");
            }
            else if (name.indexOf('work_order') > -1) {
                 var data = this.parseCSV(att.getDataAsString());
                 result.workOrders = result.workOrders.concat(data);
                 debugLog.push("     -> MATCH: Added " + data.length + " work order rows.");
            } else {
                 debugLog.push("     -> IGNORED: Filename keywords not matched.");
            }
        }
    }
    
    debugLog.push("Summary: Vacancies=" + result.vacancies.length + ", MoveOuts=" + result.moveOuts.length + ", Insp=" + result.inspections.length + ", WOs=" + result.workOrders.length);
    
    return result;
  },

  parseCSV: function(csvString) {
    try {
      var lines = csvString.split(/\r\n|\n/);
      var headers = [];
      var data = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var row = this.splitCSVLine(line);
        if (i === 0) {
          headers = row.map(function(h) { return h.replace(/^"|"$/g, '').trim(); });
        } else {
          var obj = {};
          // Map row to headers
          for (var k = 0; k < headers.length; k++) {
            if (row[k] !== undefined) {
                 obj[headers[k]] = row[k].replace(/^"|"$/g, '').trim();
            }
          }
          data.push(obj);
        }
      }
      return data;
    } catch (e) {
      return [];
    }
  },

  splitCSVLine: function(str) {
      var matches = str.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      return matches ? matches : str.split(',');
  }
};
