#!/usr/bin/env python3
"""Production readiness testing script for Wippestoolen API."""

import asyncio
import httpx
import time
import json
import random
import string
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8002"

class ProductionTester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.results = {}
        self.auth_tokens = []

    def generate_test_user_data(self) -> Dict[str, str]:
        """Generate random user data for testing."""
        username = ''.join(random.choices(string.ascii_lowercase, k=8))
        return {
            "email": f"{username}@loadtest.com",
            "username": username,
            "display_name": username,
            "password": "LoadTest123!",
            "full_name": f"Load Test {username.title()}",
            "location": "Test City",
            "phone": "+1234567890"
        }

    def test_health_endpoints(self) -> Dict[str, Any]:
        """Test basic health and availability."""
        logger.info("Testing health endpoints...")
        results = {}
        
        with httpx.Client(timeout=10.0) as client:
            # Root endpoint
            start = time.time()
            response = client.get(f"{self.base_url}/")
            results['root'] = {
                'status_code': response.status_code,
                'response_time': time.time() - start,
                'success': response.status_code == 200
            }
            
            # Health endpoint
            start = time.time()
            response = client.get(f"{self.base_url}/health")
            results['health'] = {
                'status_code': response.status_code,
                'response_time': time.time() - start,
                'success': response.status_code == 200
            }
            
            # OpenAPI docs
            start = time.time()
            response = client.get(f"{self.base_url}/docs")
            results['docs'] = {
                'status_code': response.status_code,
                'response_time': time.time() - start,
                'success': response.status_code == 200
            }
            
        return results

    def test_user_registration(self, num_users: int = 10) -> Dict[str, Any]:
        """Test user registration under load."""
        logger.info(f"Testing user registration with {num_users} concurrent users...")
        results = {
            'total_users': num_users,
            'successful_registrations': 0,
            'failed_registrations': 0,
            'errors': [],
            'response_times': [],
            'created_users': []
        }
        
        def register_user():
            user_data = self.generate_test_user_data()
            try:
                with httpx.Client(timeout=30.0) as client:
                    start = time.time()
                    response = client.post(f"{self.base_url}/api/v1/auth/register", json=user_data)
                    duration = time.time() - start
                    
                    results['response_times'].append(duration)
                    
                    if response.status_code == 201:
                        results['successful_registrations'] += 1
                        results['created_users'].append(user_data)
                        return True
                    else:
                        results['failed_registrations'] += 1
                        results['errors'].append({
                            'status_code': response.status_code,
                            'error': response.text,
                            'user_data': user_data
                        })
                        return False
            except Exception as e:
                results['failed_registrations'] += 1
                results['errors'].append(str(e))
                return False
        
        # Execute concurrent registrations
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(register_user) for _ in range(num_users)]
            for future in futures:
                future.result()
        
        if results['response_times']:
            results['avg_response_time'] = sum(results['response_times']) / len(results['response_times'])
            results['max_response_time'] = max(results['response_times'])
            results['min_response_time'] = min(results['response_times'])
        
        return results

    def test_authentication_flow(self, users: List[Dict[str, str]]) -> Dict[str, Any]:
        """Test login flow with registered users."""
        logger.info(f"Testing authentication flow with {len(users)} users...")
        results = {
            'total_attempts': len(users),
            'successful_logins': 0,
            'failed_logins': 0,
            'errors': [],
            'response_times': [],
            'tokens': []
        }
        
        def login_user(user_data):
            try:
                with httpx.Client(timeout=30.0) as client:
                    start = time.time()
                    response = client.post(
                        f"{self.base_url}/api/v1/auth/login",
                        data={
                            "username": user_data["email"],
                            "password": user_data["password"]
                        }
                    )
                    duration = time.time() - start
                    results['response_times'].append(duration)
                    
                    if response.status_code == 200:
                        token_data = response.json()
                        results['successful_logins'] += 1
                        results['tokens'].append(token_data['access_token'])
                        return token_data['access_token']
                    else:
                        results['failed_logins'] += 1
                        results['errors'].append({
                            'status_code': response.status_code,
                            'error': response.text,
                            'user': user_data['email']
                        })
                        return None
            except Exception as e:
                results['failed_logins'] += 1
                results['errors'].append(str(e))
                return None
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(login_user, user) for user in users]
            tokens = [future.result() for future in futures]
            
        self.auth_tokens = [token for token in tokens if token]
        
        if results['response_times']:
            results['avg_response_time'] = sum(results['response_times']) / len(results['response_times'])
            results['max_response_time'] = max(results['response_times'])
            results['min_response_time'] = min(results['response_times'])
        
        return results

    def test_authenticated_endpoints(self, num_requests: int = 50) -> Dict[str, Any]:
        """Test authenticated endpoints under load."""
        logger.info(f"Testing authenticated endpoints with {num_requests} requests...")
        
        if not self.auth_tokens:
            return {'error': 'No auth tokens available'}
            
        results = {
            'total_requests': num_requests,
            'successful_requests': 0,
            'failed_requests': 0,
            'errors': [],
            'response_times': [],
            'endpoints_tested': []
        }
        
        endpoints = [
            ('GET', '/api/v1/auth/me'),
            ('GET', '/api/v1/tools/categories'),
            ('GET', '/api/v1/tools/browse'),
        ]
        
        def make_request():
            token = random.choice(self.auth_tokens)
            endpoint_method, endpoint_path = random.choice(endpoints)
            
            try:
                with httpx.Client(timeout=30.0) as client:
                    headers = {"Authorization": f"Bearer {token}"}
                    start = time.time()
                    
                    if endpoint_method == 'GET':
                        response = client.get(f"{self.base_url}{endpoint_path}", headers=headers)
                    else:
                        response = client.request(endpoint_method, f"{self.base_url}{endpoint_path}", headers=headers)
                    
                    duration = time.time() - start
                    results['response_times'].append(duration)
                    results['endpoints_tested'].append(f"{endpoint_method} {endpoint_path}")
                    
                    if response.status_code in [200, 201]:
                        results['successful_requests'] += 1
                        return True
                    else:
                        results['failed_requests'] += 1
                        results['errors'].append({
                            'endpoint': f"{endpoint_method} {endpoint_path}",
                            'status_code': response.status_code,
                            'error': response.text[:200]  # Truncate long errors
                        })
                        return False
            except Exception as e:
                results['failed_requests'] += 1
                results['errors'].append(str(e))
                return False
        
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(make_request) for _ in range(num_requests)]
            for future in futures:
                future.result()
        
        if results['response_times']:
            results['avg_response_time'] = sum(results['response_times']) / len(results['response_times'])
            results['max_response_time'] = max(results['response_times'])
            results['min_response_time'] = min(results['response_times'])
        
        return results

    def test_database_connections(self, num_concurrent: int = 30) -> Dict[str, Any]:
        """Test database connection handling under load."""
        logger.info(f"Testing database connections with {num_concurrent} concurrent requests...")
        
        results = {
            'total_requests': num_concurrent,
            'successful_requests': 0,
            'failed_requests': 0,
            'errors': [],
            'response_times': [],
            'connection_errors': []
        }
        
        def make_db_request():
            try:
                with httpx.Client(timeout=30.0) as client:
                    start = time.time()
                    # Test endpoint that requires database access
                    response = client.get(f"{self.base_url}/api/v1/tools/categories")
                    duration = time.time() - start
                    results['response_times'].append(duration)
                    
                    if response.status_code == 200:
                        results['successful_requests'] += 1
                        return True
                    else:
                        results['failed_requests'] += 1
                        error_text = response.text.lower()
                        if 'connection' in error_text or 'pool' in error_text:
                            results['connection_errors'].append(response.text)
                        results['errors'].append({
                            'status_code': response.status_code,
                            'error': response.text[:200]
                        })
                        return False
            except Exception as e:
                results['failed_requests'] += 1
                error_str = str(e).lower()
                if 'connection' in error_str or 'pool' in error_str:
                    results['connection_errors'].append(str(e))
                results['errors'].append(str(e))
                return False
        
        with ThreadPoolExecutor(max_workers=num_concurrent) as executor:
            futures = [executor.submit(make_db_request) for _ in range(num_concurrent)]
            for future in futures:
                future.result()
        
        if results['response_times']:
            results['avg_response_time'] = sum(results['response_times']) / len(results['response_times'])
            results['max_response_time'] = max(results['response_times'])
            results['min_response_time'] = min(results['response_times'])
        
        return results

    def run_full_test_suite(self) -> Dict[str, Any]:
        """Run complete production readiness test suite."""
        logger.info("Starting production readiness test suite...")
        
        full_results = {
            'test_start_time': time.time(),
            'tests': {}
        }
        
        # Test 1: Health endpoints
        full_results['tests']['health_endpoints'] = self.test_health_endpoints()
        
        # Test 2: User registration load test
        registration_results = self.test_user_registration(num_users=15)
        full_results['tests']['user_registration'] = registration_results
        
        # Test 3: Authentication flow
        if registration_results['created_users']:
            auth_results = self.test_authentication_flow(registration_results['created_users'][:10])
            full_results['tests']['authentication'] = auth_results
            
            # Test 4: Authenticated endpoints under load
            if self.auth_tokens:
                full_results['tests']['authenticated_endpoints'] = self.test_authenticated_endpoints(num_requests=100)
        
        # Test 5: Database connection stress test
        full_results['tests']['database_connections'] = self.test_database_connections(num_concurrent=50)
        
        full_results['test_end_time'] = time.time()
        full_results['total_duration'] = full_results['test_end_time'] - full_results['test_start_time']
        
        return full_results

def main():
    tester = ProductionTester()
    results = tester.run_full_test_suite()
    
    print("\n" + "="*60)
    print("PRODUCTION READINESS TEST RESULTS")
    print("="*60)
    
    print(f"\nTotal Test Duration: {results['total_duration']:.2f} seconds")
    
    for test_name, test_results in results['tests'].items():
        print(f"\n--- {test_name.upper().replace('_', ' ')} ---")
        
        if 'success' in test_results:  # Health endpoints
            for endpoint, data in test_results.items():
                status = "✅ PASS" if data['success'] else "❌ FAIL"
                print(f"{endpoint}: {status} ({data['response_time']:.3f}s)")
        
        elif 'successful_registrations' in test_results:  # Registration
            total = test_results['total_users']
            success = test_results['successful_registrations']
            print(f"Registrations: {success}/{total} successful ({success/total*100:.1f}%)")
            if 'avg_response_time' in test_results:
                print(f"Avg Response Time: {test_results['avg_response_time']:.3f}s")
            if test_results['errors']:
                print(f"Errors: {len(test_results['errors'])}")
                
        elif 'successful_logins' in test_results:  # Authentication
            total = test_results['total_attempts']
            success = test_results['successful_logins']
            print(f"Logins: {success}/{total} successful ({success/total*100:.1f}%)")
            if 'avg_response_time' in test_results:
                print(f"Avg Response Time: {test_results['avg_response_time']:.3f}s")
        
        elif 'successful_requests' in test_results:  # General requests
            total = test_results['total_requests']
            success = test_results['successful_requests']
            print(f"Requests: {success}/{total} successful ({success/total*100:.1f}%)")
            if 'avg_response_time' in test_results:
                print(f"Avg Response Time: {test_results['avg_response_time']:.3f}s")
            if 'connection_errors' in test_results and test_results['connection_errors']:
                print(f"Connection Errors: {len(test_results['connection_errors'])}")
    
    # Overall assessment
    print(f"\n" + "="*60)
    print("OVERALL ASSESSMENT")
    print("="*60)
    
    issues = []
    
    # Check each test for issues
    for test_name, test_results in results['tests'].items():
        if 'errors' in test_results and test_results['errors']:
            issues.append(f"{test_name}: {len(test_results['errors'])} errors")
        
        if 'connection_errors' in test_results and test_results['connection_errors']:
            issues.append(f"{test_name}: {len(test_results['connection_errors'])} connection errors")
        
        if 'avg_response_time' in test_results and test_results['avg_response_time'] > 1.0:
            issues.append(f"{test_name}: slow response times (avg: {test_results['avg_response_time']:.3f}s)")
    
    if not issues:
        print("✅ PRODUCTION READY - No critical issues detected")
    else:
        print("⚠️  ATTENTION NEEDED - Issues detected:")
        for issue in issues:
            print(f"   - {issue}")
    
    # Save detailed results
    with open('production_test_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nDetailed results saved to: production_test_results.json")

if __name__ == "__main__":
    main()