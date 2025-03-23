// Content extractor for slides and recordings
class ContentExtractor {
  constructor() {
    this.slideContent = [];
    this.transcriptContent = [];
  }

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
  if (request.action === 'extract') {
    extractor.extractSlideContent();
    extractor.extractTranscriptContent();
    sendResponse({success: true});
  } else if (request.action === 'search') {
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