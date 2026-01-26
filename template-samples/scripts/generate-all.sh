#!/usr/bin/env bash

# Generate template sample assets locally using only this repo's files.
# - Builds the CLI
# - Prepares local screenshots per device
# - Generates per-template gallery images (root)
# - Generates per-device samples for iPhone, iPad, Watch, Mac
# - Creates the combined gallery montage when iPhone samples are built
# - Ensures index assets exist (e.g., mac/placeholder.png)

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "Usage: $(basename "$0") [all|iphone|ipad|watch|mac]"
}

device_label() {
  case "$1" in
    iphone) echo "iPhone" ;;
    ipad) echo "iPad" ;;
    watch) echo "Watch" ;;
    mac) echo "Mac" ;;
    all) echo "all devices" ;;
    *) echo "$1" ;;
  esac
}

TARGET_INPUT="${1:-all}"
TARGET="$(printf '%s' "$TARGET_INPUT" | tr '[:upper:]' '[:lower:]')"
case "$TARGET" in
  -h|--help)
    usage
    exit 0
    ;;
  all)
    SELECTED_DEVICES=(iphone ipad watch mac)
    ;;
  iphone|ipad|watch|mac)
    SELECTED_DEVICES=("$TARGET")
    ;;
  *)
    echo -e "${RED}✗ Invalid device '${TARGET_INPUT}'. Choose from iphone, ipad, watch, mac, or all.${NC}"
    exit 1
    ;;
esac

if [[ "$TARGET" != "all" ]]; then
  echo -e "${BLUE}🎯 Limiting generation to $(device_label "$TARGET") samples...${NC}"
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
SAMPLES_DIR="$ROOT_DIR/template-samples"
CLI_JS="$ROOT_DIR/dist/cli.js"

echo -e "${BLUE}📦 Building Appshot CLI...${NC}"
cd "$ROOT_DIR"
npm run build >/dev/null 2>&1 || {
  echo -e "${RED}✗ Build failed${NC}";
  exit 1;
}
echo -e "${GREEN}✓ Build complete${NC}\n"

# Ensure CLI exists
if [[ ! -f "$CLI_JS" ]]; then
  echo -e "${RED}✗ CLI not found at ${CLI_JS}${NC}"
  exit 1
fi

cd "$SAMPLES_DIR"

# Prepare local screenshots folder structure
echo -e "${BLUE}📁 Preparing local screenshots...${NC}"
for device in "${SELECTED_DEVICES[@]}"; do
  mkdir -p "screenshots/$device"
  src_png="screenshots/${device}.png"
  dest_png="screenshots/$device/home.png"
  if [[ -f "$src_png" ]]; then
    if [[ ! -f "$dest_png" ]]; then
      cp "$src_png" "$dest_png"
      echo -e "  ${GREEN}✓${NC} ${device}: added home.png from ${device}.png"
    else
      echo -e "  ${YELLOW}•${NC} ${device}: home.png already present"
    fi
  else
    echo -e "  ${YELLOW}⚠${NC} ${device}: source ${device}.png not found (skipping)"
  fi
done
echo ""

# Backup current config and restore on exit
CONFIG_DIR=".appshot"
CONFIG_FILE="$CONFIG_DIR/config.json"
BACKUP_FILE="$CONFIG_DIR/config.original.json"

restore_config() {
  if [[ -f "$BACKUP_FILE" ]]; then
    mv "$BACKUP_FILE" "$CONFIG_FILE"
    echo -e "${GREEN}✓${NC} Restored original config"
  fi
}

cleanup_device_dirs() {
  for device in "${SELECTED_DEVICES[@]}"; do
    rm -rf "screenshots/$device"
  done
}

on_exit() {
  cleanup_device_dirs
  restore_config
}

if [[ -f "$CONFIG_FILE" && ! -f "$BACKUP_FILE" ]]; then
  cp "$CONFIG_FILE" "$BACKUP_FILE"
fi
trap on_exit EXIT

mkdir -p "$CONFIG_DIR/captions"

# Helper: build one device and copy output
build_device_sample() {
  local template="$1"; shift
  local device="$1"; shift
  local caption="$1"; shift
  local out_path="$1"; shift

  echo -e "${BLUE}→${NC} ${template} on ${device}"

  node "$CLI_JS" template "$template" --no-backup >/dev/null 2>&1

  # Write captions file
  echo "{\"home.png\": \"$caption\"}" > "$CONFIG_DIR/captions/${device}.json"

  # Build this device only
  node "$CLI_JS" build --devices "$device" >/dev/null 2>&1 || true

  # Copy first output
  local src1="final/${device}/en/home.png"
  local src2="final/${device}/home.png"
  local src="$src1"
  [[ -f "$src1" ]] || src="$src2"

  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$out_path")"
    cp "$src" "$out_path"
    echo -e "   ${GREEN}✓${NC} Wrote $(basename "$out_path")"
  else
    echo -e "   ${RED}✗${NC} No output for ${device} (${template})"
  fi

  rm -rf final/
}

# Determine whether to produce gallery images (only when iPhone is selected)
GENERATE_GALLERY=false
for device in "${SELECTED_DEVICES[@]}"; do
  if [[ "$device" == "iphone" ]]; then
    GENERATE_GALLERY=true
    break
  fi
done

# Clean previous generated outputs to avoid stale images
for d in "${SELECTED_DEVICES[@]}"; do
  mkdir -p "$d"
  rm -f "$d"/*.png 2>/dev/null || true
done
if $GENERATE_GALLERY; then
  mkdir -p gallery
  rm -f gallery/*.png 2>/dev/null || true
fi

# Templates and captions
TEMPLATES=(ocean-header sunset-footer clean-screenshot pastel-header noir-footer silver-header tropical-header slate-footer midnight-header)
caption_for_template() {
  case "$1" in
    ocean-header) echo "Fresh clarity for your best ideas" ;;
    sunset-footer) echo "Bold highlights with warm energy" ;;
    clean-screenshot) echo "Let the product do the talking" ;;
    pastel-header) echo "Soft focus for modern teams" ;;
    noir-footer) echo "High-contrast, premium feel" ;;
    silver-header) echo "Elegant polish for professionals" ;;
    tropical-header) echo "Bright, playful momentum" ;;
    slate-footer) echo "Confident, corporate clarity" ;;
    midnight-header) echo "Deep focus, crisp contrast" ;;
    *) echo "Beautiful App Screenshots" ;;
  esac
}

# 1) Generate per-device samples (all templates for each selected device)
echo -e "${BLUE}📸 Generating device samples...${NC}"
for device in "${SELECTED_DEVICES[@]}"; do
  for template in "${TEMPLATES[@]}"; do
    caption="$(caption_for_template "$template")"
    build_device_sample "$template" "$device" "$caption" "$device/${template}-${device}.png"
  done
  echo ""
done

# 2) Generate gallery card samples (iPhone-based) into gallery/
if $GENERATE_GALLERY; then
  echo -e "${BLUE}🎨 Generating gallery template samples...${NC}"
  for template in "${TEMPLATES[@]}"; do
    caption="$(caption_for_template "$template")"
    build_device_sample "$template" iphone "$caption" "gallery/${template}-sample.png"
  done
  echo ""
fi

# 3) Create combined gallery image
if $GENERATE_GALLERY; then
  if command -v magick >/dev/null 2>&1; then
    echo -e "${BLUE}🖼  Creating combined gallery (ImageMagick)...${NC}"
    magick montage \
      -label "Ocean" gallery/ocean-header-sample.png \
      -label "Sunset" gallery/sunset-footer-sample.png \
      -label "Clean" gallery/clean-screenshot-sample.png \
      -label "Pastel" gallery/pastel-header-sample.png \
      -label "Noir" gallery/noir-footer-sample.png \
      -label "Silver" gallery/silver-header-sample.png \
      -label "Tropical" gallery/tropical-header-sample.png \
      -label "Slate" gallery/slate-footer-sample.png \
      -label "Midnight" gallery/midnight-header-sample.png \
      -geometry 400x866+10+10 \
      -tile 3x3 \
      -background white \
      -font Helvetica \
      -pointsize 24 \
      -fill black \
      gallery/template-gallery.png
    echo -e "${GREEN}✓${NC} gallery/template-gallery.png created"
  elif command -v montage >/dev/null 2>&1; then
    echo -e "${BLUE}🖼  Creating combined gallery (montage)...${NC}"
    montage \
      -label "Ocean" gallery/ocean-header-sample.png \
      -label "Sunset" gallery/sunset-footer-sample.png \
      -label "Clean" gallery/clean-screenshot-sample.png \
      -label "Pastel" gallery/pastel-header-sample.png \
      -label "Noir" gallery/noir-footer-sample.png \
      -label "Silver" gallery/silver-header-sample.png \
      -label "Tropical" gallery/tropical-header-sample.png \
      -label "Slate" gallery/slate-footer-sample.png \
      -label "Midnight" gallery/midnight-header-sample.png \
      -geometry 400x866+10+10 \
      -tile 3x3 \
      -background white \
      gallery/template-gallery.png
    echo -e "${GREEN}✓${NC} gallery/template-gallery.png created"
  else
    echo -e "${YELLOW}⚠${NC} ImageMagick not found; skipping template-gallery.png"
  fi
  echo ""
fi

# 4) Ensure mac folder exists when generating mac samples
for device in "${SELECTED_DEVICES[@]}"; do
  if [[ "$device" == "mac" ]]; then
    mkdir -p mac
    break
  fi
done

echo -e "${GREEN}✨ All selected samples generated successfully${NC}"
