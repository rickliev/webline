# Azure Deployment Plan

**Status:** Validated

## Application and Requirements

- **Application:** Webline browser game
- **Mode:** Deploy an existing application without changing gameplay architecture
- **Workload type:** Static, client-only Progressive Web App
- **Source stack:** TypeScript 5, Vite 7, Canvas 2D, HTML, and CSS
- **Build command:** `npm run build`
- **Build output:** `dist`
- **Runtime dependencies:** None
- **Scale:** Proof of concept / small public audience
- **Availability target:** Azure Static Web Apps platform availability
- **Budget target:** Cost optimized; use the Free hosting plan
- **Data:** No server-side data. Scores and preferences remain in each browser's local storage.

## Azure Context

- **Subscription:** MS Corp - Visual Studio Ultimate
- **Subscription ID:** `d28df2e0-e65d-4e67-b40b-f353dccd2ac5`
- **Region:** East US 2 (`eastus2`)
- **New resource group:** `rg-webline-eastus2`
- **Resource-group availability:** Verified unused
- **Policy check:** No inherited policy assignments were returned for the subscription

## Architecture

```text
Public browser
    |
    | HTTPS
    v
Azure Static Web Apps (Free)
    |
    +-- Vite production assets from dist/
    +-- manifest, icon, and service worker
    +-- browser-local high score and preferences
```

Azure Static Web Apps is the smallest service that fits the application. It
provides a public HTTPS URL, global static-content delivery, managed TLS, and
SPA-friendly hosting without a VM, container, storage account, or application
backend. The Free plan is appropriate because Webline has no API, database,
authentication, shared leaderboard, or uptime SLA requirement.

## Resource Inventory

| Resource | Type | Name | SKU | Purpose |
| --- | --- | --- | --- | --- |
| Resource group | `Microsoft.Resources/resourceGroups` | `rg-webline-eastus2` | N/A | Isolates all Webline resources |
| Static Web App | `Microsoft.Web/staticSites` | Generated as `stapp-webline-<unique>` | Free | Hosts the compiled game at a public HTTPS URL |

The Static Web App name will use Bicep `uniqueString()` with subscription and
resource-group inputs so it is stable for repeat deployments and globally
unique. Resources will be tagged with `application: webline`,
`environment: production`, and `azd-service-name: web`.

## Capacity and Limits

- The Azure Quota CLI was queried for `Microsoft.Web` in East US 2. It exposes
  App Service plan quotas but no Static Web Apps-specific quota entry.
- The subscription currently contains **1 Free Static Web App**.
- Microsoft documents a fixed maximum of **10 Free Static Web Apps per
  subscription**, leaving capacity for this deployment.
- The compiled application is expected to remain well below the Free plan's
  250 MB application-size limit.
- No quota increase is required.

## Deployment Method

Use Azure Developer CLI (AZD) with Bicep:

- `azure.yaml` defines one JavaScript service named `web`.
- `infra/main.bicep` runs at subscription scope, creates the new resource
  group, and invokes a resource-group-scoped module.
- `infra/modules/static-web-app.bicep` creates the Free Static Web App.
- `infra/main.parameters.json` maps AZD environment values into Bicep.
- AZD builds the Vite application and publishes `dist` to the provisioned
  Static Web App.

This keeps provisioning repeatable and avoids portal-only configuration.

## Security and Operations

- Public HTTPS access is intentional; Azure manages the service certificate.
- No credentials, API keys, personal data, or server-side secrets are needed.
- Infrastructure files contain no deployment token.
- The deployment uses the currently authenticated Azure identity and its RBAC
  permissions.
- Static Web Apps supplies platform diagnostics; no paid monitoring resource is
  justified for this static POC.
- The existing network-first service worker preserves offline fallback without
  changing Azure routing.

## Research Summary

- Azure Static Web Apps supports East US 2 and requires no supporting resource
  for this client-only application.
- The Free SKU fits the static PWA and intentionally permits public HTTPS
  access; private endpoints require Standard and would prevent public gameplay.
- The official Azure Verified Module
  `br/public:avm/res/web/static-site:0.3.0` is used instead of a handwritten
  resource declaration.
- AZD discovers the hosting target through the `azd-service-name: web` resource
  tag and deploys the Vite `dist` directory.
- Deployment tokens are not emitted from Bicep or stored in project files.
- Static Web App names allow 1-40 alphanumeric characters and hyphens and must
  be globally unique; the generated name conforms to those constraints.

## Files to Create or Update After Approval

- `azure.yaml`
- `infra/main.bicep`
- `infra/main.parameters.json`
- `infra/modules/static-web-app.bicep`
- `.azure/deployment-plan.md` status and deployment results
- `README.md` with the Azure deployment command and resulting public URL

## Execution and Verification

1. Generate the approved AZD and Bicep artifacts.
2. Create an AZD environment bound explicitly to subscription
   `d28df2e0-e65d-4e67-b40b-f353dccd2ac5` and East US 2.
3. Run `npm test` and `npm run build`.
4. Update this plan to `Ready for Validation`.
5. Run the mandatory Azure validation workflow for application and Bicep.
6. Run the Azure deployment workflow to provision and publish Webline.
7. Confirm the generated HTTPS endpoint returns the game and its built assets.
8. Record the endpoint here and in `README.md`, then set status to `Deployed`.

### All validation checks pass

- [x] AZD installation
- [x] Azure YAML/schema parsing
- [x] AZD environment setup
- [x] Azure authentication
- [x] Subscription and location
- [x] Aspire pre-provisioning checks (not applicable)
- [x] Provisioning what-if preview
- [x] Application build
- [x] Docker build context (not applicable)
- [x] AZD package
- [x] Azure policy assignments
- [x] Aspire post-provisioning checks (not applicable)
- [x] Static RBAC review

## Section 7: Validation Proof

Validation refreshed at `2026-09-02T16:22:00Z`.

| Check | Command or review | Result |
| --- | --- | --- |
| Tooling | `azd version` | AZD 1.28.0 available |
| Authentication | `azd auth login --check-status` and `az account show` | Authenticated as `rick@lievano.com` in the requested subscription |
| Environment | `azd env select webline` and `azd env get-values` | Existing `webline` environment targets `rg-webline-eastus2` in `eastus2` |
| Bicep compilation | `az bicep build --file .\infra\main.bicep --stdout` | Passed |
| Schema and what-if | `azd provision --preview --no-prompt` | Passed; existing resource group retained and Static Web App target resolved |
| Tests | `npm test -- --run` | 10 of 10 tests passed |
| Build | `npm run build` | Passed; Vite emitted `dist` |
| Package | `azd package --no-prompt` | Passed; packaged `dist` for service `web` |
| Policies | `az policy assignment list --disable-scope-strict-match` | No inherited assignments returned |
| Target conflict check | `az resource list` filtered by `azd-service-name: web` | Exactly one target found: `stapp-webline-3g2vfrbj` |
| Static RBAC review | Searched all Bicep files for identities and role assignments | No managed identity or data-plane access exists, so no role assignment is required |

## Deployment Results

- **Completed:** `2026-09-01`
- **Resource group:** `rg-webline-eastus2`
- **Static Web App:** `stapp-webline-3g2vfrbj`
- **SKU and region:** Free, East US 2
- **Public endpoint:** https://proud-meadow-0a396930f.3.azurestaticapps.net/
- **Provisioning:** `azd provision --no-prompt` succeeded
- **Publishing:** `azd deploy --no-prompt` succeeded
- **Endpoint verification:** Home page, JavaScript, CSS, web manifest, and
  service worker returned HTTP 200; the deployed page contains the Webline title
  and game canvas.
- **Live role verification:** The Static Web App has no managed identity and the
  client-only game accesses no Azure data plane, so no live role assignments are
  required.
- **Azure Portal:** https://portal.azure.com/#@/resource/subscriptions/d28df2e0-e65d-4e67-b40b-f353dccd2ac5/resourceGroups/rg-webline-eastus2/overview

## Approved Scope

The deployment remained within the approved boundary: one new resource group
and one Free-tier Azure Static Web App in the subscription and region listed
above.
