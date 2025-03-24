// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // You can add initialization logic here
    console.log('Tab updated:', tab.url);
  }
}); 

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrapePage") {
        scrapeDataFromTab(request.url, request.page);
    }
});

function scrapeDataFromTab(targetUrl, page) {
    // Find or open the tab with the given URL
    chrome.tabs.query({ url: targetUrl }, (tabs) => {
        if (tabs.length > 0) {
        // Use the existing tab
        const tabId = tabs[0].id;
        injectScraperScript(tabId);
        } else {
        // Open a new tab and scrape after it loads
        chrome.tabs.create({ url: targetUrl }, (tab) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === tab.id && changeInfo.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(() => {
                    console.log("Waiting for content...");
                    if (page === "content") {
                        injectScraperScriptContent(tab.id);
                    } else if (page === "recordings") {
                        injectScraperScriptRecordings(tab.id);
                    }
                }, 5000); // Adjust timing as needed
            }
            });
        });
        }
    });
}

async function injectScraperScriptRecordings(tabId) {
    chrome.scripting.executeScript({
        target: { 
          tabId: tabId,
          allFrames: true
        },
        func: async () => {
            console.log("Injected into:", document.location.href);
            
            // Helper function to wait for element to appear
            const waitForElement = async (selector, timeout = 30000) => {
                const startTime = Date.now();
                while (Date.now() - startTime < timeout) {
                    const element = document.querySelector(selector);
                    //console.log("from waitForElement:", element);
                    if (element) return element;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                throw new Error(`Timeout waiting for element: ${selector}`);
            };

            if (document.location.href.includes("lrs")) {
                const navigationContainer = document.body.querySelector('.v-navigation-drawer__content');
                const cardDivs = document.querySelectorAll('.layout.column > .pa-1.ma-2.v-card.v-sheet.theme--light.elevation-6');
                
                for (let i = 0; i < cardDivs.length; i++) {
                    try {
                        
                        const card = cardDivs[i];
                        const videoThumb = card.querySelector('.videothumb');
                        if (!videoThumb) continue;
                        
                        // current video date
                        console.log("Processing video date:", card.querySelector('.recordingdate')?.textContent);
                        
                        // Click the video
                        videoThumb.click();
                        
                        // Wait for the video player to load
                        //await waitForElement('.v-list-item.theme--light');
                        
                        // Additional wait to ensure transcript is fully loaded
                        
                        //await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Get all transcript elements
                        const transcriptElements = document.querySelectorAll('.v-list-item.theme--light');
                        
                        //console.log(document);
                        //console.log("Current video date:", document.querySelector('.recordingdate')?.textContent);
                        /*
                        if (currentVideoDate !== videoDate) {
                            console.log("Transcript mismatch detected, retrying...");
                            continue;
                        }
                        
                        */
                        let transcript = [];
                        transcriptElements.forEach(el => {
                            const content = el.querySelector('.v-list-item__content')?.querySelector('span')?.textContent;
                            if (content) transcript.push(content);
                        });
                        
                        console.log(`Transcript for Video "${i}":`, transcript);
                        
                        
                    } catch (error) {
                        //console.error("Error processing video:", error);
                    }
                }
            }
        }
    });
}

function injectScraperScriptContent(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: scrapeContent
    });
}

function scrapeContent() {
    //const data = [...document.querySelectorAll(".navigation-item")].map(el => el.innerText);
    const iframe = document.querySelector('iframe');
    // for content page
    const navigationContainer = iframe.contentDocument.querySelector('.navigation-tree');
    console.log(navigationContainer);

    // Send data back to the background script
    //chrome.runtime.sendMessage({ action: "scrapedData", data });
}
  /*
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrapedData") {
      console.log("Received scraped data:", request.data);
    }
  });
  */

function scrapeRecordings() {

}