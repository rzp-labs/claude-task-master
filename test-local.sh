#!/bin/bash
# Safe local testing script

echo "🧪 Testing Claude Code Provider Locally"
echo "======================================="

# Use absolute path to local task-master
TM_LOCAL="/Users/euge/Documents/GitHub/MASTER_claude-code-tm-roo-ontologies/tm-local-fork-pr-cc-intergration/claude-task-master/bin/task-master.js"

# Change to test directory
cd /Users/euge/Documents/GitHub/MASTER_claude-code-tm-roo-ontologies/tm-local-fork-pr-cc-intergration/claude-task-master/test-claude-code

echo "📍 Working directory: $(pwd)"
echo ""

# Show current configuration
echo "📋 Current Model Configuration:"
$TM_LOCAL models | grep -A5 "Active Model"
echo ""

# Set Claude Code as main provider
echo "🔧 Setting Claude Code as main provider..."
$TM_LOCAL models --set-main claude-code
echo ""

# Test parsing PRD
echo "📝 Testing PRD parsing..."
$TM_LOCAL parse-prd --input=test-prd.txt
echo ""

# Show generated tasks
echo "📊 Generated Tasks:"
$TM_LOCAL list --summary
echo ""

echo "✅ Test complete! Your global task-master is unaffected."