#!/bin/bash

echo "Checking prerequisites..."

if ! command -v bun &> /dev/null; then
    echo "❌ Bun not found. Install from https://bun.sh"
    exit 1
fi
echo "✅ Bun found"

if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack not found. Install with: cargo install wasm-pack"
    exit 1
fi
echo "✅ wasm-pack found"

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo not found. Install from https://rustup.rs"
    exit 1
fi
echo "✅ Rust/Cargo found"

echo ""
echo "All prerequisites met!"

