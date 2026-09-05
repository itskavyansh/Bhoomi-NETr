// Temporary bridge script until Supabase->analysis wiring is decided\nimport { spawn, execSync } from "child_process";
import fs from "fs";

const SUPABASE_URL = "https://bnnrikqlhvcqpuqsujsf.supabase.co/rest/v1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnJpa3FsaHZjcXB1cXN1anNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU4Nzg5MCwiZXhwIjoyMTA0MTYzODkwfQ.3ffdNWfb2g0GmC1UqEE_Vma-nLsgXSjXkWJPAqPAM7M";

async function fetchLatest() {
    const r = await fetch(SUPABASE_URL + "/sensor_readings?node_id=eq.NODE_01&order=created_at.desc&limit=1", {
        headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }
    });
    const rows = await r.json();
    return rows[0];
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function watchScenario(scenarioArgs, endCondition) {
    let label = scenarioArgs.join(" ");
    console.log(`\n\n=== RUNNING: node simulator.js ${label} ===\n`);

    const sim = spawn(process.execPath, ["simulator.js", ...scenarioArgs]);

    const processed = new Set();

    let matchCount = 0;
    for (let i = 0; i < 30; i++) {
        await delay(2500);
        const row = await fetchLatest();
        if (row && !processed.has(row.timestamp)) {
            processed.add(row.timestamp);
            fs.writeFileSync("temp.json", JSON.stringify(row));
            const out = execSync("python run_analysis.py temp.json").toString();
            const json = JSON.parse(out.trim());

            console.log(`[${row.timestamp.split('T')[1].split('+')[0]}] -> ` +
                `tilt=${row.tilt_x.toFixed(1)}, vib=${row.vibration.toFixed(3)}, dist=${row.distance.toFixed(1)} ` +
                `=> STATUS: ${json.status.padEnd(8)} | SCORE: ${json.risk_score} | WARNS: ${json.warnings.join(', ')}`);

            if (endCondition(json)) {
                matchCount++;
                if (matchCount >= 2) {
                    break;
                }
            }
        }
    }
    sim.kill("SIGKILL");
}

async function main() {
    await watchScenario([], (j) => j.status === 'NORMAL'); // Just 2 ticks of normal
    await watchScenario(["--scenario=critical", "--node=NODE_01"], (j) => j.status === 'CRITICAL' && j.warnings.includes("HIGH_VIBRATION"));
}

main();
