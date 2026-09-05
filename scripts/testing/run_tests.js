// Temporary bridge script until Supabase->analysis wiring is decided\nimport { spawn } from "child_process";
import fs from "fs";

fs.writeFileSync('test_results.txt', '');
function log(msg) {
    fs.appendFileSync('test_results.txt', msg + '\n');
    console.log(msg);
}

const SUPABASE_URL = "https://bnnrikqlhvcqpuqsujsf.supabase.co/rest/v1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnJpa3FsaHZjcXB1cXN1anNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU4Nzg5MCwiZXhwIjoyMTA0MTYzODkwfQ.3ffdNWfb2g0GmC1UqEE_Vma-nLsgXSjXkWJPAqPAM7M";

async function fetchLatest() {
    const r = await fetch(SUPABASE_URL + "/sensor_readings?node_id=eq.NODE_01&order=timestamp.desc&limit=1", {
        headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }
    });
    const rows = await r.json();
    return rows[0];
}

async function runPython(row) {
    return new Promise((resolve) => {
        fs.writeFileSync("temp.json", JSON.stringify(row));
        const py = spawn("python", ["run_analysis.py", "temp.json"]);
        let out = "";
        py.stdout.on("data", d => out += d);
        py.on("close", () => {
            resolve(out);
        });
    });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runScenario(name, cmd, args, targetCount) {
    log(`\n\n--- RUNNING SCENARIO: ${name} ---`);

    const sim = spawn(cmd, args);
    sim.stdout.on("data", d => {
        const l = d.toString();
        if (l.includes("Sending")) {
            log("  Simulator: " + l.trim());
        }
    });

    const processed = new Set();

    for (let i = 0; i < targetCount; i++) {
        await delay(2500);
        const row = await fetchLatest();
        if (!row) {
            log("  DB: No row yet...");
            continue;
        }

        if (processed.has(row.timestamp)) {
            i--;
            continue;
        }
        processed.add(row.timestamp);

        const resultJson = await runPython(row);
        try {
            if (!resultJson.trim()) {
                log(`  Engine Error: empty output`);
                continue;
            }
            const parsed = JSON.parse(resultJson.trim());
            log(`  Engine: Status=${parsed.status.padEnd(8)} | RiskScore=${parsed.risk_score} | Warnings=[${parsed.warnings.join(', ')}]`);
            if (parsed.status === 'CRITICAL' && name.includes('CRITICAL')) {
                await delay(2500);
                const row2 = await fetchLatest();
                if (row2 && !processed.has(row2.timestamp)) {
                    processed.add(row2.timestamp);
                    const res2 = JSON.parse((await runPython(row2)).trim());
                    log(`  Engine: Status=${res2.status.padEnd(8)} | RiskScore=${res2.risk_score} | Warnings=[${res2.warnings.join(', ')}]`);
                }
                break;
            }
        } catch (e) {
            log(`  Engine Error: Cannot parse json => ${resultJson}`);
        }
    }

    sim.kill('SIGINT');
    await delay(1000); // give it time to die
    log(`--- SCENARIO END ---`);
}

async function main() {
    await runScenario("NORMAL", "node", ["simulator.js"], 4);
    log("Waiting 3 seconds before next scenario...");
    await delay(3000);
    await runScenario("CRITICAL (WARNING -> CRITICAL)", "node", ["simulator.js", "--scenario=critical", "--node=NODE_01"], 15);
}

main();
