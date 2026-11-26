#!/usr/bin/env bash
# Builds dist/SkyClans.mcaddon (open it on your device to import both packs).
set -e
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/SkyClans.mcaddon
zip -qr dist/SkyClans.mcaddon SkyClans_BP SkyClans_RP
echo "built dist/SkyClans.mcaddon"
