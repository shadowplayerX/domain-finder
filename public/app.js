document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('domain-form');
    const resultsContainer = document.getElementById('results');
    let currentKeywords = '';
    let currentPage = 1;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const keywords = document.getElementById('keywords').value.trim();
        
        if (!keywords) {
            alert('Please enter some keywords or a description');
            return;
        }
        
        currentKeywords = keywords;
        currentPage = 1;
        
        resultsContainer.innerHTML = '<p class="loading">Searching for domains...</p>';
        
        try {
            const domainData = await generateDomainIdeas(keywords, currentPage);
            displayResults(domainData);
        } catch (error) {
            console.error('Error:', error);
            resultsContainer.innerHTML = `
                <h2>Error</h2>
                <p>Sorry, we couldn't search for domains at this time. Please try again later.</p>
            `;
        }
    });

    async function generateDomainIdeas(keywords, page = 1) {
        try {
            console.log(`Sending request to domain suggestions endpoint with keywords: ${keywords}, page: ${page}`);
            
            const response = await fetch('/api/domain-suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keywords, page })
            });
            
            if (!response.ok) {
                throw new Error('API endpoint error');
            }
            
            const data = await response.json();
            console.log('Received response from API:', data);
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw new Error('Failed to fetch domain suggestions');
        }
    }

    function displayResults(domainData) {
        const { domains, pagination, message } = domainData;
        
        if (!domains || domains.length === 0) {
            resultsContainer.innerHTML = `
                <h2>No Domains Found</h2>
                <p>${message || "We couldn't find any domains matching your criteria. Please try different keywords."}</p>
            `;
            return;
        }
        
        let html = '<h2>Domain Suggestions</h2>';
        
        // Add a note about domain availability
        html += `
            <div class="availability-note">
                <p>Note: Domain availability is provided as a guide only. 
                Please verify availability with the registrar before purchase.</p>
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
            button.addEventListener('click', async () => {
                currentPage = parseInt(button.getAttribute('data-page'));
                resultsContainer.innerHTML = '<p class="loading">Loading more domains...</p>';
                
                try {
                    const domainData = await generateDomainIdeas(currentKeywords, currentPage);
                    displayResults(domainData);
                } catch (error) {
                    console.error('Error:', error);
                    resultsContainer.innerHTML = `
                        <h2>Error</h2>
                        <p>Sorry, we couldn't load more domains at this time. Please try again later.</p>
                    `;
                }
                
                // Scroll back to top of results
                resultsContainer.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }
}); 