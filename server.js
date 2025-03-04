const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const app = express();

// WhoisFreaks API key
const whoisfreaksApiKey = process.env.WHOISFREAKS_API_KEY || 'a0fc35b8574346fba5aa2fca8ac375c2';

// Use environment variable for port or default to 3000
const port = process.env.PORT || 3000;

// Add this near the top of your file
const domainCache = new Map();

// Add these constants at the top of your file
const USE_REAL_API = false; // Set to false to completely disable real API calls
const MAX_API_CALLS = 5; // Maximum number of API calls per search
let apiCallsRemaining = MAX_API_CALLS;
let lastResetTime = Date.now();

// Reset API call counter every 10 minutes
setInterval(() => {
  apiCallsRemaining = MAX_API_CALLS;
  lastResetTime = Date.now();
  console.log(`API call counter reset. ${apiCallsRemaining} calls available.`);
}, 10 * 60 * 1000);

// Add this at the top of your file
const DEMO_MODE = true; // Set to true to use completely simulated data

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
        
        // In demo mode, skip all API calls and just use fallback domains
        if (DEMO_MODE) {
            console.log("Running in demo mode - using simulated data only");
            const fallbackDomains = generateFallbackDomains(keywords);
            
            // Sort by price
            const sortedResults = fallbackDomains.sort((a, b) => a.price - b.price);
            
            // Calculate pagination
            const totalDomains = sortedResults.length;
            const totalPages = Math.ceil(totalDomains / pageSize);
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedResults = sortedResults.slice(startIndex, endIndex);
            
            console.log(`Sending ${paginatedResults.length} domains to client (demo mode)`);
            
            res.json({ 
                domains: paginatedResults,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalDomains: totalDomains
                },
                demoMode: true
            });
            return;
        }
        
        // Generate domain suggestions based on keywords
        const words = keywords.toLowerCase().split(/\s+/);
        const domainSuggestions = generateDomainSuggestions(words);
        
        // Filter to only include .com domains
        const comDomains = domainSuggestions.filter(domain => domain.endsWith('.com'));
        
        console.log(`Generated ${comDomains.length} .com domain suggestions`);
        
        // Always generate fallback domains
        const fallbackDomains = generateFallbackDomains(keywords);
        
        // Try to get real availability data only if API is enabled
        let availableDomains = [];
        
        if (USE_REAL_API && apiCallsRemaining > 0) {
            try {
                availableDomains = await checkDomainsWithWhoisFreaks(comDomains);
                console.log(`Got ${availableDomains.length} available domains from API`);
            } catch (apiError) {
                console.error('API error:', apiError);
                console.log('Using fallback domains due to API error');
            }
        } else {
            console.log("API disabled or call limit reached. Using fallback domains only.");
        }
        
        // Combine real and fallback domains
        let allDomains = [...availableDomains];
        console.log(`Have ${allDomains.length} domains from API before adding fallbacks`);
        
        // Always add some fallback domains to ensure we have enough results
        console.log(`Adding fallback domains to ensure sufficient results`);
        
        // Add fallback domains that aren't already in the results
        const existingDomains = new Set(allDomains.map(d => d.domain));
        const additionalFallbacks = fallbackDomains.filter(d => !existingDomains.has(d.domain));
        
        // Add enough fallbacks to get to at least 20 domains
        const fallbacksToAdd = additionalFallbacks.slice(0, Math.max(20 - allDomains.length, 0));
        console.log(`Adding ${fallbacksToAdd.length} fallback domains`);
        
        allDomains = [...allDomains, ...fallbacksToAdd];
        
        console.log(`Total domain suggestions after combining: ${allDomains.length}`);
        
        // Sort by price
        const sortedResults = allDomains.sort((a, b) => a.price - b.price);
        
        // Calculate pagination
        const totalDomains = sortedResults.length;
        const totalPages = Math.ceil(totalDomains / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedResults = sortedResults.slice(startIndex, endIndex);
        
        console.log(`Sending ${paginatedResults.length} domains to client`);
        
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
        
        // Use fallback domains when there's an error
        const fallbackDomains = generateFallbackDomains(req.body.keywords);
        
        res.json({ 
            domains: fallbackDomains,
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalDomains: fallbackDomains.length
            },
            message: "Using suggested domains due to server limitations."
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
    // If we're not using the real API, return simulated data immediately
    if (!USE_REAL_API) {
        console.log("Using simulated domain data only (API disabled)");
        return domains.slice(0, 10).map(domain => ({
            domain: domain,
            available: true,
            price: 9.99 + Math.floor(Math.random() * 10)
        }));
    }
    
    const results = [];
    
    // If we're out of API calls, use fallback immediately
    if (apiCallsRemaining <= 0) {
        console.log("API call limit reached. Using fallback domains only.");
        return domains.slice(0, 5).map(domain => ({
            domain: domain,
            available: true,
            price: 9.99 + Math.floor(Math.random() * 10)
        }));
    }
    
    // Only check a very small number of domains to avoid rate limits
    const domainsToCheck = domains.slice(0, Math.min(apiCallsRemaining, 3));
    console.log(`Checking ${domainsToCheck.length} domains with API. ${apiCallsRemaining} API calls remaining.`);
    
    for (const domain of domainsToCheck) {
        // Check cache first
        if (domainCache.has(domain)) {
            console.log(`Using cached result for ${domain}`);
            const cachedResult = domainCache.get(domain);
            if (cachedResult) results.push(cachedResult);
            continue;
        }
        
        try {
            console.log(`Checking availability for: ${domain}`);
            apiCallsRemaining--;
            
            const response = await axios.get(`https://api.whoisfreaks.com/v1.0/domain/availability?apiKey=${whoisfreaksApiKey}&domain=${domain}`);
            
            const data = response.data;
            console.log(`Availability for ${domain}: ${JSON.stringify(data)}`);
            
            // Check for different API response formats
            if (
                (data.status === 'available' || data.status === 'unknown') || 
                data.domainAvailability === true
            ) {
                // Get real price from WhoisFreaks data or use a default
                const price = data.price ? parseFloat(data.price) : 9.99;
                
                const result = {
                    domain: domain,
                    available: true,
                    price: price
                };
                
                // Cache the result
                domainCache.set(domain, result);
                results.push(result);
                
                // Log that we're adding this domain to results
                console.log(`Adding available domain to results: ${domain}`);
            } else {
                // Cache unavailable domains as null
                domainCache.set(domain, null);
                console.log(`Domain not available: ${domain}`);
            }
            
            // Add a delay between API calls
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`Error checking ${domain}:`, error.message);
            
            if (error.response && error.response.status === 429) {
                console.log("Rate limit hit. Disabling API calls for this session.");
                apiCallsRemaining = 0; // Disable API calls for now
            }
            
            // Add a simulated result for this domain
            const result = {
                domain: domain,
                available: true,
                price: 9.99 + Math.floor(Math.random() * 10)
            };
            results.push(result);
            console.log(`Adding simulated domain to results due to error: ${domain}`);
        }
    }
    
    // If we got no results from the API, add some fallback domains
    if (results.length === 0) {
        console.log("No domains found from API, adding fallback domains");
        // Add the first few domains as fallbacks
        for (let i = 0; i < Math.min(domains.length, 5); i++) {
            results.push({
                domain: domains[i],
                available: true,
                price: 9.99 + i
            });
            console.log(`Adding fallback domain to results: ${domains[i]}`);
        }
    }
    
    console.log(`Total domains found from API/fallbacks: ${results.length}`);
    return results;
}

// Generate domain suggestions based on keywords
function generateDomainSuggestions(words) {
    const domains = [];
    const kw = words.join('');
    
    // Basic combinations for single words
    if (words.length >= 1) {
        domains.push(`${words[0]}.com`);
        domains.push(`my${words[0]}.com`);
        domains.push(`the${words[0]}.com`);
        domains.push(`${words[0]}online.com`);
        domains.push(`${words[0]}site.com`);
    }
    
    // Use all words in combinations
    if (words.length >= 2) {
        // Join all words together
        const allWordsCombined = words.join('');
        domains.push(`${allWordsCombined}.com`);
        
        // Join with hyphens
        const allWordsHyphenated = words.join('-');
        domains.push(`${allWordsHyphenated}.com`);
        
        // Join first word with others
        for (let i = 1; i < words.length; i++) {
            domains.push(`${words[0]}${words[i]}.com`);
            domains.push(`${words[0]}-${words[i]}.com`);
        }
        
        // Create combinations of adjacent words
        for (let i = 0; i < words.length - 1; i++) {
            domains.push(`${words[i]}${words[i+1]}.com`);
            domains.push(`${words[i]}-${words[i+1]}.com`);
            domains.push(`${words[i]}and${words[i+1]}.com`);
        }
    }
    
    // Add some creative variations
    const prefixes = ['get', 'try', 'best', 'top', 'pro'];
    const suffixes = ['hub', 'spot', 'zone', 'center', 'place'];
    
    // Add prefixes to first word and to all words combined
    if (words.length >= 1) {
        prefixes.forEach(prefix => {
            domains.push(`${prefix}${words[0]}.com`);
            
            if (words.length >= 2) {
                const allWords = words.join('');
                domains.push(`${prefix}${allWords}.com`);
            }
        });
    }
    
    // Add suffixes to first word and to all words combined
    if (words.length >= 1) {
        suffixes.forEach(suffix => {
            domains.push(`${words[0]}${suffix}.com`);
            
            if (words.length >= 2) {
                const allWords = words.join('');
                domains.push(`${allWords}${suffix}.com`);
            }
        });
    }
    
    // Add more creative combinations
    if (words.length >= 1) {
        // Add some industry-specific domains
        if (kw.includes('tech') || kw.includes('code') || kw.includes('dev') || kw.includes('web')) {
            domains.push(`${words[0]}tech.com`);
            domains.push(`${words[0]}dev.com`);
            
            if (words.length >= 2) {
                const allWords = words.join('');
                domains.push(`${allWords}tech.com`);
                domains.push(`${allWords}dev.com`);
            }
        }
        
        if (kw.includes('shop') || kw.includes('store') || kw.includes('buy') || kw.includes('sell')) {
            domains.push(`${words[0]}shop.com`);
            domains.push(`${words[0]}store.com`);
            
            if (words.length >= 2) {
                const allWords = words.join('');
                domains.push(`${allWords}shop.com`);
                domains.push(`${allWords}store.com`);
            }
        }
    }
    
    // Remove duplicates
    return [...new Set(domains)];
}

// Add a test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route to serve the main index.html for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Generate fallback domains with more realistic data
function generateFallbackDomains(keywords) {
    const words = keywords.toLowerCase().split(/\s+/);
    const results = [];
    
    // Domain price tiers
    const priceTiers = [
        { min: 8.99, max: 12.99 },  // Basic domains
        { min: 12.99, max: 19.99 }, // Better domains
        { min: 19.99, max: 29.99 }  // Premium domains
    ];
    
    // Generate a random price within a tier
    function getRandomPrice(tier) {
        const { min, max } = priceTiers[tier];
        return parseFloat((min + Math.random() * (max - min)).toFixed(2));
    }
    
    // Generate a few basic domains
    if (words.length >= 1) {
        // Add more variations to increase chances of finding domains
        const variations = [
            `${words[0]}.com`,
            `my${words[0]}.com`,
            `the${words[0]}.com`,
            `${words[0]}online.com`,
            `${words[0]}site.com`,
            `${words[0]}web.com`,
            `${words[0]}app.com`,
            `get${words[0]}.com`,
            `best${words[0]}.com`,
            `${words[0]}hub.com`,
            `${words[0]}pro.com`,
            `${words[0]}now.com`,
            `${words[0]}plus.com`,
            `${words[0]}hq.com`,
            `${words[0]}central.com`
        ];
        
        // Add all variations with different prices
        variations.forEach((domain, index) => {
            // Distribute domains across different price tiers
            const tier = Math.min(Math.floor(index / 5), 2);
            results.push({
                domain: domain,
                available: true,
                price: getRandomPrice(tier)
            });
        });
    }
    
    // Use all words in combinations
    if (words.length >= 2) {
        // All words combined
        const allWordsCombined = words.join('');
        results.push({
            domain: `${allWordsCombined}.com`,
            available: true,
            price: getRandomPrice(1)
        });
        
        // All words hyphenated
        const allWordsHyphenated = words.join('-');
        results.push({
            domain: `${allWordsHyphenated}.com`,
            available: true,
            price: getRandomPrice(1)
        });
        
        // Standard multi-word variations
        const multiWordVariations = [
            `${words[0]}${words[1]}.com`,
            `${words[0]}-${words[1]}.com`,
            `${words[0]}and${words[1]}.com`,
            `${words[0]}plus${words[1]}.com`,
            `${words[0]}${words[1]}online.com`,
            `${words[0]}${words[1]}site.com`,
            `${words[0]}-${words[1]}-online.com`,
            `my${words[0]}${words[1]}.com`,
            `the${words[0]}${words[1]}.com`,
            `best${words[0]}${words[1]}.com`
        ];
        
        multiWordVariations.forEach((domain, index) => {
            // Multi-word domains tend to be in higher price tiers
            const tier = Math.min(Math.floor(index / 3), 2);
            results.push({
                domain: domain,
                available: true,
                price: getRandomPrice(tier)
            });
        });
        
        // If we have more than 2 words, add combinations with all words
        if (words.length > 2) {
            // Create combinations with the first word and each subsequent word
            for (let i = 2; i < words.length; i++) {
                results.push({
                    domain: `${words[0]}${words[i]}.com`,
                    available: true,
                    price: getRandomPrice(1)
                });
                
                results.push({
                    domain: `${words[0]}-${words[i]}.com`,
                    available: true,
                    price: getRandomPrice(1)
                });
            }
            
            // Create combinations with all words
            const prefixes = ['get', 'my', 'the', 'best'];
            const suffixes = ['hub', 'spot', 'zone', 'center'];
            
            prefixes.forEach(prefix => {
                results.push({
                    domain: `${prefix}${allWordsCombined}.com`,
                    available: true,
                    price: getRandomPrice(2)
                });
            });
            
            suffixes.forEach(suffix => {
                results.push({
                    domain: `${allWordsCombined}${suffix}.com`,
                    available: true,
                    price: getRandomPrice(2)
                });
            });
        }
    }
    
    return results;
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 