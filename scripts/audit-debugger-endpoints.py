#!/usr/bin/env python3
"""
Audit all debugger service endpoints through Front Door.

Usage:
    # First acquire a token (or use cached):
    python3 scripts/audit-debugger-endpoints.py

    # With custom Front Door URL:
    DEBUGGER_FD_URL=https://... python3 scripts/audit-debugger-endpoints.py

Output is written to scripts/audit-results.json and a human-readable summary
is printed to stdout.
"""
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# --- Configuration ---
FD_URL = os.environ.get(
    "DEBUGGER_FD_URL",
    "https://sym-api-fagzf6fdbdanbdb4.z03.azurefd.net",
)
TOKEN_FILE = "/tmp/sym_debug_token.txt"
RESULTS_FILE = Path(__file__).parent / "audit-results.json"

# ROPC token acquisition settings
CIAM_TENANT_NAME = "symmetryciam"
CIAM_TENANT_ID = "e29c2129-9bc7-42f3-80b7-0bd57f442167"
CIAM_CLIENT_ID = "54fc09c2-534a-4c9a-afc3-f7f68421ad1f"
CIAM_USERNAME = "integration-test@symmetryciam.onmicrosoft.com"
CIAM_PASSWORD = "W@rriors22"

# --- Endpoint definitions ---
ENDPOINTS = [
    # ── Insights (Home page) ──
    {"method": "GET", "path": "/debug/insights/pulse", "page": "Home", "id": 1},
    {"method": "GET", "path": "/debug/insights/top-workspaces?limit=5", "page": "Home", "id": 2},
    {"method": "GET", "path": "/debug/insights/pipeline-health", "page": "Home", "id": 3},
    {"method": "GET", "path": "/debug/insights/cost-breakdown?days=7", "page": "Home", "id": 4},
    # ── Insights (Insights page) ──
    {"method": "GET", "path": "/debug/insights/growth?days=7", "page": "Insights", "id": 5},
    {"method": "GET", "path": "/debug/insights/engagement", "page": "Insights", "id": 6},
    {"method": "GET", "path": "/debug/insights/feature-adoption", "page": "Insights", "id": 7},
    {"method": "GET", "path": "/debug/insights/retention?weeks=4", "page": "Insights", "id": 8},
    {"method": "GET", "path": "/debug/insights/unit-economics", "page": "Insights", "id": 9},
    {"method": "GET", "path": "/debug/insights/active-users", "page": "Insights", "id": 36},
    {"method": "GET", "path": "/debug/insights/scaling", "page": "Insights", "id": 37},
    # ── Errors ──
    {"method": "GET", "path": "/debug/errors/timeline?hours=24", "page": "Errors", "id": 10},
    {"method": "GET", "path": "/debug/errors/clusters?hours=24", "page": "Errors", "id": 11},
    {"method": "GET", "path": "/debug/errors/failed-jobs?hours=24", "page": "Errors", "id": 12},
    {"method": "GET", "path": "/debug/errors/deploy-correlation?hours=48", "page": "Errors", "id": 38},
    # ── Data Health ──
    {"method": "GET", "path": "/debug/health/score", "page": "Data Health", "id": 13},
    {"method": "GET", "path": "/debug/health/consistency", "page": "Data Health", "id": 14},
    {"method": "GET", "path": "/debug/health/orphans", "page": "Data Health", "id": 15},
    {"method": "GET", "path": "/debug/health/encryption", "page": "Data Health", "id": 39},
    {"method": "POST", "path": "/debug/health/run-check", "page": "Data Health", "id": 40, "body": {}},
    # ── Infrastructure ──
    {"method": "GET", "path": "/debug/infra/topology", "page": "Infrastructure", "id": 41},
    {"method": "GET", "path": "/debug/infra/container-apps", "page": "Infrastructure", "id": 16},
    {"method": "GET", "path": "/debug/infra/container-apps/detailed", "page": "Infrastructure", "id": 42},
    {"method": "GET", "path": "/debug/infra/postgresql", "page": "Infrastructure", "id": 17},
    {"method": "GET", "path": "/debug/infra/neo4j", "page": "Infrastructure", "id": 18},
    {"method": "GET", "path": "/debug/infra/service-bus", "page": "Infrastructure", "id": 19},
    {"method": "GET", "path": "/debug/infra/storage", "page": "Infrastructure", "id": 20},
    {"method": "GET", "path": "/debug/infra/openai?hours=24", "page": "Infrastructure", "id": 31},
    {"method": "GET", "path": "/debug/infra/key-vault?hours=24", "page": "Infrastructure", "id": 32},
    {"method": "GET", "path": "/debug/infra/front-door?hours=24", "page": "Infrastructure", "id": 33},
    {"method": "GET", "path": "/debug/infra/vnet", "page": "Infrastructure", "id": 34},
    {"method": "GET", "path": "/debug/infra/app-insights?hours=24", "page": "Infrastructure", "id": 35},
    {"method": "GET", "path": "/debug/infra/costs?days=7", "page": "Infra Costs", "id": 30},
    {"method": "GET", "path": "/debug/infra/alerts?hours=24", "page": "Infrastructure", "id": 43},
    {"method": "GET", "path": "/debug/infra/deployments", "page": "Infrastructure", "id": 44},
    {"method": "GET", "path": "/debug/infra/database/metrics?hours=24", "page": "Infrastructure", "id": 45},
    {"method": "GET", "path": "/debug/infra/llm/costs?days=30", "page": "LLM Metrics", "id": 46},
    {"method": "GET", "path": "/debug/infra/llm/metrics?hours=24", "page": "LLM Metrics", "id": 47},
    # ── Scalability ──
    {"method": "GET", "path": "/debug/scale/services", "page": "Scalability", "id": 21},
    {"method": "GET", "path": "/debug/scale/quotas", "page": "Scalability", "id": 22},
    {"method": "GET", "path": "/debug/scale/bottlenecks?hours=24", "page": "Scalability", "id": 23},
    {"method": "GET", "path": "/debug/scale/database", "page": "Scalability", "id": 24},
    {"method": "GET", "path": "/debug/scale/events?hours=24", "page": "Scalability", "id": 48},
    # ── Workspaces ──
    {"method": "GET", "path": "/debug/workspaces?page=1&page_size=5", "page": "Workspaces", "id": 25},
    # ── Admin ──
    {"method": "GET", "path": "/debug/admin/whitelist", "page": "Admin", "id": 26},
    # ── Log Explorer ──
    {"method": "GET", "path": "/debug/logs/saved-queries", "page": "Log Explorer", "id": 29},
    {
        "method": "POST",
        "path": "/debug/logs/query",
        "page": "Log Explorer",
        "id": 27,
        "body": {"query": "requests | take 5", "timespan": "PT1H"},
    },
    {
        "method": "POST",
        "path": "/debug/logs/ai-generate",
        "page": "Log Explorer",
        "id": 49,
        "body": {"question": "Show me the top 5 slowest requests in the last hour"},
    },
    # ── Queries (SQL/Cypher) ──
    {
        "method": "POST",
        "path": "/debug/queries/sql",
        "page": "Queries",
        "id": 50,
        "body": {"query": "SELECT COUNT(*) as total FROM users", "limit": 10},
    },
    {
        "method": "POST",
        "path": "/debug/queries/cypher",
        "page": "Queries",
        "id": 51,
        "body": {"query": "MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC LIMIT 10", "limit": 10},
    },
    # ── AI Chat ──
    {
        "method": "POST",
        "path": "/debug/ai/chat",
        "page": "AI Chat",
        "id": 28,
        "body": {"messages": [{"role": "user", "content": "What is the current system status?"}]},
    },
    # ── Observability ──
    {"method": "GET", "path": "/debug/observability/api-performance?hours=24", "page": "Observability", "id": 52},
    {"method": "GET", "path": "/debug/observability/dependency-map?hours=24", "page": "Observability", "id": 53},
    {"method": "GET", "path": "/debug/observability/error-hotspots?hours=24", "page": "Observability", "id": 54},
    {"method": "GET", "path": "/debug/observability/throughput-trends?hours=24", "page": "Observability", "id": 55},
    {"method": "GET", "path": "/debug/observability/slo-status?hours=24", "page": "Observability", "id": 56},
    # ── Tools Schema ──
    {"method": "GET", "path": "/debug/tools/schema", "page": "Tools", "id": 57},
]


def acquire_token() -> str:
    """Acquire token via ROPC flow."""
    print("Acquiring token via ROPC flow...")
    token_url = f"https://{CIAM_TENANT_NAME}.ciamlogin.com/{CIAM_TENANT_ID}/oauth2/v2.0/token"
    cmd = [
        "curl", "-s", "-X", "POST", token_url,
        "-d", f"grant_type=password&client_id={CIAM_CLIENT_ID}&scope=openid+profile&username={CIAM_USERNAME}&password={CIAM_PASSWORD}",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    data = json.loads(result.stdout)

    token = data.get("id_token") or data.get("access_token")
    if not token:
        print(f"  FAILED: {data.get('error_description', data)}")
        sys.exit(1)

    # Cache it
    Path(TOKEN_FILE).write_text(token)
    print(f"  Token acquired ({len(token)} chars), cached to {TOKEN_FILE}")
    return token


def get_token() -> str:
    """Get cached token or acquire new one."""
    if Path(TOKEN_FILE).exists():
        token = Path(TOKEN_FILE).read_text().strip()
        if len(token) > 100:
            print(f"Using cached token from {TOKEN_FILE} ({len(token)} chars)")
            return token
    return acquire_token()


def test_endpoint(token: str, endpoint: dict) -> dict:
    """Test a single endpoint and return full result."""
    url = f"{FD_URL}{endpoint['path']}"
    method = endpoint.get("method", "GET")

    cmd = [
        "curl", "-s", "--connect-timeout", "10", "--max-time", "45",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Content-Type: application/json",
        "-w", "\n__HTTP_CODE__%{http_code}__TIME__%{time_total}",
    ]

    if method == "POST":
        body = json.dumps(endpoint.get("body", {}))
        cmd.extend(["-X", "POST", "-d", body])

    cmd.append(url)

    start = time.time()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=50)
        elapsed = time.time() - start
    except subprocess.TimeoutExpired:
        return {
            **endpoint,
            "status": "TIMEOUT",
            "http_code": 0,
            "elapsed_s": 50.0,
            "response_body": None,
            "error": "Request timed out after 50s",
            "data_summary": "TIMEOUT",
        }

    # Parse output
    output = result.stdout
    http_code = 0
    curl_time = 0.0
    body_text = ""

    if "__HTTP_CODE__" in output:
        parts = output.rsplit("\n__HTTP_CODE__", 1)
        body_text = parts[0]
        meta = parts[1] if len(parts) > 1 else ""
        try:
            http_code = int(meta.split("__TIME__")[0])
        except (ValueError, IndexError):
            pass
        try:
            curl_time = float(meta.split("__TIME__")[1])
        except (ValueError, IndexError):
            pass
    else:
        body_text = output

    # Parse JSON response
    response_data = None
    data_summary = ""
    error = None

    try:
        response_data = json.loads(body_text)
        if http_code == 200:
            data = response_data.get("data", response_data)
            metadata = response_data.get("metadata", {})
            if isinstance(data, list):
                data_summary = f"{len(data)} items"
            elif isinstance(data, dict):
                keys = list(data.keys())
                non_empty = {
                    k: type(v).__name__
                    for k, v in data.items()
                    if v is not None and v != [] and v != {} and v != 0 and v != ""
                }
                empty = [
                    k for k, v in data.items()
                    if v is None or v == [] or v == {} or v == 0
                ]
                data_summary = f"fields={list(non_empty.keys())}"
                if empty:
                    data_summary += f" | empty={empty}"
                if metadata.get("query_time_ms"):
                    data_summary += f" | query={metadata['query_time_ms']:.0f}ms"
            else:
                data_summary = str(data)[:100]
        else:
            detail = response_data.get("detail", "")
            error = str(detail)[:200] if detail else str(response_data)[:200]
            data_summary = f"ERROR: {error[:80]}"
    except json.JSONDecodeError:
        data_summary = f"Non-JSON: {body_text[:100]}"
        error = "Non-JSON response"

    return {
        "id": endpoint["id"],
        "method": method,
        "path": endpoint["path"],
        "page": endpoint["page"],
        "http_code": http_code,
        "elapsed_s": round(curl_time, 2),
        "data_summary": data_summary,
        "error": error,
        "response_body": response_data,
    }


def classify_result(r: dict) -> str:
    """Classify result into a category."""
    code = r["http_code"]
    if code == 200:
        if r.get("response_body", {}).get("data") in (None, [], {}, 0):
            return "EMPTY"
        return "OK"
    elif code == 401:
        return "AUTH"
    elif code == 403:
        return "FORBIDDEN"
    elif code == 500:
        return "SERVER_ERROR"
    elif code == 0:
        return "TIMEOUT"
    else:
        return f"HTTP_{code}"


def main():
    token = get_token()

    print(f"\nTarget: {FD_URL}")
    print(f"Endpoints: {len(ENDPOINTS)}")
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 140)
    print(f"{'#':<4} {'Code':<6} {'Time':>6} {'Page':<15} {'Path':<50} {'Summary'}")
    print("-" * 140)

    results = []
    for ep in sorted(ENDPOINTS, key=lambda e: e["id"]):
        r = test_endpoint(token, ep)
        results.append(r)
        status_icon = "✓" if r["http_code"] == 200 else "✗"
        print(
            f"{r['id']:<4} {status_icon} {r['http_code']:<4} {r['elapsed_s']:>5.1f}s "
            f"{r['page']:<15} {r['path']:<50} {r['data_summary'][:60]}"
        )

    # Summary
    print("\n" + "=" * 140)
    categories = {}
    for r in results:
        cat = classify_result(r)
        categories.setdefault(cat, []).append(r)

    print("\nSUMMARY:")
    for cat, items in sorted(categories.items()):
        paths = [i["path"].split("?")[0] for i in items]
        print(f"  {cat}: {len(items)} endpoints — {', '.join(paths)}")

    # Save full results
    output = {
        "audit_timestamp": datetime.now(timezone.utc).isoformat(),
        "front_door_url": FD_URL,
        "total_endpoints": len(results),
        "summary": {cat: len(items) for cat, items in categories.items()},
        "results": results,
    }

    RESULTS_FILE.write_text(json.dumps(output, indent=2, default=str))
    print(f"\nFull results saved to: {RESULTS_FILE}")


if __name__ == "__main__":
    main()
