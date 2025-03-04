const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// WhoisFreaks API key
const whoisfreaksApiKey = process.env.WHOISFREAKS_API_KEY || 'a0fc35b8574346fba5aa2fca8ac375c2';

// Use environment variable for port or default to 3000
const port = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
console.log('Static directory path:', path.join(__dirname, 'public'));

// Simple test endpoint
app.get('/api/hello', (req, res) => {
    res.send('Hello World!');
});

// Domain suggestions endpoint
app.post('/api/domain-suggestions', async (req, res) => {
    console.log('Received request with keywords:', req.body.keywords);
    
    try {
        const { keywords, page = 1 } = req.body;
        const pageSize = 20;
        
        // Get domain suggestions directly from WhoisFreaks API
        const domainSuggestions = await getWhoisFreaksDomainSuggestions(keywords);
        
        if (!domainSuggestions || domainSuggestions.length === 0) {
            console.log('No domain suggestions from WhoisFreaks');
            res.json({ 
                domains: [],
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalDomains: 0
                },
                message: "No domain suggestions found. Try different keywords."
            });
            return;
        }
        
        console.log(`Got ${domainSuggestions.length} domain suggestions from WhoisFreaks`);
        
        // Filter to only include .com domains and available domains
        const filteredDomains = domainSuggestions.filter(domain => 
            domain.domain.endsWith('.com') && domain.available
        );
        
        console.log(`After filtering, ${filteredDomains.length} domains remain`);
        
        if (filteredDomains.length === 0) {
            res.json({ 
                domains: [],
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalDomains: 0
                },
                message: "No available .com domains found. Try different keywords."
            });
            return;
        }
        
        // Sort by price
        const sortedResults = filteredDomains.sort((a, b) => a.price - b.price);
        
        // Calculate pagination
        const totalDomains = sortedResults.length;
        const totalPages = Math.ceil(totalDomains / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedResults = sortedResults.slice(startIndex, endIndex);
        
        res.json({ 
            domains: paginatedResults,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalDomains: totalDomains
            }
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'An error occurred while searching for domains',
            message: error.message
        });
    }
});

// Function to get domain suggestions from WhoisFreaks API
async function getWhoisFreaksDomainSuggestions(keywords) {
    try {
        // Generate domain suggestions based on keywords
        const words = keywords.toLowerCase().split(/\s+/);
        const domainSuggestions = generateDomainSuggestions(words);
        
        // Filter to only include .com domains
        const comDomains = domainSuggestions.filter(domain => domain.endsWith('.com'));
        
        console.log(`Generated ${comDomains.length} .com domain suggestions`);
        
        // Check availability for these domains using WhoisFreaks
        const domainsWithAvailability = await checkDomainsWithWhoisFreaks(comDomains);
        
        return domainsWithAvailability;
    } catch (error) {
        console.error('Error getting domain suggestions:', error);
        throw error;
    }
}

// Function to check domain availability using WhoisFreaks API
async function checkDomainsWithWhoisFreaks(domains) {
    const results = [];
    const batchSize = 5; // Process in smaller batches to avoid rate limits
    
    // Process domains in batches
    for (let i = 0; i < domains.length; i += batchSize) {
        const batch = domains.slice(i, i + batchSize);
        const batchPromises = batch.map(async (domain) => {
            try {
                console.log(`Checking availability for: ${domain}`);
                const response = await fetch(`https://api.whoisfreaks.com/v1.0/domain/availability?apiKey=${whoisfreaksApiKey}&domain=${domain}`);
                
                if (!response.ok) {
                    console.warn(`API error for ${domain}: ${response.status}`);
                    return null; // Skip this domain if API call fails
                }
                
                const data = await response.json();
                console.log(`Availability for ${domain}: ${JSON.stringify(data)}`);
                
                // Only include available domains
                if (data.status === 'available') {
                    // Get real price from WhoisFreaks data or use a default
                    const price = data.price ? parseFloat(data.price) : 9.99;
                    
                    return {
                        domain: domain,
                        available: true,
                        price: price
                    };
                }
                
                return null; // Skip unavailable domains
            } catch (error) {
                console.error(`Error checking ${domain}:`, error);
                return null; // Skip this domain if there's an error
            }
        });
        
        // Wait for all domains in this batch to be processed
        const batchResults = await Promise.all(batchPromises);
        
        // Filter out null results (unavailable domains or errors)
        const validResults = batchResults.filter(result => result !== null);
        results.push(...validResults);
        
        // Add a small delay between batches to avoid rate limits
        if (i + batchSize < domains.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return results;
}

// Generate domain suggestions based on keywords
function generateDomainSuggestions(words) {
    const domains = [];
    const kw = words.join('');
    
    // Basic combinations
    if (words.length >= 1) {
        domains.push(`${words[0]}.com`);
        domains.push(`my${words[0]}.com`);
        domains.push(`the${words[0]}.com`);
        domains.push(`${words[0]}online.com`);
        domains.push(`${words[0]}site.com`);
    }
    
    // More combinations for multiple words
    if (words.length >= 2) {
        domains.push(`${words[0]}${words[1]}.com`);
        domains.push(`${words[0]}-${words[1]}.com`);
        domains.push(`${words[0]}and${words[1]}.com`);
    }
    
    // Add some creative variations
    const prefixes = ['get', 'try', 'best', 'top', 'pro', 'smart', 'easy'];
    const suffixes = ['hub', 'spot', 'zone', 'center', 'place', 'space', 'world'];
    
    // Add prefixes
    if (words.length >= 1) {
        prefixes.forEach(prefix => {
            domains.push(`${prefix}${words[0]}.com`);
        });
    }
    
    // Add suffixes
    if (words.length >= 1) {
        suffixes.forEach(suffix => {
            domains.push(`${words[0]}${suffix}.com`);
        });
    }
    
    // Add more creative combinations
    if (words.length >= 1) {
        // Add some industry-specific domains
        if (kw.includes('tech') || kw.includes('code') || kw.includes('dev') || kw.includes('web')) {
            domains.push(`${words[0]}dev.com`);
            domains.push(`${words[0]}tech.com`);
            domains.push(`code${words[0]}.com`);
        }
        
        if (kw.includes('shop') || kw.includes('store') || kw.includes('buy') || kw.includes('sell')) {
            domains.push(`${words[0]}shop.com`);
            domains.push(`${words[0]}store.com`);
            domains.push(`buy${words[0]}.com`);
        }
    }
    
    // Remove duplicates
    return [...new Set(domains)];
}

// Catch-all route to serve the main index.html for any unmatched routes
app.get('/', (req, res) => {
    console.log('Root route hit');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add this to your server.js
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Page</title>
    </head>
    <body>
      <h1>Test Page</h1>
      <p>If you can see this, the server is working!</p>
    </body>
    </html>
  `);
});

app.get('*', (req, res) => {
  res.redirect('/');
});

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

// Export the app for Vercel
module.exports = app; 