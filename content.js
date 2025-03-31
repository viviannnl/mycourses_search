// Content extractor for slides and recordings
class ContentExtractor {
  constructor() {
    this.slideContent = [];
    this.transcriptDates = [];
  }
  navigateToRecordings() {
    // Find the Lecture Recordings tab link
    const recordingsLink = document.querySelector('a[href*="/d2l/lp/navbars/"]');
    if (recordingsLink) {
      console.log('Found Recordings tab:', recordingsLink.href);
      return recordingsLink.href;
    }
    return null;
  }

  grabOneRecording(date) {
    const recordingsUrl = this.navigateToRecordings();
    console.log("In content.js, Navigating to recordings at:", recordingsUrl);
    if (recordingsUrl) {
      chrome.runtime.sendMessage(
        { action: "scrapeOnePage", url: recordingsUrl, page: "recordings", date: date },
      );
    }
  }
}

const extractor = new ContentExtractor();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('In content.js, received message:', request);

    switch (request.action) {
        case 'searchOne':
            console.log('In content.js, Searching for one recording:', request.date);
            extractor.grabOneRecording(request.date);
            sendResponse({ results: {} });
            break;

        default:
            // Always send a response, even for unknown actions
            console.log('In content.js, Unknown action:', request.action);
            sendResponse({
                results: {
                    slides: [],
                    transcripts: []
                }
            });
            break;
    }

    return true; // Keep the message channel open for async responses
}); 