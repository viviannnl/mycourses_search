import { parseRecordingDate, waitForMessage } from './utils.js';

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('%c Extension Installed ', 'background: #222; color: #bada55');
});

// Single message listener for all scraping actions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('%c Message Received ', 'background: #222; color: #bada55', request);

    switch (request.action) {       
        case "scrapeOnePage":
            console.log('%c Scraping One Page ', 'background: #222; color: #bada55', {
                url: request.url,
                page: request.page,
                date: request.date
            });
            scrapeDataFromTab(request.url, request.page, request.date);
            break;
    }
    console.log("Done scraping");
    chrome.runtime.sendMessage({
        action: "backgroundScrapeDone"
    });
    sendResponse({
        action: "backgroundScrapeDone"
    });
    return true; // Keep the message channel open for async responses
});

function scrapeDataFromTab(targetUrl, page, date) {
    console.log("In background.js, Scraping data from tab:", targetUrl, page, date);
    chrome.tabs.query({ url: targetUrl }, (tabs) => {
        if (tabs.length > 0) {
            const tabId = tabs[0].id;
            if (page === "recordings") {
                if (date) {
                    injectScraperScriptOneRecording(tabId, date).then(async () => {
                        // Wait for scraping to complete
                        await waitForMessage("transcriptFoundForOneDate");
                        // Now we can safely close the tab
                        chrome.tabs.remove(tabId);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        chrome.tabs.remove(tabId);
                    });
                }
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
                        //setTimeout(() => {
                            console.log("Waiting for content...");
                            if (page === "recordings") {
                                if (date) {
                                    injectScraperScriptOneRecording(tab.id, date)
                                        .then(async () => {
                                            // Wait for scraping to complete
                                            await waitForMessage("ScraperDone");
                                            // Now we can safely close the tab
                                            //chrome.tabs.remove(tab.id);
                                        })
                                        .catch(error => {
                                            console.error('Error:', error);
                                            //chrome.tabs.remove(tab.id);
                                        });
                                }
                            }
                        //}, 6000);
                    }
                });
            });
        }
    });
}

async function injectScraperScriptOneRecording(tabId, targetDate) {
    console.log("In background.js:injectScraperScriptRecordings, Injecting scraper script for recordings:", tabId, targetDate);
    chrome.scripting.executeScript({
        target: { 
          tabId: tabId,
          allFrames: true
        },
        args: [parseRecordingDate(targetDate).trim()],
        func: async (targetDate) => {
            console.log("Injected into:", document.location.href);
            
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
                //const videoContainer = document.body.querySelectorAll('.v-navigation-drawer__content')[0];
                const videoContainer = await waitForElement('.v-navigation-drawer__content');
                await waitForElement('.layout.column > .pa-1.ma-2.v-card.v-sheet.theme--light.elevation-6');
                const cardDivs = videoContainer.querySelectorAll('.layout.column > .pa-1.ma-2.v-card.v-sheet.theme--light.elevation-6');
                //console.log("In background.js, Found", cardDivs.length, "recordings");
                
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
                        //await new Promise(resolve => setTimeout(resolve, 2000));
                        
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
                chrome.runtime.sendMessage({
                    action: "ScraperDone"
                });
            }
        }
    });
}