import subprocess
import importlib.util
import sys
from pathlib import Path

def check_system_requirements():
    """
    Check if all required packages and system requirements are installed
    Returns dict with status of each requirement
    """
    requirements = {
        "python_version": {
            "required": "3.11+",
            "status": False,
            "message": ""
        },
        "fastapi": {
            "required": "0.110.1+",
            "status": False,
            "message": ""
        },
        "mongodb": {
            "required": "Running",
            "status": False,
            "message": ""
        },
        "nodejs": {
            "required": "18+",
            "status": False,
            "message": ""
        },
        "yarn": {
            "required": "1.22+",
            "status": False,
            "message": ""
        },
        "disk_space": {
            "required": "5GB+",
            "status": False,
            "message": ""
        }
    }
    
    # Check Python version
    python_version = f"{sys.version_info.major}.{sys.version_info.minor}"
    if sys.version_info >= (3, 11):
        requirements["python_version"]["status"] = True
        requirements["python_version"]["message"] = f"Python {python_version} installed"
    else:
        requirements["python_version"]["message"] = f"Python {python_version} - Need 3.11+"
    
    # Check FastAPI
    try:
        import fastapi
        requirements["fastapi"]["status"] = True
        requirements["fastapi"]["message"] = f"FastAPI {fastapi.__version__} installed"
    except ImportError:
        requirements["fastapi"]["message"] = "FastAPI not installed"
    
    # Check MongoDB connection
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        import os
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        # Simple connection check (synchronous for verification)
        import pymongo
        client = pymongo.MongoClient(mongo_url, serverSelectionTimeoutMS=2000)
        client.server_info()
        requirements["mongodb"]["status"] = True
        requirements["mongodb"]["message"] = "MongoDB connected"
        client.close()
    except Exception as e:
        requirements["mongodb"]["message"] = f"MongoDB not accessible: {str(e)[:50]}"
    
    # Check Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            version = result.stdout.strip()
            requirements["nodejs"]["status"] = True
            requirements["nodejs"]["message"] = f"Node.js {version} installed"
        else:
            requirements["nodejs"]["message"] = "Node.js not found"
    except Exception as e:
        requirements["nodejs"]["message"] = "Node.js not found"
    
    # Check Yarn
    try:
        result = subprocess.run(['yarn', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            version = result.stdout.strip()
            requirements["yarn"]["status"] = True
            requirements["yarn"]["message"] = f"Yarn {version} installed"
        else:
            requirements["yarn"]["message"] = "Yarn not found"
    except Exception as e:
        requirements["yarn"]["message"] = "Yarn not found"
    
    # Check disk space
    try:
        import shutil
        stat = shutil.disk_usage("/")
        free_gb = stat.free / (1024**3)
        if free_gb >= 5:
            requirements["disk_space"]["status"] = True
            requirements["disk_space"]["message"] = f"{free_gb:.1f}GB free"
        else:
            requirements["disk_space"]["message"] = f"{free_gb:.1f}GB free - Need 5GB+"
    except Exception as e:
        requirements["disk_space"]["message"] = "Could not check disk space"
    
    return requirements

def get_setup_status():
    """
    Check overall setup completion status
    """
    all_checks = check_system_requirements()
    all_passed = all(check["status"] for check in all_checks.values())
    
    return {
        "all_requirements_met": all_passed,
        "checks": all_checks,
        "total": len(all_checks),
        "passed": sum(1 for check in all_checks.values() if check["status"])
    }
