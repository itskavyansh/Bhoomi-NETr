// Temporary bridge script until Supabase->analysis wiring is decided\nconst SUPABASE_URL = "https://bnnrikqlhvcqpuqsujsf.supabase.co/rest/v1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnJpa3FsaHZjcXB1cXN1anNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU4Nzg5MCwiZXhwIjoyMTA0MTYzODkwfQ.3ffdNWfb2g0GmC1UqEE_Vma-nLsgXSjXkWJPAqPAM7M";

async function run() {
    const r = await fetch(SUPABASE_URL + "/sensor_readings?node_id=eq.NODE_01&order=timestamp.desc&limit=2", {
        headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }
    });
    const rows = await r.json();
    console.log(JSON.stringify(rows, null, 2));
}
run();
