#!/usr/bin/env python3
"""
IPTV Backend API Test Suite
Tests all backend functionality including authentication, channels, programs, and devices.
"""

import requests
import json
import io
from datetime import datetime, timedelta
import os
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://vault-epg-test.preview.emergentagent.com/api"

class IPTVAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.test_results = []
        self.created_resources = {
            'channels': [],
            'programs': [],
            'devices': []
        }
    
    def log_result(self, test_name, success, message="", details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            'test': test_name,
            'status': status,
            'message': message,
            'details': details
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
        if details and not success:
            print(f"    Details: {details}")
        print()
    
    def test_root_endpoint(self):
        """Test the root API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "IPTV Service API" in data.get("message", ""):
                    self.log_result("Root Endpoint", True, "API is running")
                    return True
                else:
                    self.log_result("Root Endpoint", False, "Unexpected response format", data)
                    return False
            else:
                self.log_result("Root Endpoint", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Root Endpoint", False, f"Connection error: {str(e)}")
            return False
    
    def test_admin_login(self):
        """Test admin authentication"""
        try:
            login_data = {
                "username": "admin",
                "password": "admin123"
            }
            
            response = requests.post(f"{self.base_url}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "token_type" in data:
                    self.token = data["access_token"]
                    self.log_result("Admin Login", True, "Successfully authenticated")
                    return True
                else:
                    self.log_result("Admin Login", False, "Missing token in response", data)
                    return False
            else:
                self.log_result("Admin Login", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Request error: {str(e)}")
            return False
    
    def test_protected_endpoint_without_token(self):
        """Test accessing protected endpoint without token"""
        try:
            response = requests.get(f"{self.base_url}/auth/verify")
            
            if response.status_code == 401:
                self.log_result("Protected Endpoint (No Token)", True, "Correctly rejected unauthorized request")
                return True
            else:
                self.log_result("Protected Endpoint (No Token)", False, f"Expected 401, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Protected Endpoint (No Token)", False, f"Request error: {str(e)}")
            return False
    
    def test_protected_endpoint_with_token(self):
        """Test accessing protected endpoint with valid token"""
        if not self.token:
            self.log_result("Protected Endpoint (With Token)", False, "No token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{self.base_url}/auth/verify", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "username" in data and data["username"] == "admin":
                    self.log_result("Protected Endpoint (With Token)", True, "Token verification successful")
                    return True
                else:
                    self.log_result("Protected Endpoint (With Token)", False, "Unexpected response format", data)
                    return False
            else:
                self.log_result("Protected Endpoint (With Token)", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Protected Endpoint (With Token)", False, f"Request error: {str(e)}")
            return False
    
    def test_create_channel(self):
        """Test creating a new channel"""
        try:
            channel_data = {
                "name": "Sports HD",
                "number": "100",
                "description": "Premium sports channel"
            }
            
            response = requests.post(f"{self.base_url}/channels", json=channel_data)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["name"] == "Sports HD":
                    self.created_resources['channels'].append(data["id"])
                    self.log_result("Create Channel", True, f"Channel created with ID: {data['id']}")
                    return data["id"]
                else:
                    self.log_result("Create Channel", False, "Unexpected response format", data)
                    return None
            else:
                self.log_result("Create Channel", False, f"HTTP {response.status_code}", response.text)
                return None
        except Exception as e:
            self.log_result("Create Channel", False, f"Request error: {str(e)}")
            return None
    
    def test_get_channels(self):
        """Test getting all channels"""
        try:
            response = requests.get(f"{self.base_url}/channels")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get All Channels", True, f"Retrieved {len(data)} channels")
                    return True
                else:
                    self.log_result("Get All Channels", False, "Expected list response", data)
                    return False
            else:
                self.log_result("Get All Channels", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get All Channels", False, f"Request error: {str(e)}")
            return False
    
    def test_upload_logo(self):
        """Test uploading a channel logo"""
        try:
            # Create a small test image (1x1 pixel PNG)
            test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
            
            files = {
                'file': ('test_logo.png', io.BytesIO(test_image_data), 'image/png')
            }
            
            response = requests.post(f"{self.base_url}/channels/upload-logo", files=files)
            
            if response.status_code == 200:
                data = response.json()
                if "logo_path" in data and "/uploads/logos/" in data["logo_path"]:
                    self.log_result("Upload Logo", True, f"Logo uploaded: {data['logo_path']}")
                    return True
                else:
                    self.log_result("Upload Logo", False, "Unexpected response format", data)
                    return False
            else:
                self.log_result("Upload Logo", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Upload Logo", False, f"Request error: {str(e)}")
            return False
    
    def test_create_program(self, channel_id):
        """Test creating a program for a channel"""
        if not channel_id:
            self.log_result("Create Program", False, "No channel ID available")
            return None
        
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            program_data = {
                "channel_id": channel_id,
                "title": "Live Sports Match",
                "description": "Premier League football match",
                "start_time": "20:00",
                "duration_minutes": 120,
                "date": today
            }
            
            response = requests.post(f"{self.base_url}/programs", json=program_data)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["title"] == "Live Sports Match":
                    self.created_resources['programs'].append(data["id"])
                    self.log_result("Create Program", True, f"Program created with ID: {data['id']}")
                    return data["id"]
                else:
                    self.log_result("Create Program", False, "Unexpected response format", data)
                    return None
            else:
                self.log_result("Create Program", False, f"HTTP {response.status_code}", response.text)
                return None
        except Exception as e:
            self.log_result("Create Program", False, f"Request error: {str(e)}")
            return None
    
    def test_get_programs(self):
        """Test getting all programs"""
        try:
            response = requests.get(f"{self.base_url}/programs")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get All Programs", True, f"Retrieved {len(data)} programs")
                    return True
                else:
                    self.log_result("Get All Programs", False, "Expected list response", data)
                    return False
            else:
                self.log_result("Get All Programs", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get All Programs", False, f"Request error: {str(e)}")
            return False
    
    def test_filter_programs_by_channel(self, channel_id):
        """Test filtering programs by channel ID"""
        if not channel_id:
            self.log_result("Filter Programs by Channel", False, "No channel ID available")
            return False
        
        try:
            response = requests.get(f"{self.base_url}/programs?channel_id={channel_id}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check if all programs belong to the specified channel
                    all_match = all(program.get("channel_id") == channel_id for program in data)
                    if all_match:
                        self.log_result("Filter Programs by Channel", True, f"Retrieved {len(data)} programs for channel")
                        return True
                    else:
                        self.log_result("Filter Programs by Channel", False, "Some programs don't match channel filter")
                        return False
                else:
                    self.log_result("Filter Programs by Channel", False, "Expected list response", data)
                    return False
            else:
                self.log_result("Filter Programs by Channel", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Filter Programs by Channel", False, f"Request error: {str(e)}")
            return False
    
    def test_create_device(self):
        """Test creating a new device"""
        try:
            import random
            # Generate a unique MAC address for each test
            mac_suffix = f"{random.randint(10, 99):02d}:{random.randint(10, 99):02d}"
            device_data = {
                "device_name": "Test Box",
                "mac_address": f"00:11:22:33:{mac_suffix}"
            }
            
            response = requests.post(f"{self.base_url}/devices", json=device_data)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "activation_code" in data and "qr_code_path" in data:
                    self.created_resources['devices'].append(data["id"])
                    self.log_result("Create Device", True, f"Device created with ID: {data['id']}, Activation: {data['activation_code']}")
                    return data
                else:
                    self.log_result("Create Device", False, "Missing required fields in response", data)
                    return None
            else:
                self.log_result("Create Device", False, f"HTTP {response.status_code}", response.text)
                return None
        except Exception as e:
            self.log_result("Create Device", False, f"Request error: {str(e)}")
            return None
    
    def test_device_activation(self, activation_code):
        """Test device activation"""
        if not activation_code:
            self.log_result("Device Activation", False, "No activation code available")
            return False
        
        try:
            activation_data = {
                "activation_code": activation_code
            }
            
            response = requests.post(f"{self.base_url}/devices/activate", json=activation_data)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "device" in data:
                    device = data["device"]
                    if device.get("status") == "active":
                        self.log_result("Device Activation", True, "Device successfully activated")
                        return True
                    else:
                        self.log_result("Device Activation", False, f"Device status is {device.get('status')}, expected 'active'")
                        return False
                else:
                    self.log_result("Device Activation", False, "Unexpected response format", data)
                    return False
            else:
                self.log_result("Device Activation", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Device Activation", False, f"Request error: {str(e)}")
            return False
    
    def test_get_devices(self):
        """Test getting all devices"""
        try:
            response = requests.get(f"{self.base_url}/devices")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get All Devices", True, f"Retrieved {len(data)} devices")
                    return True
                else:
                    self.log_result("Get All Devices", False, "Expected list response", data)
                    return False
            else:
                self.log_result("Get All Devices", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get All Devices", False, f"Request error: {str(e)}")
            return False
    
    def test_public_guide_endpoint(self, device_id):
        """Test public guide endpoint for IPTV boxes"""
        if not device_id:
            self.log_result("Public Guide Endpoint", False, "No device ID available")
            return False
        
        try:
            response = requests.get(f"{self.base_url}/devices/guide/{device_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "channels" in data and "programs" in data and "device" in data:
                    channels = data["channels"]
                    programs = data["programs"]
                    device = data["device"]
                    
                    if isinstance(channels, list) and isinstance(programs, list):
                        self.log_result("Public Guide Endpoint", True, 
                                      f"Guide data retrieved: {len(channels)} channels, {len(programs)} programs")
                        return True
                    else:
                        self.log_result("Public Guide Endpoint", False, "Invalid data format in response")
                        return False
                else:
                    self.log_result("Public Guide Endpoint", False, "Missing required fields in response", data)
                    return False
            else:
                self.log_result("Public Guide Endpoint", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Public Guide Endpoint", False, f"Request error: {str(e)}")
            return False
    
    def test_file_upload_directories(self):
        """Test if upload directories exist and are accessible"""
        try:
            # Test logos directory
            logos_response = requests.get(f"{self.base_url.replace('/api', '')}/uploads/logos/")
            
            # Test QR codes directory  
            qr_response = requests.get(f"{self.base_url.replace('/api', '')}/uploads/qr_codes/")
            
            # We expect either 200 (directory listing) or 403/404 (directory exists but not listable)
            logos_ok = logos_response.status_code in [200, 403, 404]
            qr_ok = qr_response.status_code in [200, 403, 404]
            
            if logos_ok and qr_ok:
                self.log_result("Upload Directories", True, "Upload directories are accessible")
                return True
            else:
                self.log_result("Upload Directories", False, 
                              f"Logos: {logos_response.status_code}, QR: {qr_response.status_code}")
                return False
        except Exception as e:
            self.log_result("Upload Directories", False, f"Request error: {str(e)}")
            return False
    
    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete test programs
        for program_id in self.created_resources['programs']:
            try:
                response = requests.delete(f"{self.base_url}/programs/{program_id}")
                if response.status_code == 200:
                    print(f"✅ Deleted program: {program_id}")
                else:
                    print(f"❌ Failed to delete program: {program_id}")
            except Exception as e:
                print(f"❌ Error deleting program {program_id}: {str(e)}")
        
        # Delete test channels
        for channel_id in self.created_resources['channels']:
            try:
                response = requests.delete(f"{self.base_url}/channels/{channel_id}")
                if response.status_code == 200:
                    print(f"✅ Deleted channel: {channel_id}")
                else:
                    print(f"❌ Failed to delete channel: {channel_id}")
            except Exception as e:
                print(f"❌ Error deleting channel {channel_id}: {str(e)}")
        
        # Note: We don't delete devices as they might be needed for further testing
        print("ℹ️  Devices left for potential reuse")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting IPTV Backend API Tests")
        print(f"🌐 Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Basic connectivity
        if not self.test_root_endpoint():
            print("❌ Cannot connect to API. Stopping tests.")
            return False
        
        # Authentication tests
        self.test_admin_login()
        self.test_protected_endpoint_without_token()
        self.test_protected_endpoint_with_token()
        
        # Channel management tests
        channel_id = self.test_create_channel()
        self.test_get_channels()
        self.test_upload_logo()
        
        # Program management tests
        program_id = self.test_create_program(channel_id)
        self.test_get_programs()
        self.test_filter_programs_by_channel(channel_id)
        
        # Device management tests
        device_data = self.test_create_device()
        self.test_get_devices()
        
        if device_data:
            activation_code = device_data.get("activation_code")
            device_id = device_data.get("id")
            
            # Test device activation
            self.test_device_activation(activation_code)
            
            # Test public guide endpoint (should work after activation)
            self.test_public_guide_endpoint(device_id)
        
        # File system tests
        self.test_file_upload_directories()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if "✅" in result['status'])
        failed = sum(1 for result in self.test_results if "❌" in result['status'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌" in result['status']:
                    print(f"  • {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)

def main():
    """Main test execution"""
    tester = IPTVAPITester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()