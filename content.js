console.log('In content.js, starting');
// Content extractor for slides and recordings
class ContentExtractor {
  constructor() {
    this.slideContent = [];
    this.transcriptContent = [];
  }
/*
  extractSlideContent() {
    
    if (window.location.hostname.includes('docs.google.com')) {
      const slides = document.querySelectorAll('.slide-content');
      slides.forEach((slide, index) => {
        this.slideContent.push({
          index: index,
          content: slide.textContent,
          url: window.location.href + '#slide=' + (index + 1)
        });
      });
    }
  }

  extractTranscriptContent() {
    const lectureRecordings = document.querySelector('.d2l-navigation-ib-item[title="Lecture Recordings"]');
    console.log(lectureRecordings);
    if (window.location.hostname.includes('zoom.us')) {
      const transcriptElements = document.querySelectorAll('.transcript-content');
      transcriptElements.forEach((element, index) => {
        this.transcriptContent.push({
          timestamp: element.getAttribute('data-timestamp'),
          content: element.textContent,
          url: window.location.href
        });
      });
    }
  }
*/
  async navigateToContent() {
    // Find the Content tab link
    const contentLink = document.querySelector('div[title="Content"] a.d2l-navigation-ib-item-link');
    if (contentLink) {
      //console.log('Found Content tab:', contentLink.href);
      return contentLink.href;
    }
    return null;
  }

  async navigateToRecordings() {
    // Find the Lecture Recordings tab link
    const recordingsLink = document.querySelector('div[title="Lecture Recordings"] a.d2l-navigation-ib-item-link');
    if (recordingsLink) {
      //console.log('Found Recordings tab:', recordingsLink.href);
      return recordingsLink.href;
    }
    return null;
  }

  async grabContent() {
    // Get URLs for both sections
    const contentUrl = await this.navigateToContent();
    const recordingsUrl = await this.navigateToRecordings();

    if (contentUrl) {
      // We might need to fetch content from this URL
      console.log('Accessing content at:', contentUrl);
      // grab content from this URL and push it to the slideContent array
      /*
      fetch(contentUrl)
      .then(response => response.text()) // Use `.json()` if expecting JSON
      .then(data => {
          console.log("Fetched Content:", data);
      })
      .catch(error => console.error("Error fetching content:", error));
      */
      chrome.runtime.sendMessage({ action: "scrapePage", url: contentUrl, page: "content" });
      // You might need to handle iframe content or make an XHR request
    }

    if (recordingsUrl) {
      console.log('Accessing recordings at:', recordingsUrl);
      // grab content from this URL
      /*
      fetch(recordingsUrl)
        .then(response => response.text()) // Use `.json()` if expecting JSON
        .then(data => {
            console.log("Fetched Content:", data);
        })
        .catch(error => console.error("Error fetching content:", error));
      */
      chrome.runtime.sendMessage({ action: "scrapePage", url: recordingsUrl, page: "recordings" });
      // Similar handling for recordings
    }
  }

  search(keyword) {
    const results = {
      slides: [],
      transcripts: []
    };

    // Search in slides
    this.slideContent.forEach(slide => {
      if (slide.content.toLowerCase().includes(keyword.toLowerCase())) {
        results.slides.push(slide);
      }
    });

    // Search in transcripts
    this.transcriptContent.forEach(transcript => {
      if (transcript.content.toLowerCase().includes(keyword.toLowerCase())) {
        results.transcripts.push(transcript);
      }
    });

    return results;
  }
}

// Initialize content extractor
const extractor = new ContentExtractor();
// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('In content.js, received message:', request);
  if (request.action === 'search') {
    console.log('In content.js, Searching for:', request.keyword);
    extractor.grabContent();
    const results = extractor.search(request.keyword);
    sendResponse({
      results: {
        slides: results.slides || [],
        transcripts: results.transcripts || []
      }
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