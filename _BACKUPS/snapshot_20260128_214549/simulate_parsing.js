const fs = require('fs');
const path = require('path');

// MOCK GmailFetcher Logic
const GmailFetcher = {
    parseCSV: function(csvString, debugLog, filename) {
        if (!csvString) return [];

        try {
            // MOCK Utilities.parseCsv (Simple standard CSV parser)
            // This is a simplified parser; for complex multiline CSVs it might need more, 
            // but effectively we just need to see if headers align.
            const table = parseCSVString(csvString); 

            if (!table || table.length < 2) {
                if(debugLog) debugLog.push(`          -> CSV Parser: File '${filename}' is empty or has no header.`);
                return []; 
            }

            // FIND HEADER ROW DYNAMICALLY
            var headerRowIndex = -1;
            var headers = [];

            for (var i = 0; i < Math.min(table.length, 20); i++) {
                var rowStr = table[i].join(" ").toLowerCase();
                // Look for "Unit" AND "Tags" or "Property" to be sure it's the header
                if ((rowStr.includes("unit") && rowStr.includes("tags")) || rowStr.includes("property name")) {
                    headerRowIndex = i;
                    headers = table[i];
                    if(debugLog) debugLog.push(`          -> DETECTED HEADERS (Row ${i}): ${JSON.stringify(headers)}`);
                    break;
                }
            }

            if (headerRowIndex === -1) {
                headerRowIndex = 0;
                headers = table[0];
                if(debugLog) debugLog.push(`          -> WARNING: Could not detect standard headers. Using Row 0: ${JSON.stringify(headers)}`);
            }

            // Clean headers
            for(var h=0; h<headers.length; h++) headers[h] = headers[h].trim();

            var result = [];
            // Start processing AFTER the header row
            for (var i = headerRowIndex + 1; i < table.length; i++) {
                var row = table[i];
                if (row.length === 0) continue; // Skip totally empty lines
                
                var obj = {};
                // Map header to value
                for (var j = 0; j < headers.length; j++) {
                    if (j < row.length) {
                        obj[headers[j]] = row[j];
                    } else {
                        obj[headers[j]] = ""; 
                    }
                }

                // FILTER Logic
                var unitVal = obj['Unit'] || "";
                var propVal = obj['Property'] || obj['Property Name'] || "";

                if (unitVal.trim().startsWith("->")) {
                     // Skip Group Header
                     // console.log("Skipping group header", unitVal);
                     continue;
                }
                if (!propVal && !unitVal) {
                    // Skip Empty/Junk Row
                     // console.log("Skipping empty row", propVal, unitVal);
                    continue;
                }
                if (unitVal === "Total") continue;

                result.push(obj);
            }
            return result;
        } catch (e) {
            if(debugLog) debugLog.push(`          -> CSV PARSE ERROR in '${filename}': ${e.message}`);
            return [];
        }
    }
};

// Simple CSV Parser Function for Node (Simulation of Utilities.parseCsv)
function parseCSVString(str) {
    const arr = [];
    let quote = false;
    let col = 0;
    let row = 0;
    arr[row] = [];
    let current = "";
    
    for (let c = 0; c < str.length; c++) {
        let char = str[c];
        let next = str[c+1];
        
        if (char === '"') {
            if (quote && next === '"') {
                current += '"';
                c++;
            } else {
                quote = !quote;
            }
        } else if (char === ',' && !quote) {
            arr[row][col] = current;
            col++;
            current = "";
        } else if ((char === '\r' || char === '\n') && !quote) {
             if (char === '\r' && next === '\n') c++;
             arr[row][col] = current;
             // New row
             row++;
             col=0; 
             arr[row] = [];
             current = "";
        } else {
            current += char;
        }
    }
    if(current.length > 0) arr[row][col] = current;
    // Remove last empty row if exists due to trailing newline
    if(arr[arr.length-1].length === 0 || (arr[arr.length-1].length===1 && arr[arr.length-1][0]==='')) {
        arr.pop();
    }
    return arr;
}

// MAIN RUNNER
const files = [
    'Unit Vacancy.csv',
    'Move Out.csv',
    'Inspection Detail.csv',
    'work_order-20260120.csv'
];

const debugLog = [];

files.forEach(file => {
    try {
        const p = path.join(__dirname, file);
        if(!fs.existsSync(p)) {
            console.log(`File not found: ${file}`);
            return;
        }
        const content = fs.readFileSync(p, 'utf8');
        console.log(`\n--- Parsing ${file} ---`);
        const results = GmailFetcher.parseCSV(content, debugLog, file);
        console.log(`Rows parsed: ${results.length}`);
        if(results.length > 0) {
            const first = results[0];
            const propertyKey = first['Property Name'] ? 'Property Name' : (first['Property'] ? 'Property' : 'NONE');
            console.log(`First Row Property Key: ${propertyKey} = '${first[propertyKey]}'`);
            console.log(`First Row Unit: '${first['Unit']}'`);
            
            // Check keys available
            console.log(`Keys available: ${Object.keys(first).slice(0, 5).join(', ')}...`);
        } else {
            console.log("NO ROWS DATA PARSED.");
        }

    } catch(err) {
        console.error(`Error reading ${file}:`, err);
    }
});

console.log("\nDebug Log:");
console.log(debugLog.join('\n'));
