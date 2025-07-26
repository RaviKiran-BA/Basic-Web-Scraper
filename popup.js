let scrapedData = [];

document.addEventListener('DOMContentLoaded', function() {
    const selectorInput = document.getElementById('selector');
    const attributeSelect = document.getElementById('attribute');
    const scrapeBtn = document.getElementById('scrapeBtn');
    const exportBtn = document.getElementById('exportBtn');
    const resultsDiv = document.getElementById('results');
    const statusDiv = document.getElementById('status');
    
    // Preset buttons
    document.getElementById('headingsBtn').addEventListener('click', () => {
        selectorInput.value = 'h1, h2, h3, h4, h5, h6';
        attributeSelect.value = 'textContent';
    });
    
    document.getElementById('linksBtn').addEventListener('click', () => {
        selectorInput.value = 'a[href]';
        attributeSelect.value = 'href';
    });
    
    document.getElementById('imagesBtn').addEventListener('click', () => {
        selectorInput.value = 'img';
        attributeSelect.value = 'src';
    });
    
    scrapeBtn.addEventListener('click', async () => {
        const selector = selectorInput.value.trim();
        const attribute = attributeSelect.value;
        
        if (!selector) {
            showStatus('Please enter a CSS selector', 'error');
            return;
        }
        
        scrapeBtn.disabled = true;
        scrapeBtn.textContent = '🔄 Scraping...';
        showStatus('Starting scrape...', 'success');
        
        try {
            const results = await performScraping(selector, attribute);
            
            if (results && results.length > 0) {
                scrapedData = results;
                displayResults(results);
                showStatus(`✅ Found ${results.length} elements`, 'success');
            } else {
                showStatus('❌ No elements found with that selector', 'error');
                resultsDiv.innerHTML = 'No data found. Try a different selector.';
            }
            
        } catch (error) {
            console.error('Scraping error:', error);
            showStatus(`❌ Error: ${error.message}`, 'error');
            
            resultsDiv.innerHTML = `
                

                    Debug Info:

                    Error: ${error.message}

                    Try refreshing the page and the extension

                    Make sure you're on a regular webpage
                

            `;
        }
        
        scrapeBtn.disabled = false;
        scrapeBtn.textContent = '🚀 Scrape Data';
    });
    
    // FIXED: Robust scraping function with proper connection handling
    async function performScraping(selector, attribute) {
        // Get current tab
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        console.log('Current tab:', tab);
        
        // Check if we can access the tab
        if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
            throw new Error('Cannot scrape this type of page. Please navigate to a regular website.');
        }
        
        // Method 1: Try messaging existing content script first
        try {
            showStatus('🔍 Checking for content script...', 'success');
            const results = await sendMessageWithTimeout(tab.id, {
                action: 'scrape',
                selector: selector,
                attribute: attribute
            }, 3000);
            
            if (results && Array.isArray(results)) {
                return results;
            }
        } catch (error) {
            console.log('Content script not responding, trying injection method:', error);
        }
        
        // Method 2: Inject content script and retry
        try {
            showStatus('🔧 Injecting content script...', 'success');
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            
            // Wait for script to load
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const results = await sendMessageWithTimeout(tab.id, {
                action: 'scrape',
                selector: selector,
                attribute: attribute
            }, 5000);
            
            return results;
            
        } catch (injectError) {
            console.log('Script injection failed, trying direct execution:', injectError);
        }
        
        // Method 3: Direct script execution as fallback
        try {
            showStatus('⚡ Using direct execution method...', 'success');
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: directScrapeFunction,
                args: [selector, attribute]
            });
            
            if (results && results[0] && results[0].result) {
                return results[0].result;
            }
            
        } catch (directError) {
            console.error('Direct execution failed:', directError);
            throw new Error('All scraping methods failed. The page may be blocking scripts or have security restrictions.');
        }
        
        throw new Error('Unable to scrape data from this page');
    }
    
    // Helper function to send messages with timeout
    function sendMessageWithTimeout(tabId, message, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Message timeout'));
            }, timeout);
            
            chrome.tabs.sendMessage(tabId, message, (response) => {
                clearTimeout(timeoutId);
                
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    // Direct scraping function (injected directly into page)
    function directScrapeFunction(selector, attribute) {
        try {
            const elements = document.querySelectorAll(selector);
            const results = [];
            
            elements.forEach((element) => {
                let value = '';
                
                switch (attribute) {
                    case 'textContent':
                        value = element.textContent ? element.textContent.trim() : '';
                        break;
                    case 'innerHTML':
                        value = element.innerHTML || '';
                        break;
                    case 'href':
                        value = element.href || element.getAttribute('href') || '';
                        if (value && !value.startsWith('http') && !value.startsWith('mailto:') && !value.startsWith('tel:') && !value.startsWith('#')) {
                            try {
                                value = new URL(value, window.location.href).href;
                            } catch (e) {}
                        }
                        break;
                    case 'src':
                        value = element.src || element.getAttribute('src') || '';
                        if (value && !value.startsWith('http') && !value.startsWith('data:')) {
                            try {
                                value = new URL(value, window.location.href).href;
                            } catch (e) {}
                        }
                        break;
                    case 'alt':
                        value = element.alt || element.getAttribute('alt') || '';
                        break;
                    case 'title':
                        value = element.title || element.getAttribute('title') || '';
                        break;
                    case 'className':
                        value = element.className || '';
                        break;
                    default:
                        value = element.getAttribute(attribute) || '';
                }
                
                if (value && value.trim()) {
                    results.push(value.trim());
                }
            });
            
            return results;
        } catch (error) {
            console.error('Direct scrape error:', error);
            return [];
        }
    }
    
    exportBtn.addEventListener('click', () => {
        if (scrapedData.length === 0) {
            showStatus('No data to export', 'error');
            return;
        }
        
        exportToCSV(scrapedData);
        showStatus('CSV exported successfully!', 'success');
    });
    
    function displayResults(results) {
        resultsDiv.innerHTML = '';
        results.slice(0, 10).forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.innerHTML = `${index + 1}: ${escapeHtml(item.substring(0, 100))}${item.length > 100 ? '...' : ''}`;
            resultsDiv.appendChild(div);
        });
        
        if (results.length > 10) {
            const moreDiv = document.createElement('div');
            moreDiv.style.textAlign = 'center';
            moreDiv.style.color = '#718096';
            moreDiv.style.fontStyle = 'italic';
            moreDiv.textContent = `... and ${results.length - 10} more items`;
            resultsDiv.appendChild(moreDiv);
        }
    }
    
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = type;
        statusDiv.style.display = 'block';
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, type === 'error' ? 5000 : 3000);
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function exportToCSV(data) {
        const csvContent = 'data:text/csv;charset=utf-8,' + 
            'Index,Content\n' + 
            data.map((item, index) => `${index + 1},"${item.replace(/"/g, '""')}"`).join('\n');
        
        const link = document.createElement('a');
        link.href = encodeURI(csvContent);
        link.download = `scraped-data-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }
});