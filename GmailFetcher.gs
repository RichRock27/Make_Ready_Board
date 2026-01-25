var GmailFetcher = {
  getLatestReportData: function() {
    // UPDATED: Search specifically for "MRB Daily Reports"
    var threads = GmailApp.search('subject:"MRB Daily Reports" has:attachment newer_than:2d', 0, 5); 
    
    var result = {
      moveOuts: [],     // From Tenant Tickler 
      vacancies: [],    // From Unit Vacancy
      inspections: [],  // From Inspection Detail
      workOrders: [],   // From Work Order
      timestamp: threads.length > 0 ? threads[0].getLastMessageDate().toLocaleString() : "No recent email found"
    };

    if (threads.length === 0) return result;

    // Use the most recent thread found
    var processedTypes = []; 

    // We only process the very first (newest) thread that matches
    var messages = threads[0].getMessages();
    var msg = messages[messages.length - 1]; // Latest message in thread
    var attachments = msg.getAttachments();

    for (var j = 0; j < attachments.length; j++) {
      var att = attachments[j];
      var name = att.getName().toLowerCase();
      var csvData = [];

      // --- MATCHING LOGIC ---
      if (name.indexOf('tenant_tickler') > -1) {
            csvData = this.parseCSV(att.getDataAsString());
            result.moveOuts = result.moveOuts.concat(csvData);
      } 
      else if (name.indexOf('unit_vacancy') > -1) {
            if (processedTypes.indexOf('vacancy') === -1) {
                result.vacancies = this.parseCSV(att.getDataAsString());
                processedTypes.push('vacancy');
            }
      }
      else if (name.indexOf('inspection_detail') > -1) {
            csvData = this.parseCSV(att.getDataAsString());
            result.inspections = result.inspections.concat(csvData);
      }
      else if (name.indexOf('work_order') > -1) {
            csvData = this.parseCSV(att.getDataAsString());
            result.workOrders = result.workOrders.concat(csvData);
      }
    }
    
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
      Logger.log("Error parsing CSV: " + e.toString());
      return [];
    }
  },

  splitCSVLine: function(str) {
      var matches = str.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!matches) return str.split(','); 
      return matches;
  }
};
