#!/usr/bin/env bash

echo "----------------------------------------"
echo " EchoAI Developer Setup Script"
echo "----------------------------------------"

# Check Node installation
if ! command -v node &> /dev/null
then
    echo "Node.js is not installed. Please install Node.js (LTS)."
    exit 1
else
    echo "✔ Node.js found: $(node -v)"
fi

# Check npm installation
if ! command -v npm &> /dev/null
then
    echo "npm is not installed. Install Node.js which includes npm."
    exit 1
else
    echo "✔ npm found: $(npm -v)"
fi

echo ""
echo "Installing npm dependencies..."
npm install

echo ""
echo "Setting up environment..."

# Create .env file if it does not exist
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✔ .env created. Add your Gemini API key inside."
else
    echo "✔ .env already exists. Skipping."