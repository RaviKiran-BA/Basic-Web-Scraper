// Fixed content script with immediate response and better error handling
console.log('Web Scraper content script loaded at:', new Date().toISOString());

// Ensure we only add one listener
if (!window.webScraperLoaded) {
    window.webScraperLoaded = true;
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Content script received message:', request);
        
        if (request.action === 'scrape') {
            // Respond immediately to prevent timeout
            try {
                const results = performScraping(request);
                console.log(`Scraping completed, found ${results.length} items`);
                sendResponse(results);
            } catch (error) {
                console.error('Content script error:', error);
                sendResponse([]);
            }
            
            return false; // Don't keep message channel open
        }
    });
}

function performScraping(request) {
    try {
        console.log(`Searching for elements with selector: "${request.selector}"`);
        
        const elements = document.querySelectorAll(request.selector);
        console.log(`Found ${elements.length} elements`);
        
        const results = [];
        
        elements.forEach((element, index) => {
            try {
                let value = '';
                
                switch (request.attribute) {
                    case 'textContent':
                        value = element.textContent ? element.textContent.trim() : '';
                        break;
                    case 'innerHTML':
                        value = element.innerHTML || '';
                        break;
                    case 'href':
                        value = element.href || element.getAttribute('href') || '';
                        // Convert relative URLs to absolute
                        if (value && !value.startsWith('http') && !value.startsWith('mailto:') && !value.startsWith('tel:') && !value.startsWith('#')) {
                            try {
                                value = new URL(value, window.location.href).href;
                            } catch (urlError) {
                                console.warn('URL conversion failed:', urlError);
                            }
                        }
                        break;
                    case 'src':
                        value = element.src || element.getAttribute('src') || '';
                        // Convert relative URLs to absolute
                        if (value && !value.startsWith('http') && !value.startsWith('data:')) {
                            try {
                                value = new URL(value, window.location.href).href;
                            } catch (urlError) {
                                console.warn('URL conversion failed:', urlError);
                            }
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
                        value = element.getAttribute(request.attribute) || '';
                }
                
                if (value && value.trim()) {
                    results.push(value.trim());
                    if (index < 5) { // Log first 5 for debugging
                        console.log(`Element ${index + 1}: ${value.substring(0, 50)}...`);
                    }
                }
                
            } catch (elementError) {
                console.warn(`Error processing element ${index}:`, elementError);
            }
        });
        
        console.log(`Returning ${results.length} results`);
        return results;
        
    } catch (error) {
        console.error('Scraping error:', error);
        return [];
    }
}

// Test function to verify content script is working
window.webScraperDebug = () => {
    console.log('=== Web Scraper Debug Info ===');
    console.log('✅ Content script is loaded and ready');
    console.log('📄 Document ready state:', document.readyState);
    console.log('🌐 Current URL:', window.location.href);
    console.log('📊 Total elements on page:', document.querySelectorAll('*').length);
    console.log('🔧 Script loaded at:', new Date().toISOString());
    
    // Test basic selector
    const testElements = document.querySelectorAll('h1, h2, h3');
    console.log(`🧪 Test selector 'h1, h2, h3' found: ${testElements.length} elements`);
    
    return 'Content script is working correctly!';
};

// Announce readiness
console.log('✅ Web Scraper content script ready for messages');