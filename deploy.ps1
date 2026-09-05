# =============================================================================
# Bhoomi-NETr  |  Edge Function Deploy Script
# Run this in PowerShell from the project root ONCE you have a PAT.
#
# How to get a Personal Access Token (PAT):
#   1. Go to: https://supabase.com/dashboard/account/tokens
#   2. Click "Generate new token"
#   3. Name it "bhoomi-cli" — copy the value (shown only once)
#   4. Replace YOUR_PAT_HERE below, or set it as an env var
# =============================================================================

$PAT  = $Env:SUPABASE_ACCESS_TOKEN   # set this env var, OR replace with the literal token
$REF  = "bnnrikqlhvcqpuqsujsf"
$URL  = "https://bnnrikqlhvcqpuqsujsf.supabase.co"
$SRK  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnJpa3FsaHZjcXB1cXN1anNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU4Nzg5MCwiZXhwIjoyMTA0MTYzODkwfQ.3ffdNWfb2g0GmC1UqEE_Vma-nLsgXSjXkWJPAqPAM7M"

if (-not $PAT) {
    Write-Error "Set the SUPABASE_ACCESS_TOKEN env var first:`n  `$Env:SUPABASE_ACCESS_TOKEN = 'your-token-here'"
    exit 1
}

Write-Host "1/4  Authenticating with Supabase CLI..."
supabase login --token $PAT

Write-Host "2/4  Linking to project $REF..."
supabase link --project-ref $REF

Write-Host "3/4  Setting Edge Function secrets..."
supabase secrets set `
  SUPABASE_URL=$URL `
  SUPABASE_SERVICE_ROLE_KEY=$SRK `
  --project-ref $REF

Write-Host "4/4  Deploying sensor-data function..."
supabase functions deploy sensor-data --project-ref $REF

Write-Host ""
Write-Host "DONE. Function live at:"
Write-Host "  https://$REF.supabase.co/functions/v1/sensor-data"
Write-Host ""
Write-Host "Run tests:"
Write-Host "  node test_function.js"
