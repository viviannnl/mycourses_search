document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput');
  const dateInput = document.getElementById('dateInput');
  const searchButton = document.getElementById('searchButton');
  const downloadButton = document.getElementById('downloadButton');
  const resultsDiv = document.getElementById('results');
  let currentTranscript = null; // Store the current transcript
  let currentMessageListener = null; // Track the current listener
  let processingTabId = null; // Track the processing tab ID

  // Add initial message to confirm script is loading
  console.log('Popup script loaded');
  resultsDiv.textContent = 'Ready to search...';

  // Function to enable/disable search button
  const disableSearchButtonState = (disabled) => {
    searchButton.disabled = disabled;
    searchButton.style.opacity = disabled ? '0.5' : '1';
    searchButton.style.cursor = disabled ? 'not-allowed' : 'pointer';
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "processingTabCreated") {
      processingTabId = request.tabId;
      disableSearchButtonState(true); // Disable the search button
    }
  });

  // Listen for tab removal
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === processingTabId) {
      processingTabId = null;
      disableSearchButtonState(false); // Re-enable the search button
    }
  });

  // Handle transcript download
  downloadButton.addEventListener('click', () => {
    if (!currentTranscript || !currentTranscript.transcript || !currentTranscript.date) {
      console.error('No transcript available to download');
      return;
    }

    // Create transcript text
    const transcriptText = currentTranscript.transcript.join('\n\n');
    
    // Create blob and download link
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${currentTranscript.date.replace(/\//g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Handle date-based search
  searchButton.addEventListener('click', async (e) => {
    e.preventDefault();
    const selectedDate = dateInput.value;
    if (!selectedDate) {
      resultsDiv.innerHTML = '<div class="error-message">Please select a date</div>';
      return;
    }

    // Disable search button
    disableSearchButtonState(true);

    // Remove any existing message listener
    if (currentMessageListener) {
      chrome.runtime.onMessage.removeListener(currentMessageListener);
    }

    // Show loading state
    resultsDiv.innerHTML = `<div class="loading">Searching for recording on ${selectedDate}...</div>`;
    downloadButton.style.display = 'none';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Create new message listener for this search
      currentMessageListener = function(message) {
        if (message.action === "transcriptFound") {
          console.log('Transcript found:', message);
          if (message.transcript && message.transcript.length > 0) {
            currentTranscript = message;
            const transcriptHtml = message.transcript
              .map(text => `<p>${text}</p>`)
              .join('');
            resultsDiv.innerHTML = `
              <h3>Transcript for ${selectedDate}</h3>
              <div class="transcript-content">${transcriptHtml}</div>
            `;
            downloadButton.style.display = 'block';
          } else {
            resultsDiv.innerHTML = `
              <div class="no-results">
                <p>No transcript found for ${selectedDate}</p>
                <p>The recording might exist but has no transcript available.</p>
              </div>
            `;
            downloadButton.style.display = 'none';
          }
        } else if (message.action === "searchError" || message.action === "noTranscriptFound") {
          resultsDiv.innerHTML = `
            <div class="error-message">
              <p>No recording found for ${selectedDate}</p>
              <p>Please make sure:</p>
              <ul>
                <li>The date is correct</li>
                <li>You're on the right course page</li>
                <li>A recording exists for this date</li>
              </ul>
            </div>
          `;
          downloadButton.style.display = 'none';
        }
      };

      // Add the new listener
      chrome.runtime.onMessage.addListener(currentMessageListener);

      // Send the search message
      chrome.tabs.sendMessage(tab.id, {
        action: "searchOne",
        url: tab.url,
        page: "recordings",
        date: selectedDate
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          resultsDiv.innerHTML = `
            <div class="error-message">
              <p>Error: Could not connect to page</p>
              <p>Please make sure you're on the Lecture Recordings page</p>
            </div>`;
          disableSearchButtonState(false); // Re-enable on error
          return;
        }
        console.log('Search started:', response);
      });

      window.focus();

    } catch (error) {
      resultsDiv.innerHTML = `
        <div class="error-message">
          <p>Error: ${error.message}</p>
          <p>Please try again or refresh the page.</p>
        </div>
      `;
      downloadButton.style.display = 'none';
      disableSearchButtonState(false); // Re-enable on error
    }
  });

  searchInput.addEventListener('input', debounce(function() {
    console.log('Performing search with keyword:', this.value);
    resultsDiv.textContent = 'Searching for: ' + this.value;
    performSearch(this.value);
  }, 300));

  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      console.log('Enter key pressed');
      resultsDiv.textContent = 'Searching for: ' + this.value;
      performSearch(this.value);
    }
  });

  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  function performSearch(keyword) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Check if we're on a supported page
      const url = tabs[0].url;

      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'search',
        keyword: keyword
      }, function(response) {
        console.log("search: Message sent to content script");
        // Add error handling
        if (!response) {
          console.error('No response from content script');
          displayError('Unable to search content. Please refresh the page and try again.');
          return;
        }
        
        const results = response.results || { slides: [], transcripts: [] };
        displayResults(results);
      });

    });
  }

  function displayResults(results = { slides: [], transcripts: [] }) {
    resultsDiv.innerHTML = '';
    
    // Ensure results object has required properties
    results.slides = results.slides || [];
    results.transcripts = results.transcripts || [];
    
    // Check if there are no results at all
    if (!results.slides.length && !results.transcripts.length) {
        const noResultsDiv = document.createElement('div');
        noResultsDiv.innerHTML = `
            <p class="no-results">No matches found. Try different search terms.</p>
        `;
        resultsDiv.appendChild(noResultsDiv);
        return;
    }
    
    if (results.slides.length > 0) {
      const slidesHeader = document.createElement('h3');
      slidesHeader.textContent = 'Slides Results';
      resultsDiv.appendChild(slidesHeader);
      
      results.slides.forEach(slide => {
        const div = document.createElement('div');
        div.innerHTML = `
          <p><a href="${slide.url}" target="_blank">Slide ${slide.index + 1}</a></p>
          <p>${highlight(slide.content, keyword)}</p>
        `;
        resultsDiv.appendChild(div);
      });
    }

    if (results.transcripts.length > 0) {
      const transcriptHeader = document.createElement('h3');
      transcriptHeader.textContent = 'Transcript Results';
      resultsDiv.appendChild(transcriptHeader);
      
      results.transcripts.forEach(transcript => {
        const div = document.createElement('div');
        div.innerHTML = `
          <p><a href="${transcript.url}?t=${transcript.timestamp}" target="_blank">
            ${formatTimestamp(transcript.timestamp)}
          </a></p>
          <p>${highlight(transcript.content, keyword)}</p>
        `;
        resultsDiv.appendChild(div);
      });
    }
  }

  function highlight(content, keyword) {
    const regex = new RegExp(keyword, 'gi');
    return content.replace(regex, match => `<mark>${match}</mark>`);
  }

  function formatTimestamp(timestamp) {
    // Convert timestamp to readable format
    const date = new Date(timestamp * 1000);
    return date.toISOString().substr(11, 8);
  }

  // Add this new function to handle errors
  function displayError(message) {
    resultsDiv.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
        </div>
    `;
  }
}); 