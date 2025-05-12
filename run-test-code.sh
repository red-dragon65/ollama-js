#!/bin/bash

# Compile the typescript to javascript
echo "TRANSPILING TYPESCRIPT TO JAVASCRIPT"
echo ""
tsc examples/tools/vscode-debug-runner.ts
#tsc examples/tools/calculator.ts

# Run the javascript file
echo ""
echo "-----------------------------------------------------"
echo ""
echo "RUNNING TYPESCRIPT OUTPUT"
echo ""
node examples/tools/vscode-debug-runner.js
#node examples/tools/calculator.js


