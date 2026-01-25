#!/bin/bash

set -e

echo "🚀 TechChain Talent Hub - Setup Script"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js is not installed. Please install Node.js 20+${NC}"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${YELLOW}Warning: Node.js 20+ is recommended (found v$NODE_VERSION)${NC}"
fi
echo -e "${GREEN}Node.js: $(node -v)${NC}"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}pnpm not found, installing...${NC}"
  npm install -g pnpm
fi
echo -e "${GREEN}pnpm: $(pnpm -v)${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}Warning: Docker is not installed. You'll need to run Postgres and Redis manually.${NC}"
else
  echo -e "${GREEN}Docker: $(docker -v)${NC}"
fi

# Setup environment
echo ""
echo "📝 Setting up environment..."

if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${GREEN}Created .env from .env.example${NC}"
  echo -e "${YELLOW}Please update .env with your configuration${NC}"
else
  echo -e "${GREEN}.env already exists${NC}"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Start Docker services
echo ""
echo "🐳 Starting Docker services..."

if command -v docker &> /dev/null; then
  docker compose -f infra/docker/docker-compose.yml up -d

  # Wait for services
  echo "⏳ Waiting for services to be ready..."
  sleep 5
else
  echo -e "${YELLOW}Skipping Docker (not installed)${NC}"
  echo "Make sure Postgres and Redis are running manually"
fi

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
pnpm db:generate

# Run migrations
echo ""
echo "📊 Running database migrations..."
pnpm db:push

# Seed database
echo ""
echo "🌱 Seeding database..."
pnpm db:seed

echo ""
echo "========================================"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Demo accounts (use magic link login):"
echo "  Admin:              admin@techchain.io"
echo "  Company Admin:      hiring@defiprotocol.example"
echo "  Approved Recruiter: alice@recruiting.example"
echo "  Pending Recruiter:  bob@recruiting.example"
echo "  Candidate:          dev@example.com"
echo ""
echo "To start development:"
echo "  1. Terminal 1: pnpm dev        (Next.js app)"
echo "  2. Terminal 2: pnpm worker:dev (Background worker)"
echo ""
echo "Then open http://localhost:3000"
