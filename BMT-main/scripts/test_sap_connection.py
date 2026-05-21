"""
SAP Service Layer Connection Test Utility
==========================================
Standalone script to test SAP Business One Service Layer connectivity.
Run this script to diagnose connection issues before starting the middleware.
"""

import sys
import socket
import ssl
import httpx
import asyncio
from datetime import datetime
from pathlib import Path

# Add parent directory to path to import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings


def test_dns_resolution():
    """Test DNS resolution of SAP host."""
    print("\n" + "="*60)
    print("1. DNS Resolution Test")
    print("="*60)
    
    try:
        ip = socket.gethostbyname(settings.SAP_HOST)
        print(f"✅ DNS Resolution: {settings.SAP_HOST} → {ip}")
        return True, ip
    except socket.gaierror as e:
        print(f"❌ DNS Resolution Failed: {e}")
        return False, None


def test_tcp_connectivity(host, port):
    """Test TCP connectivity to SAP Service Layer port."""
    print("\n" + "="*60)
    print("2. TCP Connectivity Test")
    print("="*60)
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    
    try:
        result = sock.connect_ex((host, port))
        if result == 0:
            print(f"✅ TCP Connection: {host}:{port} - SUCCESS")
            return True
        else:
            print(f"❌ TCP Connection: {host}:{port} - FAILED (Error code: {result})")
            return False
    except socket.timeout:
        print(f"❌ TCP Connection: {host}:{port} - TIMEOUT")
        return False
    except Exception as e:
        print(f"❌ TCP Connection: {host}:{port} - ERROR: {e}")
        return False
    finally:
        sock.close()


def test_ssl_handshake(host, port):
    """Test SSL/TLS handshake with SAP Service Layer."""
    print("\n" + "="*60)
    print("3. SSL/TLS Handshake Test")
    print("="*60)
    
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE  # Allow self-signed certificates
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    
    try:
        ssl_sock = context.wrap_socket(sock, server_hostname=host)
        ssl_sock.connect((host, port))
        
        cert = ssl_sock.getpeercert()
        print(f"✅ SSL Handshake: {host}:{port} - SUCCESS")
        print(f"   Certificate Subject: {dict(x[0] for x in cert.get('subject', []))}")
        print(f"   Certificate Issuer: {dict(x[0] for x in cert.get('issuer', []))}")
        print(f"   Certificate Valid Until: {cert.get('notAfter', 'N/A')}")
        
        ssl_sock.close()
        return True
    except ssl.SSLError as e:
        print(f"❌ SSL Handshake: {host}:{port} - SSL ERROR: {e}")
        return False
    except socket.timeout:
        print(f"❌ SSL Handshake: {host}:{port} - TIMEOUT")
        return False
    except Exception as e:
        print(f"❌ SSL Handshake: {host}:{port} - ERROR: {e}")
        return False
    finally:
        try:
            sock.close()
        except:
            pass


async def test_http_login():
    """Test HTTP login request to SAP Service Layer."""
    print("\n" + "="*60)
    print("4. HTTP Login Request Test")
    print("="*60)
    
    base_url = f"https://{settings.SAP_HOST}:{settings.SAP_PORT}/b1s/v1"
    login_url = f"{base_url}/Login"
    
    print(f"Target URL: {login_url}")
    print(f"Company DB: {settings.SAP_COMPANY}")
    print(f"User: {settings.SAP_USER}")
    
    payload = {
        "CompanyDB": settings.SAP_COMPANY,
        "UserName": settings.SAP_USER,
        "Password": settings.SAP_PASSWORD,
    }
    
    try:
        async with httpx.AsyncClient(verify=False, timeout=30) as client:
            print("\nSending login request...")
            response = await client.post(login_url, json=payload)
            
            print(f"HTTP Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Login SUCCESS")
                print(f"   SessionId: {data.get('SessionId', 'N/A')}")
                print(f"   Version: {data.get('Version', 'N/A')}")
                
                # Check for B1SESSION cookie
                raw_cookie = response.headers.get("Set-Cookie", "")
                if "B1SESSION" in raw_cookie:
                    print(f"   B1SESSION Cookie: Present ✓")
                else:
                    print(f"   B1SESSION Cookie: Missing ✗")
                
                return True, data
            else:
                print(f"❌ Login FAILED")
                print(f"   Response: {response.text}")
                return False, None
                
    except httpx.ConnectError as e:
        print(f"❌ Connection Failed: {e}")
        print(f"   This usually means the port is blocked or firewall is preventing access")
        return False, None
    except httpx.TimeoutException as e:
        print(f"❌ Request Timeout: {e}")
        return False, None
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False, None


async def test_api_endpoint():
    """Test basic API endpoint access after login."""
    print("\n" + "="*60)
    print("5. API Endpoint Access Test")
    print("="*60)
    
    base_url = f"https://{settings.SAP_HOST}:{settings.SAP_PORT}/b1s/v1"
    
    # First login
    login_url = f"{base_url}/Login"
    payload = {
        "CompanyDB": settings.SAP_COMPANY,
        "UserName": settings.SAP_USER,
        "Password": settings.SAP_PASSWORD,
    }
    
    try:
        async with httpx.AsyncClient(verify=False, timeout=30) as client:
            # Login
            login_response = await client.post(login_url, json=payload)
            
            if login_response.status_code != 200:
                print(f"❌ Cannot test API endpoints - Login failed")
                return False
            
            # Get session cookie
            raw_cookie = login_response.headers.get("Set-Cookie", "")
            b1session = None
            for part in raw_cookie.split(";"):
                part = part.strip()
                if part.startswith("B1SESSION="):
                    b1session = part.split("=", 1)[1]
                    break
            
            if not b1session:
                print(f"❌ Cannot test API endpoints - No session cookie")
                return False
            
            # Test a simple endpoint
            print(f"\nTesting endpoint: {base_url}/ProductionOrders")
            api_response = await client.get(
                f"{base_url}/ProductionOrders",
                headers={"Cookie": f"B1SESSION={b1session}"}
            )
            
            print(f"HTTP Status Code: {api_response.status_code}")
            if api_response.status_code == 200:
                data = api_response.json()
                print(f"✅ API Access SUCCESS")
                print(f"   Total Production Orders: {data.get('odata.metadata', {}).get('count', 'N/A')}")
                return True
            else:
                print(f"❌ API Access FAILED")
                print(f"   Response: {api_response.text}")
                return False
                
    except Exception as e:
        print(f"❌ API Test Error: {e}")
        return False


async def run_all_tests():
    """Run all connection tests."""
    print("\n" + "="*60)
    print("SAP Service Layer Connection Test")
    print("="*60)
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"SAP Host: {settings.SAP_HOST}")
    print(f"SAP Port: {settings.SAP_PORT}")
    print(f"Company DB: {settings.SAP_COMPANY}")
    print(f"User: {settings.SAP_USER}")
    
    results = {}
    
    # Test 1: DNS Resolution
    dns_ok, ip = test_dns_resolution()
    results['dns'] = dns_ok
    
    if not dns_ok:
        print("\n❌ DNS resolution failed. Cannot proceed with further tests.")
        return results
    
    # Test 2: TCP Connectivity
    tcp_ok = test_tcp_connectivity(settings.SAP_HOST, settings.SAP_PORT)
    results['tcp'] = tcp_ok
    
    if not tcp_ok:
        print("\n❌ TCP connectivity failed. Port 50000 is blocked or SAP Service Layer is not running.")
        print("\n📋 RECOMMENDATIONS:")
        print("   1. Ensure SAP Service Layer is running on the SAP server")
        print("   2. Check firewall rules on the SAP server")
        print("   3. Check network routing between this machine and SAP server")
        print("   4. Consider deploying the middleware ON the SAP server network")
        print("   5. For local development, use mock mode (API-only mode)")
        return results
    
    # Test 3: SSL Handshake
    ssl_ok = test_ssl_handshake(settings.SAP_HOST, settings.SAP_PORT)
    results['ssl'] = ssl_ok
    
    if not ssl_ok:
        print("\n❌ SSL handshake failed. Check SSL certificate configuration.")
        return results
    
    # Test 4: HTTP Login
    login_ok, login_data = await test_http_login()
    results['login'] = login_ok
    
    if not login_ok:
        print("\n❌ HTTP login failed. Check credentials and Service Layer configuration.")
        return results
    
    # Test 5: API Endpoint
    api_ok = await test_api_endpoint()
    results['api'] = api_ok
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"DNS Resolution:   {'✅ PASS' if results.get('dns') else '❌ FAIL'}")
    print(f"TCP Connectivity: {'✅ PASS' if results.get('tcp') else '❌ FAIL'}")
    print(f"SSL Handshake:    {'✅ PASS' if results.get('ssl') else '❌ FAIL'}")
    print(f"HTTP Login:       {'✅ PASS' if results.get('login') else '❌ FAIL'}")
    print(f"API Access:       {'✅ PASS' if results.get('api') else '❌ FAIL'}")
    
    if all(results.values()):
        print("\n✅ ALL TESTS PASSED - SAP Service Layer is accessible and working correctly")
    else:
        print("\n❌ SOME TESTS FAILED - Review the failed tests above")
    
    return results


if __name__ == "__main__":
    try:
        asyncio.run(run_all_tests())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
