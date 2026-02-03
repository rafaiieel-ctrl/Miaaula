
const fs = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(__dirname, '../audit/baseline/golden_schema.json');

function runAudit() {
    console.log('--- Miaaula Static Audit ---');
    
    if (!fs.existsSync(BASELINE_PATH)) {
        console.error('FAIL: Baseline file not found at', BASELINE_PATH);
        process.exit(1);
    }

    try {
        const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
        console.log(`Baseline Version: ${baseline.version}`);
        
        // Basic static checks on baseline integrity
        if (!baseline.contracts?.question?.required_fields) {
            console.error('FAIL: Invalid Baseline Structure');
            process.exit(1);
        }
        
        console.log('PASS: Baseline Schema is valid.');
        console.log('To run dynamic audit against live data, use the "Export Audit Package" feature in the app Settings.');
        
    } catch (e) {
        console.error('FAIL: Error parsing baseline', e.message);
        process.exit(1);
    }
}

runAudit();
