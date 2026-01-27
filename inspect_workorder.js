const fs = require('fs');
const path = require('path');

// Re-using the parser logic
function parseCSVString(str) {
    const arr = [];
    let quote = false;
    let col = 0;
    let row = 0;
    arr[row] = [];
    let current = "";

    for (let c = 0; c < str.length; c++) {
        let char = str[c];
        let next = str[c + 1];

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
            row++;
            col = 0;
            arr[row] = [];
            current = "";
        } else {
            current += char;
        }
    }
    if (current.length > 0) arr[row][col] = current;
    // Remove last empty row
    if (arr[arr.length - 1].length === 0 || (arr[arr.length - 1].length === 1 && arr[arr.length - 1][0] === '')) {
        arr.pop();
    }
    return arr;
}

const file = 'work_order-20260120.csv';
const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
const rows = parseCSVString(content);

if (rows.length > 0) {
    const headers = rows[0];
    const pNameIdx = headers.indexOf('Property Name');
    const pIdx = headers.indexOf('Property');
    const uIdx = headers.indexOf('Unit');

    console.log(`Headers: Property Name @ ${pNameIdx}, Property @ ${pIdx}, Unit @ ${uIdx}`);

    // Print first 5 data rows
    for (let i = 1; i < Math.min(rows.length, 6); i++) {
        const r = rows[i];
        const pName = r[pNameIdx];
        const p = r[pIdx];
        const u = r[uIdx];

        console.log(`Row ${i}:`);
        console.log(`   Property: '${p}'`);
        console.log(`   PropName: '${pName}'`);
        console.log(`   Unit:     '${u}'`);
    }
}
