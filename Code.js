function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Make Ready Board')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getData() {
  try {
    var data = GmailFetcher.getLatestReportData();
    
    // Enrich with shared hidden list
    try {
      var hiddenJSON = PropertiesService.getScriptProperties().getProperty('mrb_hidden_list');
      if (hiddenJSON) {
         data.hiddenList = JSON.parse(hiddenJSON);
      }
    } catch (err) {
      console.error("Error fetching hidden list: " + err);
    }
    
    return { status: 'success', data: data };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function setHiddenUnits(hiddenArray) {
  try {
    // Save to Shared Properties (Team View)
    // Basic validation
    if(!Array.isArray(hiddenArray)) throw new Error("Invalid Input");
    
    // Store as JSON string. Note: ScriptProperties has 9KB limit per value. 
    // For 200 units * 20 chars = 4000 bytes. Safe for now.
    var json = JSON.stringify(hiddenArray);
    PropertiesService.getScriptProperties().setProperty('mrb_hidden_list', json);
    return { status: 'success' };
  } catch (e) {
     return { status: 'error', message: e.toString() };
  }
}
