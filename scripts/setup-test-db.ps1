# PowerShell script to create test database
# Usage: .\scripts\setup-test-db.ps1

Write-Host "Creating test database..." -ForegroundColor Cyan

$env:PGPASSWORD = "postgres"
$connectionString = "host=localhost port=5433 user=postgres dbname=postgres"

try {
    psql $connectionString -c "CREATE DATABASE chatapp_test;" 2>$null
    Write-Host "✅ Test database created" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database chatapp_test already exists or connection failed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy .env.test.example to .env.test"
Write-Host "2. Update DATABASE_URL in .env.test to use chatapp_test"
Write-Host "3. Run migrations: pnpm prisma migrate deploy"

