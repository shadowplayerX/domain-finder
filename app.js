document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('domain-form');
    const resultsContainer = document.getElementById('results');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const keywords = document.getElementById('keywords').value.trim();
        
        if (!keywords) {
            alert('Please enter some keywords or a description');
            return;
        }
        
        resultsContainer.innerHTML = '<p>Searching for domains...</p>';
        
        try {
            const domainSuggestions = await generateDomainIdeas(keywords);
            displayResults(domainSuggestions);
        } catch (error) {
            resultsContainer.innerHTML = `<p>Error: ${error.message}</p>`;
            console.error('Error:', error);
        }
    });

    async function generateDomainIdeas(keywords) {
        try {
            const response = await fetch('http://localhost:3000/api/domain-suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keywords })
            });
            
            if (!response.ok) {
                throw new Error('Server error');
            }
            
            const data = await response.json();
            return data.domains;
        } catch (error) {
            console.error('API Error:', error);
            throw new Error('Failed to fetch domain suggestions');
        }
    }

    function displayResults(domainSuggestions) {
        if (domainSuggestions.length === 0) {
            resultsContainer.innerHTML = '<p>No domain suggestions found. Try different keywords.</p>';
            return;
        }
        
        let html = '<h2>Domain Suggestions</h2>';
        
        domainSuggestions.forEach(suggestion => {
            html += `
                <div class="domain-result">
                    <h3>${suggestion.domain}</h3>
                    <p class="${suggestion.available ? 'available' : 'unavailable'}">
                        ${suggestion.available ? 'Available' : 'Unavailable'}
                    </p>
                    ${suggestion.available ? `<p>Price: <span class="price">$${suggestion.price.toFixed(2)}</span>/year</p>` : ''}
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;
    }
}); 