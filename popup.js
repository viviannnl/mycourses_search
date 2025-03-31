document.addEventListener('DOMContentLoaded', function() {
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
}); 