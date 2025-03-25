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
  console.log('%c Popup Script Loaded ', 'background: #222; color: #bada55');
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
    let transcriptDates = [];
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Check if we're on a supported page
      const url = tabs[0].url;

      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'search',
        keyword: keyword
      }, function(response) {
        disableSearchButtonState(true); // Disable the search button
        console.log("search: Message sent to content script");
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

        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            let recordingDates;
            if (request.action === "recordingDatesGot") {
                recordingDates = request.dates;
                console.log("In popup.js, Recording dates:", recordingDates);

                for (let curDate of recordingDates) {
                    console.log("In popup.js, Searching for date:", curDate);
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "searchEachDate",
                        url: tabs[0].url,
                        page: "recordings",
                        date: curDate
                    });

                    if (currentMessageListener) {
                        chrome.runtime.onMessage.removeListener(currentMessageListener);
                    }
                    
                    currentMessageListener = (request, sender, sendResponse) => {
                        if (request.action === "transcriptFoundForOneDate") {
                            console.log("In popup.js, Transcript found for one date:", request.date);
                            let transcript = request.transcript.join(" ");
                            console.log(transcript);
                            if (containsWholeWord(transcript, keyword)) {
                            transcriptDates.push(curDate);
                            }
                        }
                    };

                    chrome.runtime.onMessage.addListener(currentMessageListener);
                }
            }

            
        });
        
        // Add error handling
        
        const results = response.results || { slides: [], transcripts: transcriptDates };
        displayResults(results);
        disableSearchButtonState(false); // Re-enable the search button
      });

    });
  }

  function displayResults(results = { slideDates: [], transcriptDates: [] }) {
    resultsDiv.innerHTML = '';
    
    console.log("In popup.js, Results:", results);

    // Format dates nicely
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Combine and deduplicate dates
    const allDates = [...new Set([...results.slideDates, ...results.transcriptDates])];

    if (allDates.length === 0) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                <p>No matches found in any recordings.</p>
            </div>
        `;
        return;
    }

    // Sort dates chronologically
    allDates.sort((a, b) => new Date(a) - new Date(b));

    // Create the results HTML
    resultsDiv.innerHTML = `
        <div class="results-container">
            <h3>Found matches in ${allDates.length} recording(s):</h3>
            <div class="dates-list">
                ${allDates.map(date => `
                    <div class="date-item">
                        ${formatDate(date)}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Add styles for the simple date display
    const style = document.createElement('style');
    style.textContent = `
        .results-container {
            padding: 15px;
        }
        .dates-list {
            margin-top: 10px;
        }
        .date-item {
            padding: 10px;
            margin: 5px 0;
            background-color: #f8f9fa;
            border-left: 3px solid #2196F3;
            border-radius: 4px;
        }
        .no-results {
            color: #666;
            text-align: center;
            padding: 20px;
        }
    `;
    document.head.appendChild(style);
  }

  // Add styles for the new date-based organization
  const style = document.createElement('style');
  style.textContent = `
    .date-section {
        margin-bottom: 20px;
        padding: 15px;
        background-color: #f8f9fa;
        border-radius: 8px;
    }
    
    .date-header {
        color: #2196F3;
        margin-bottom: 15px;
        padding-bottom: 5px;
        border-bottom: 2px solid #e0e0e0;
    }
    
    .slides-section, .transcripts-section {
        margin: 10px 0;
        padding: 10px;
        background-color: white;
        border-radius: 4px;
    }
    
    .result-item {
        margin: 10px 0;
        padding: 10px;
        border-left: 3px solid #2196F3;
        background-color: #fff;
    }
    
    .result-item a {
        color: #2196F3;
        text-decoration: none;
        font-weight: bold;
    }
    
    .result-item a:hover {
        text-decoration: underline;
    }
    
    .content {
        margin: 5px 0;
        color: #333;
    }
    
    mark {
        background-color: #fff3cd;
        padding: 2px;
        border-radius: 2px;
    }
  `;

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