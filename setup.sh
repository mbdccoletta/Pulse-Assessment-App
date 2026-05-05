#!/bin/bash
set -e

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${CYAN}📡 Pulse Assessment — Setup${NC}"
echo "─────────────────────────────────────"

# ─── Check Node.js ───
if ! command -v node &> /dev/null; then
  echo -e "${RED}✖ Node.js not found.${NC} Install from https://nodejs.org (v20+)"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}✖ Node.js v${NODE_VERSION} is too old.${NC} Required: v20+"
  exit 1
fi
echo -e "${GREEN}✔${NC} Node.js $(node -v)"

# ─── Check npm ───
if ! command -v npm &> /dev/null; then
  echo -e "${RED}✖ npm not found.${NC}"
  exit 1
fi
echo -e "${GREEN}✔${NC} npm v$(npm -v)"

# ─── Check app.config.json ───
if [ ! -f "app.config.json" ]; then
  echo -e "${RED}✖ app.config.json not found.${NC} Run this script from the project root."
  exit 1
fi

ENV_URL=$(grep -o '"environmentUrl"[[:space:]]*:[[:space:]]*"[^"]*"' app.config.json | grep -o 'https://[^"]*')
if echo "$ENV_URL" | grep -q "YOUR_TENANT_ID"; then
  echo -e "${YELLOW}⚠ Configure your tenant first:${NC}"
  echo "  Edit app.config.json → set environmentUrl to your Dynatrace tenant URL"
  echo ""
  echo -e "  Example: ${CYAN}\"environmentUrl\": \"https://abc12345.apps.dynatrace.com\"${NC}"
  exit 1
fi
echo -e "${GREEN}✔${NC} Tenant: ${ENV_URL}"

# ─── Install dependencies ───
echo ""
echo -e "${CYAN}Installing dependencies...${NC}"
npm ci --loglevel=error
echo -e "${GREEN}✔${NC} Dependencies installed"

# ─── Verify dt-app ───
if npx dt-app --version &> /dev/null; then
  echo -e "${GREEN}✔${NC} dt-app $(npx dt-app --version 2>/dev/null)"
else
  echo -e "${YELLOW}⚠ dt-app CLI could not be verified${NC}"
fi

# ─── Done ───
echo ""
echo "─────────────────────────────────────"
echo -e "${GREEN}✔ Setup complete!${NC}"
echo ""
echo "  Run locally:   npm run start"
echo "  Build:         npm run build"
echo "  Deploy:        npm run deploy"
echo ""
