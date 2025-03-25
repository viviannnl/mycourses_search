import { parseRecordingDate } from './src/utils/contentParser.js';

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrapeOnePage") {
        console.log("In background.js, Scraping one page:", request.url, request.page, request.date);
        scrapeDataFromTab(request.url, request.page, request.date);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "searchEachDate") {
        console.log("In background.js, Searching for each date:", request.url, request.page, request.date);
        scrapeDataFromTabForEachDate(request.url, request.page, request.date);
    }
});

function scrapeDataFromTab(targetUrl, page, date) {
    console.log("In background.js, Scraping data from tab:", targetUrl, page, date);
    chrome.tabs.query({ url: targetUrl }, (tabs) => {
        
        if (tabs.length > 0) {
            const tabId = tabs[0].id;
            if (page === "recordings") {
                if (date) {
                    injectScraperScriptOneRecording(tabId, date);
                } else {
                    injectScraperScriptRecordings(tabId);
                }
            } else {
                injectScraperScriptContent(tabId);
            }
        } else {
            console.log("In background.js, Creating tab:", targetUrl);
            chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
                // Send the tab ID to the popup
                chrome.runtime.sendMessage({ 
                    action: "processingTabCreated", 
                    tabId: tab.id 
                });

                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === tab.id && changeInfo.status === "complete") {
                        chrome.tabs.onUpdated.removeListener(listener);
                        setTimeout(() => {
                            console.log("Waiting for content...");
                            if (page === "content") {
                                injectScraperScriptContent(tab.id);
                            } else if (page === "recordings") {
                                if (date) {
                                    
                                    injectScraperScriptOneRecording(tab.id, date).then(() => {
                                        setTimeout(() => {
                                            chrome.tabs.remove(tab.id);
                                        }, 6000);
                                    }).catch(error => {
                                        console.error('Error:', error);
                                        chrome.tabs.remove(tab.id);
                                    });
                                } else {
                                    injectScraperScriptRecordings(tab.id).then(() => {
                                        setTimeout(() => {
                                            chrome.tabs.remove(tab.id);
                                        }, 6000);
                                    });
                                }
                            }
                        }, 6000);
                    }
                });
            });
        }
    });
}

function scrapeDataFromTabForEachDate(targetUrl, page, date) {
    chrome.tabs.query({ url: targetUrl }, (tabs) => {

        chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
            console.log("In background.js, Creating tab:", tab.id);
            // Send the tab ID to the popup
            chrome.runtime.sendMessage({ 
                action: "processingTabCreated", 
                tabId: tab.id 
            });

            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                if (tabId === tab.id && changeInfo.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(listener);
                    setTimeout(() => {
                        injectScraperScriptEachRecording(tab.id, date);
                    }, 6000);
                }
            });
        });
    });
}


async function injectScraperScriptOneRecording(tabId, targetDate) {
    //console.log("In background.js:injectScraperScriptRecordings, Injecting scraper script for recordings:", tabId, targetDate);
    chrome.scripting.executeScript({
        target: { 
          tabId: tabId,
          allFrames: true
        },
        args: [parseRecordingDate(targetDate).trim()],
        func: async (targetDate) => {
            //console.log("Injected into:", document.location.href);
            
            // Helper function to wait for element to appear
            const waitForElement = async (selector, timeout = 5000) => {
                const startTime = Date.now();
                while (Date.now() - startTime < timeout) {
                    const element = document.querySelector(selector);
                    if (element) return element;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                throw new Error(`Timeout waiting for element: ${selector}`);
            };

            let found = false;

            if (document.location.href.includes("lrs")) {
                //console.log("In background.js, Scraping recordings page:", document.location.href);
                const navigationContainer = document.body.querySelector('.v-navigation-drawer__content');
                const cardDivs = document.querySelectorAll('.layout.column > .pa-1.ma-2.v-card.v-sheet.theme--light.elevation-6');
                
                for (let i = 0; i < cardDivs.length; i++) {
                    try {
                        const card = cardDivs[i];
                        const videoThumb = card.querySelector('.videothumb');
                        if (!videoThumb) continue;
                        
                        const recordingDate = card.querySelector('.recordingdate')?.textContent.split(" @")[0].trim();
                        console.log("In background.js, Recording date:", recordingDate);
                        if (targetDate) { 
                            if (recordingDate !== targetDate) {
                                console.log(`Skipping recording from ${recordingDate}, looking for ${targetDate}`);
                                continue;
                            }

                            console.log(`Found matching recording from ${recordingDate}`);
                        }
                        
                        videoThumb.click();
                        
                        try {
                            await waitForElement('.v-list-item.theme--light');
                        } catch (error) {
                            console.error("Error waiting for element:", error);
                            chrome.runtime.sendMessage({
                                action: "noTranscriptFound",
                                date: targetDate
                            });
                            if (targetDate) {
                                break;
                            }
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        let transcript = [];
                        const transcriptContainer = document.querySelectorAll('.v-navigation-drawer__content')[1];
                        const transcriptElements = transcriptContainer.querySelectorAll('.v-list-item');
                        //console.log(transcriptElements);
                        transcriptElements.forEach(el => {
                            const content = el.querySelector('.v-list-item__content')?.querySelector('span')?.textContent;
                            if (content) transcript.push(content);
                        });
                        
                        //console.log(`Transcript for recording on ${recordingDate}:`, transcript);
                        
                        if (targetDate) {
                            found = true;
                            console.log("In background.js, Sending transcript to content.js:", transcript);
                            chrome.runtime.sendMessage({
                                action: "transcriptFound",
                                date: recordingDate,
                                transcript: transcript
                            });
                            
                            break;
                        }
                        
                    } catch (error) {
                        console.error("Error processing video:", error);
                    }
                }

                if (targetDate && !found) {
                    console.log("In background.js, No recording found for:", targetDate);
                    chrome.runtime.sendMessage({
                        action: "noTranscriptFound",
                        date: targetDate
                    });
                }
            }
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
            if (document.location.href.includes("lrs")) {
                const cardDivs = document.querySelectorAll('.layout.column > .pa-1.ma-2.v-card.v-sheet.theme--light.elevation-6');
                const recordingDates = [];
                for (let i = 0; i < cardDivs.length; i++) {
                    
                    try {
                        const card = cardDivs[i];
                        const videoThumb = card.querySelector('.videothumb');
                        if (!videoThumb) continue;
                        
                        const recordingDate = card.querySelector('.recordingdate')?.textContent;
                        //console.log("Processing recording from:", recordingDate);
                        recordingDates.push(recordingDate);
                        
                    } catch (error) {
                        console.error("Error processing video:", error);
                    }
                    
                }
                console.log("In background.js, Recording dates:", recordingDates);
                chrome.runtime.sendMessage({
                    action: "recordingDatesGot",
                    dates: recordingDates
                });
            }
        }
    });
}

async function injectScraperScriptEachRecording(tabId, date) {
    chrome.scripting.executeScript({
        target: { 
          tabId: tabId,
          allFrames: true
        },
        args: [date],
        func: async (targetDate) => {            
            // Helper function to wait for element to appear
            const waitForElement = async (selector, timeout = 5000) => {
                const startTime = Date.now();
                while (Date.now() - startTime < timeout) {
                    const element = document.querySelector(selector);
                    if (element) return element;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                throw new Error(`Timeout waiting for element: ${selector}`);
            };

            let found = false;

            if (document.location.href.includes("lrs")) {
                //console.log("In background.js, Scraping recordings page:", document.location.href);
                const cardDivs = document.querySelectorAll('.layout.column > .pa-1.ma-2.v-card.v-sheet.theme--light.elevation-6');
                
                for (let i = 0; i < cardDivs.length; i++) {
                    try {
                        const card = cardDivs[i];
                        const videoThumb = card.querySelector('.videothumb');
                        if (!videoThumb) continue;
                        
                        const recordingDate = card.querySelector('.recordingdate')?.textContent;
                        console.log("In background.js, Recording date:", recordingDate);
                        if (targetDate) { 
                            if (recordingDate !== targetDate) {
                                console.log(`Skipping recording from ${recordingDate}, looking for ${targetDate}`);
                                continue;
                            }

                            console.log(`Found matching recording from ${recordingDate}`);
                        }
                        
                        videoThumb.click();
                        
                        try {
                            await waitForElement('.v-list-item.theme--light');
                        } catch (error) {
                            console.error("Error waiting for element:", error);
                            chrome.runtime.sendMessage({
                                action: "noTranscriptFound",
                                date: targetDate
                            });
                            if (targetDate) {
                                break;
                            }
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        let transcript = [];
                        const transcriptContainer = document.querySelectorAll('.v-navigation-drawer__content')[1];
                        const transcriptElements = transcriptContainer.querySelectorAll('.v-list-item');
                        //console.log(transcriptElements);
                        transcriptElements.forEach(el => {
                            const content = el.querySelector('.v-list-item__content')?.querySelector('span')?.textContent;
                            if (content) transcript.push(content);
                        });
                        
                        //console.log(`Transcript for recording on ${recordingDate}:`, transcript);
                        
                        if (targetDate) {
                            found = true;
                            console.log("In background.js, Sending transcript to content.js:", transcript);
                            chrome.runtime.sendMessage({
                                action: "transcriptFoundForOneDate",
                                date: recordingDate,
                                transcript: transcript
                            });
                            
                            break;
                        }
                        
                    } catch (error) {
                        console.error("Error processing video:", error);
                    }
                }

                if (targetDate && !found) {
                    console.log("In background.js, No recording found for:", targetDate);
                    chrome.runtime.sendMessage({
                        action: "noTranscriptFound",
                        date: targetDate
                    });
                }
            }
        }
    })
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