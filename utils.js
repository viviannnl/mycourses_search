export function containsWholeWord(text, word) {
  let regex = new RegExp(`\\b${word}\\b`, 'i'); // \b ensures word boundaries, 'i' makes it case-insensitive
  return regex.test(text);
}

export function parseRecordingDate(dateStr) {
  if (!dateStr) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [year, month, day] = dateStr.split("-").map(Number);
  
  // Get the month abbreviation
  const monthAbbr = months[month - 1];

  // Function to get ordinal suffix (st, nd, rd, th)
  const getOrdinal = (num) => {
      if (num >= 11 && num <= 13) return "th";
      const lastDigit = num % 10;
      return lastDigit === 1 ? "st" :
             lastDigit === 2 ? "nd" :
             lastDigit === 3 ? "rd" : "th";
  };

  return `${monthAbbr} ${day}${getOrdinal(day)}`;
}

export function waitForTabToClose(tabId, callback) {
  function checkTabClosure(removedTabId) {
      if (removedTabId === tabId) {
          console.log(`Tab ${tabId} closed.`);
          chrome.tabs.onRemoved.removeListener(checkTabClosure); // Stop listening
          callback(); // Call the next step
      }
  }
  chrome.tabs.onRemoved.addListener(checkTabClosure);
}

export function findTab(urlPart, callback) {
  chrome.tabs.query({}, (tabs) => {
      const targetTab = tabs.find(tab => tab.url && tab.url.includes(urlPart));
      callback(targetTab);
  });
}

export function waitForMessage(expectedAction) {
  return new Promise((resolve) => {
      function messageListener(message) {
          if (message.action === expectedAction) {
              chrome.runtime.onMessage.removeListener(messageListener);
              resolve(message);
          }
      }
      chrome.runtime.onMessage.addListener(messageListener);
  });
}