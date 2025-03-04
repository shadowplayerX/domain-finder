document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('search-button');
    const keywordsInput = document.getElementById('keywords');
    const resultsContainer = document.getElementById('results-container');
    const loadingIndicator = document.getElementById('loading');
    const apiProviderOptions = document.getElementsByName('api-provider');
    
    // Function to get the selected API provider
    function getSelectedApiProvider() {
        for (const option of apiProviderOptions) {
            if (option.checked) {
                return option.value;
            }
        }
        return 'demo'; // Default to demo mode
    }
    
    // Search function
    async function searchDomains(keywords, page = 1) {
        if (!keywords.trim()) {
            alert('Please enter keywords to search for domains');
            return;
        }
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        resultsContainer.innerHTML = '';
        
        try {
            const apiProvider = getSelectedApiProvider();
            console.log(`Searching with API provider: ${apiProvider}`);
            
            const response = await fetch('/api/domain-suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    keywords, 
                    page,
                    apiProvider // Send the selected API provider to the server
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            
            // Display results
            displayResults(data);
        } catch (error) {
            console.error('Error searching domains:', error);
            loadingIndicator.style.display = 'none';
            resultsContainer.innerHTML = `
                <div class="error-message">
                    <h2>Error</h2>
                    <p>Sorry, we encountered an error while searching for domains. Please try again later.</p>
                    <p class="error-details">${error.message}</p>
                </div>
            `;
        }
    }
    
    // Display results function
    function displayResults(domainData) {
        const { domains, pagination, message, apiProvider } = domainData;
        
        if (!domains || domains.length === 0) {
            resultsContainer.innerHTML = `
                <h2>No Domains Found</h2>
                <p>${message || "We couldn't find any domains matching your criteria. Please try different keywords."}</p>
            `;
            return;
        }
        
        let html = '<h2>Domain Suggestions</h2>';
        
        // Add a note about domain availability and the API provider being used
        html += `
            <div class="availability-note">
                <p>Note: Domain availability is provided as a guide only. 
                Please verify availability with the registrar before purchase.</p>
                <p class="api-provider-info">API Provider: <strong>${apiProvider || getSelectedApiProvider()}</strong></p>
            </div>
        `;
        
        domains.forEach(suggestion => {
            // Create GoDaddy purchase link
            const purchaseLink = `https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(suggestion.domain)}`;
            
            html += `
                <div class="domain-result">
                    <h3><a href="${purchaseLink}" target="_blank" rel="noopener">${suggestion.domain}</a></h3>
                    <div class="domain-info">
                        <div>
                            <p class="available">Available</p>
                            <p>Price: <span class="price">$${suggestion.price.toFixed(2)}</span>/year</p>
                        </div>
                        <a href="${purchaseLink}" class="purchase-button" target="_blank" rel="noopener">Purchase</a>
                    </div>
                </div>
            `;
        });
        
        // Add pagination controls if needed
        if (pagination && pagination.totalPages > 1) {
            html += '<div class="pagination">';
            
            // Previous page button
            if (pagination.currentPage > 1) {
                html += `<button class="pagination-button" data-page="${pagination.currentPage - 1}">Previous</button>`;
            }
            
            // Page numbers
            html += `<span class="page-info">Page ${pagination.currentPage} of ${pagination.totalPages}</span>`;
            
            // Next page button
            if (pagination.currentPage < pagination.totalPages) {
                html += `<button class="pagination-button" data-page="${pagination.currentPage + 1}">Next</button>`;
            }
            
            html += '</div>';
        }
        
        resultsContainer.innerHTML = html;
        
        // Add event listeners to pagination buttons
        document.querySelectorAll('.pagination-button').forEach(button => {
            button.addEventListener('click', () => {
                const page = parseInt(button.getAttribute('data-page'));
                searchDomains(keywordsInput.value, page);
                // Scroll back to top of results
                resultsContainer.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }
    
    // Event listener for search button
    searchButton.addEventListener('click', () => {
        searchDomains(keywordsInput.value);
    });
    
    // Event listener for Enter key in input field
    keywordsInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchDomains(keywordsInput.value);
        }
    });
    
    // Event listeners for API provider options
    apiProviderOptions.forEach(option => {
        option.addEventListener('change', () => {
            console.log(`API provider changed to: ${option.value}`);
            // If there are already results displayed, re-run the search with the new provider
            if (resultsContainer.innerHTML.includes('domain-result')) {
                searchDomains(keywordsInput.value);
            }
        });
    });
}); 