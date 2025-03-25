// Content extractor for slides and recordings
class ContentExtractor {
  constructor() {
    this.slideContent = [];
    this.transcriptDates = [];
  }

  navigateToContent() {
    // Find the Content tab link
    const contentLink = document.querySelector('div[title="Content"] a.d2l-navigation-ib-item-link');
    if (contentLink) {
      //console.log('Found Content tab:', contentLink.href);
      return contentLink.href;
    }
    return null;
  }

  navigateToRecordings() {
    // Find the Lecture Recordings tab link
    const recordingsLink = document.querySelector('div[title="Lecture Recordings"] a.d2l-navigation-ib-item-link');
    if (recordingsLink) {
      //console.log('Found Recordings tab:', recordingsLink.href);
      return recordingsLink.href;
    }
    return null;
  }

  grabContent() {
    // Get URLs for both sections
    const contentUrl = this.navigateToContent();

    if (contentUrl) {
      console.log('Accessing content at:', contentUrl);
      chrome.runtime.sendMessage({ action: "scrapePage", url: contentUrl, page: "content" });
    }
  }

  grabRecordings(keyword) {
    const recordingsUrl = this.navigateToRecordings();
    //console.log("In content.js, Navigating to recordings at:", recordingsUrl);
    if (recordingsUrl) {
      //console.log('Accessing recordings at:', recordingsUrl);
      chrome.runtime.sendMessage({ action: "scrapePage", url: recordingsUrl, page: "recordings" });
    }
  }

  grabOneRecording(date) {
    const recordingsUrl = this.navigateToRecordings();
    //console.log("In content.js, Navigating to recordings at:", recordingsUrl);
    if (recordingsUrl) {
      chrome.runtime.sendMessage(
        { action: "scrapeOnePage", url: recordingsUrl, page: "recordings", date: date },
      );
    }
  }

  search(keyword) {
    const results = {
      slides: [],
      transcripts: []
    };

    

    return results;
  }
}

const extractor = new ContentExtractor();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('In content.js, received message:', request);
  if (request.action === 'search') {
    console.log('In content.js, Searching for:', request.keyword);
    extractor.grabContent();
    extractor.grabRecordings(request.keyword);
    //const results = extractor.search(request.keyword);
    sendResponse({
      results: {}
    });
  } else if (request.action === 'searchOne') {
    console.log('In content.js, Searching for one recording:', request.date);
    extractor.grabOneRecording(request.date);
    sendResponse({
      results: {}
    });
  } else {
    // Always send a response, even for unknown actions
    sendResponse({
      results: {
        slides: [],
        transcripts: []
      }
    });
  }
  return true;  // Required to use sendResponse asynchronously
}); 