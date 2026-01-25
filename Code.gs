function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Make Ready Board')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getData() {
  try {
    var data = GmailFetcher.getLatestReportData();
    return { status: 'success', data: data };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}
