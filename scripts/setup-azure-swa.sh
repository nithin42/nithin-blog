#!/usr/bin/env bash
#
# setup-azure-swa.sh — one-command Azure Static Web Apps deployment setup.
#
# Provisions EVERYTHING this repo needs to deploy to Azure Static Web Apps from
# GitHub Actions using Microsoft Entra ID (OIDC) — no long-lived deployment
# token is ever stored in GitHub. Safe to run more than once (idempotent): it
# checks for each resource before creating it, so a second run just fills in
# whatever is missing.
#
# What it creates:
#   1. A resource group
#   2. A Static Web App (Free tier)
#   3. An Entra ID app registration + service principal (the CI/CD identity)
#   4. Two federated credentials (main branch + pull requests) — how GitHub
#      proves its identity to Azure without a secret
#   5. A CUSTOM, least-privilege RBAC role that can ONLY read this one Static
#      Web App's deployment token — nothing else
#   6. Three GitHub Actions secrets (identifiers, not access keys) and two
#      GitHub Actions variables (the SWA name + resource group)
#
# Prerequisites (things a script can't do for you — do these first):
#   - az login       (use `az login --use-device-code` in headless containers)
#   - gh auth login   (needs the `repo` scope; repo admin to set secrets)
#   - Directory role that can register apps (Application Developer or higher)
#   - Owner or User Access Administrator on the subscription/resource group
#     (needed to create the custom role and assign it)
#
# Usage:
#   ./scripts/setup-azure-swa.sh
#
# Override any default with an environment variable, e.g.:
#   SWA_NAME=my-blog RESOURCE_GROUP=my-blog-rg LOCATION=westeurope \
#     ./scripts/setup-azure-swa.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — override via environment variables.
# ---------------------------------------------------------------------------
SWA_NAME="${SWA_NAME:-russrimmerman-blog}"
RESOURCE_GROUP="${RESOURCE_GROUP:-russrimmerman-blog-rg}"
LOCATION="${LOCATION:-eastus2}"           # SWA regions: eastus2, centralus, westus2, westeurope, eastasia
SKU="${SKU:-Free}"                          # Free or Standard
APP_NAME="${APP_NAME:-${SWA_NAME}-deploy}" # Entra app registration display name

# Repo is auto-detected from the GitHub CLI. Override with REPO=owner/name.
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)}"

# ---------------------------------------------------------------------------
# Helpers.
# ---------------------------------------------------------------------------
say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
info() { printf '  \033[0;90m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✓ %s\033[0m\n' "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is not installed."; exit 1; }
}

# In some environments the GitHub CLI defaults to an injected GITHUB_TOKEN,
# which usually can't manage secrets. Prefer your interactive `gh auth login`.
gh() { env -u GITHUB_TOKEN -u GH_TOKEN command gh "$@"; }

# ---------------------------------------------------------------------------
# 0. Preflight — confirm tooling and sign-in.
# ---------------------------------------------------------------------------
say "Checking prerequisites"
require az
require gh

az account show >/dev/null 2>&1 || { echo "ERROR: not signed in to Azure. Run 'az login' first."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: not signed in to GitHub. Run 'gh auth login' first."; exit 1; }
[ -n "$REPO" ] || { echo "ERROR: could not detect the GitHub repo. Set REPO=owner/name."; exit 1; }

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
ok "Azure subscription: $SUBSCRIPTION_ID"
ok "GitHub repo:        $REPO"
info "SWA=$SWA_NAME  RG=$RESOURCE_GROUP  Location=$LOCATION  SKU=$SKU"

# ---------------------------------------------------------------------------
# 1. Resource group. WHY: a container for the Static Web App so everything is
#    easy to find, manage, and delete together.
# ---------------------------------------------------------------------------
say "1/6 Resource group"
if az group show --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
  ok "Resource group '$RESOURCE_GROUP' already exists"
else
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" -o none
  ok "Created resource group '$RESOURCE_GROUP'"
fi

# ---------------------------------------------------------------------------
# 2. Static Web App. WHY: the hosting resource that serves your built site and
#    the /api functions. We create it WITHOUT linking a repo so Azure doesn't
#    inject its own workflow — this repo already has a hardened one.
# ---------------------------------------------------------------------------
say "2/6 Static Web App"
if az staticwebapp show --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
  ok "Static Web App '$SWA_NAME' already exists"
else
  az staticwebapp create --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" --sku "$SKU" -o none
  ok "Created Static Web App '$SWA_NAME'"
fi
SWA_ID="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)"
SWA_HOST="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostname -o tsv)"

# ---------------------------------------------------------------------------
# 3. Entra ID app registration + service principal. WHY: this is the identity
#    GitHub Actions "becomes" when it talks to Azure. Using a dedicated identity
#    (instead of your personal account or a shared key) means access is scoped,
#    auditable, and revocable.
# ---------------------------------------------------------------------------
say "3/6 Entra ID identity (app registration + service principal)"
APP_ID="$(az ad app list --display-name "$APP_NAME" --query '[0].appId' -o tsv 2>/dev/null || true)"
if [ -n "$APP_ID" ]; then
  ok "App registration '$APP_NAME' already exists ($APP_ID)"
else
  APP_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
  ok "Created app registration '$APP_NAME' ($APP_ID)"
fi
if az ad sp show --id "$APP_ID" >/dev/null 2>&1; then
  ok "Service principal already exists"
else
  az ad sp create --id "$APP_ID" -o none
  ok "Created service principal"
fi

# ---------------------------------------------------------------------------
# 4. Federated credentials. WHY: this is the secret-less part. Each GitHub
#    Actions run requests a short-lived OIDC token that says "I am the main
#    branch (or a PR) of REPO". Azure trusts that token ONLY for the exact
#    subject below — so no password or key ever leaves GitHub.
# ---------------------------------------------------------------------------
say "4/6 Federated credentials (OIDC trust)"
ensure_fic() {
  local name="$1" subject="$2"
  if az ad app federated-credential list --id "$APP_ID" --query "[?name=='$name'] | [0].name" -o tsv 2>/dev/null | grep -q "$name"; then
    ok "Federated credential '$name' already exists"
  else
    az ad app federated-credential create --id "$APP_ID" --parameters "{
      \"name\": \"$name\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"$subject\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }" -o none
    ok "Created federated credential '$name'"
  fi
}
ensure_fic "github-main-branch"  "repo:${REPO}:ref:refs/heads/main"
ensure_fic "github-pull-requests" "repo:${REPO}:pull_request"

# ---------------------------------------------------------------------------
# 5. Least-privilege RBAC. WHY: the deploy action needs a deployment token,
#    which we fetch at runtime instead of storing it. To fetch it the identity
#    needs exactly ONE permission — listSecrets on THIS Static Web App. We use a
#    custom role scoped to the single resource so the identity can do nothing
#    else in the subscription. (Built-in Contributor would work but grants far
#    more than needed.)
# ---------------------------------------------------------------------------
say "5/6 Least-privilege role (deployment-token read only)"
ROLE_NAME="SWA Deployment Token Reader (${SWA_NAME})"
if az role definition list --name "$ROLE_NAME" --query '[0].roleName' -o tsv 2>/dev/null | grep -q .; then
  ok "Custom role already exists"
else
  ROLE_DEF="$(mktemp)"
  cat > "$ROLE_DEF" <<JSON
{
  "Name": "$ROLE_NAME",
  "IsCustom": true,
  "Description": "Read the deployment token of a single Static Web App for CI/CD. Least privilege: listSecrets + read on this one resource only.",
  "Actions": [
    "Microsoft.Web/staticSites/read",
    "Microsoft.Web/staticSites/listSecrets/action"
  ],
  "NotActions": [],
  "DataActions": [],
  "NotDataActions": [],
  "AssignableScopes": ["$SWA_ID"]
}
JSON
  az role definition create --role-definition "$ROLE_DEF" -o none
  rm -f "$ROLE_DEF"
  ok "Created custom role '$ROLE_NAME'"
  info "Waiting for the role definition to propagate…"
  sleep 20
fi

if az role assignment list --assignee "$APP_ID" --scope "$SWA_ID" \
     --query "[?roleDefinitionName=='$ROLE_NAME'] | [0]" -o tsv 2>/dev/null | grep -q .; then
  ok "Role already assigned to the identity"
else
  # Retry briefly — a freshly created custom role can take a moment to be assignable.
  for attempt in 1 2 3 4 5; do
    if az role assignment create --assignee "$APP_ID" --role "$ROLE_NAME" --scope "$SWA_ID" -o none 2>/dev/null; then
      ok "Assigned '$ROLE_NAME' to the identity"
      break
    fi
    info "Role not assignable yet (attempt $attempt) — retrying…"
    sleep 15
  done
fi

# ---------------------------------------------------------------------------
# 6. GitHub configuration. WHY: the workflow needs to know WHICH identity to log
#    in as (the three secrets are identifiers, not passwords) and WHICH Static
#    Web App to deploy to (the two variables). None of these are sensitive.
# ---------------------------------------------------------------------------
say "6/6 GitHub Actions secrets + variables"
gh secret set AZURE_CLIENT_ID       --repo "$REPO" --body "$APP_ID"          && ok "Set secret AZURE_CLIENT_ID"
gh secret set AZURE_TENANT_ID       --repo "$REPO" --body "$TENANT_ID"       && ok "Set secret AZURE_TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID --repo "$REPO" --body "$SUBSCRIPTION_ID" && ok "Set secret AZURE_SUBSCRIPTION_ID"
gh variable set SWA_NAME            --repo "$REPO" --body "$SWA_NAME"        && ok "Set variable SWA_NAME"
gh variable set SWA_RESOURCE_GROUP  --repo "$REPO" --body "$RESOURCE_GROUP"  && ok "Set variable SWA_RESOURCE_GROUP"

# Remove the legacy long-lived deployment-token secret if it lingers — the
# workflow no longer uses it, and unused secrets are attack surface.
if gh secret list --repo "$REPO" | grep -q '^AZURE_STATIC_WEB_APPS_API_TOKEN'; then
  gh secret delete AZURE_STATIC_WEB_APPS_API_TOKEN --repo "$REPO" && ok "Removed legacy AZURE_STATIC_WEB_APPS_API_TOKEN secret"
fi

# ---------------------------------------------------------------------------
# Done.
# ---------------------------------------------------------------------------
say "Setup complete"
ok  "Static Web App: https://${SWA_HOST}"
info "Push to 'main' (or re-run the workflow) and GitHub Actions will build and deploy."
