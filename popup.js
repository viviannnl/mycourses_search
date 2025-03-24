document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput');
  const dateInput = document.getElementById('dateInput');
  const searchButton = document.getElementById('searchButton');
  const downloadButton = document.getElementById('downloadButton');
  const resultsDiv = document.getElementById('results');
  let currentTranscript = null; // Store the current transcript

  // Add initial message to confirm script is loading
  console.log('Popup script loaded');
  resultsDiv.textContent = 'Ready to search...';

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

    // Show loading state
    resultsDiv.innerHTML = '<div>Loading transcript...</div>';
    downloadButton.style.display = 'none'; // Hide download button while loading
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send initial message
      chrome.tabs.sendMessage(tab.id, {
        action: "searchOne",
        url: tab.url,
        page: "recordings",
        date: selectedDate
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          resultsDiv.innerHTML = '<div class="error-message">Error: Could not connect to page</div>';
          return;
        }
        // Initial response received, now wait for the actual transcript
        console.log('Search started:', response);
      });

      window.focus();

      // Listen for the transcript or error
      chrome.runtime.onMessage.addListener(function transcriptListener(message) {
        if (message.action === "transcriptFound") {
          console.log('Transcript found:', message);
          chrome.runtime.onMessage.removeListener(transcriptListener);
          if (message.transcript && message.transcript.length > 0) {
            currentTranscript = message; // Store the current transcript
            const transcriptHtml = message.transcript
              .map(text => `<p>${text}</p>`)
              .join('');
            resultsDiv.innerHTML = `
              <h3>Transcript for ${message.date}</h3>
              <div class="transcript-content">${transcriptHtml}</div>
            `;
            downloadButton.style.display = 'block'; // Show download button
          } else {
            resultsDiv.innerHTML = `
              <div class="no-results">No transcript found for ${selectedDate}</div>
            `;
            downloadButton.style.display = 'none'; // Hide download button
          }
        } else if (message.action === "noTranscriptFound") {
          chrome.runtime.onMessage.removeListener(transcriptListener);
          resultsDiv.innerHTML = `
            <div class="no-results">No recording found for ${message.date}</div>
          `;
          downloadButton.style.display = 'none'; // Hide download button
        } else if (message.action === "searchError") {
            chrome.runtime.onMessage.removeListener(transcriptListener);
            resultsDiv.innerHTML = `
              <div class="error-message">Error: ${message.error}</div>
            `;
            downloadButton.style.display = 'none'; // Hide download button
        } 
      });

    } catch (error) {
      resultsDiv.innerHTML = `
        <div class="error-message">Error: ${error.message}</div>
      `;
      downloadButton.style.display = 'none'; // Hide download button
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
      /*
      if (!url.includes('docs.google.com') && !url.includes('zoom.us')) {
        displayError('This extension only works on Google Slides and Zoom pages.');
        return;
      }
      */
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