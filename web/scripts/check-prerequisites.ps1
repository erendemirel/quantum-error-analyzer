Write-Host "Checking prerequisites..." -ForegroundColor Cyan

$missing = @()

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Bun not found. Install from https://bun.sh" -ForegroundColor Red
    $missing += "bun"
} else {
    Write-Host "✅ Bun found" -ForegroundColor Green
}

if (-not (Get-Command wasm-pack -ErrorAction SilentlyContinue)) {
    Write-Host "❌ wasm-pack not found. Install with: cargo install wasm-pack" -ForegroundColor Red
    $missing += "wasm-pack"
} else {
    Write-Host "✅ wasm-pack found" -ForegroundColor Green
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Rust/Cargo not found. Install from https://rustup.rs" -ForegroundColor Red
    $missing += "cargo"
} else {
    Write-Host "✅ Rust/Cargo found" -ForegroundColor Green
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Missing prerequisites: $($missing -join ', ')" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "All prerequisites met!" -ForegroundColor Green

