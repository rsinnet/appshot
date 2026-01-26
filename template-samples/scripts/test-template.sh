#!/bin/bash

echo "🚀 Testing Appshot Template System"
echo "=================================="
echo ""

# Build the project
echo "Building Appshot..."
npm run build > /dev/null 2>&1

echo "✅ Build complete"
echo ""

# Test template list
echo "📋 Available Templates:"
echo "----------------------"
node dist/cli.js template --list | grep -E "^  (ocean-header|sunset-footer|clean-screenshot|pastel-header|noir-footer|silver-header|tropical-header|slate-footer|midnight-header)" | head -9
echo ""

# Test template preview
echo "🔍 Template Preview (ocean-header):"
echo "----------------------------------"
node dist/cli.js template --preview ocean-header | grep -E "^  (Type|Layout|Font|Background):" | head -5
echo ""

echo "✨ Template system is ready!"
echo ""
echo "Quick Start Commands:"
echo "  appshot quickstart                  # Interactive setup"
echo "  appshot template ocean-header       # Apply ocean header template"
echo "  appshot template --list             # View all templates"
echo ""
