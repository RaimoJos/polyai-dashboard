#!/usr/bin/env python3
"""
Pre-Launch Backend Health Check
Run this to verify all critical endpoints are working.

Usage:
    python verify_launch.py [--backend http://localhost:5000]
"""

import sys
import json
import argparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

def check_endpoint(base_url: str, path: str, method: str = "GET", 
                   data: dict = None, headers: dict = None) -> tuple[bool, str]:
    """Check if an endpoint is responding."""
    url = f"{base_url}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    
    try:
        body = json.dumps(data).encode() if data else None
        req = Request(url, data=body, headers=req_headers, method=method)
        with urlopen(req, timeout=10) as resp:
            return True, f"OK ({resp.status})"
    except HTTPError as e:
        if e.code in [401, 403]:
            return True, f"Protected ({e.code})"  # Auth required is fine
        return False, f"HTTP {e.code}: {e.reason}"
    except URLError as e:
        return False, f"Connection failed: {e.reason}"
    except Exception as e:
        return False, str(e)

def main():
    parser = argparse.ArgumentParser(description="Pre-launch health check")
    parser.add_argument("--backend", default="http://localhost:5000", 
                       help="Backend URL")
    args = parser.parse_args()
    
    base = args.backend.rstrip("/")
    
    print(f"\n🔍 Checking backend at: {base}\n")
    print("=" * 60)
    
    # Critical endpoints to check
    endpoints = [
        # Core
        ("GET", "/health", "Core Health"),
        ("GET", "/api/v1/system/status", "System Status"),
        
        # Auth
        ("POST", "/api/v1/users/login", "Login Endpoint"),
        ("GET", "/api/v1/users/me", "Current User"),
        
        # Printers
        ("GET", "/api/v1/printers", "List Printers"),
        ("GET", "/api/v1/printers/types", "Printer Types"),
        
        # Business
        ("GET", "/api/v1/business/clients", "Clients"),
        ("GET", "/api/v1/business/orders", "Orders"),
        ("GET", "/api/v1/business/quotes/pricing-config", "Pricing Config"),
        
        # Production
        ("GET", "/api/v1/scheduling/queue", "Job Queue"),
        ("GET", "/api/v1/production/history", "Print History"),
        
        # Materials
        ("GET", "/api/v1/materials/spools", "Material Inventory"),
        ("GET", "/api/v1/materials/profiles", "Material Profiles"),
        
        # Config
        ("GET", "/api/v1/config", "App Config"),
        
        # Analytics
        ("GET", "/api/v1/analytics/energy", "Energy Stats"),
        ("GET", "/api/v1/cost/summary", "Cost Summary"),
        
        # Reports
        ("GET", "/api/v1/reports/types", "Report Types"),
        
        # Maintenance
        ("GET", "/api/v1/maintenance", "Maintenance Schedule"),
        
        # Chat
        ("GET", "/api/v1/chat/history?channel=general&limit=1", "Chat History"),
    ]
    
    passed = 0
    failed = 0
    protected = 0
    
    for method, path, name in endpoints:
        ok, status = check_endpoint(base, path, method)
        
        if ok:
            if "Protected" in status:
                icon = "🔒"
                protected += 1
            else:
                icon = "✅"
                passed += 1
        else:
            icon = "❌"
            failed += 1
        
        print(f"{icon} {name:<25} {method:>5} {path:<45} {status}")
    
    print("=" * 60)
    print(f"\n📊 Results: {passed} passed, {protected} protected, {failed} failed")
    
    if failed == 0:
        print("\n✅ Backend is ready for launch!")
        return 0
    else:
        print(f"\n⚠️  {failed} endpoint(s) have issues. Check logs.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
