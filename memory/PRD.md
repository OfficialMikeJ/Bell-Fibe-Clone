# TV Service System - Product Requirements Document

## Features Overview

### Core System Features

#### **User Management**
- Create customer accounts
- Set device limits per user
- Manage account status (active, trial, suspended, cancelled)
- View user devices
- Edit user details
- **Note**: Account status is for management only - no payment processing integrated

#### **Device Management**
- Generate activation QR codes
- Refresh QR codes (same activation code)
- Reset activation codes (new code + QR)
- Geo-location validation (Canada only)
- IP tracking and history
- MAC address binding

#### **Channel & EPG Management**
- Channel creation with logo upload
- EPG program scheduling (7-day, 30-min intervals)
- Bulk channel operations
- Program guide display

#### **Authentication & Security**
- Admin authentication with JWT
- Two-factor authentication (2FA) support
- Security question-based password reset
- Session management
- Role-based access control

#### **Setup & Configuration**
- Initial setup wizard (5 steps)
- Service name configuration
- System requirements validation
- Bulk channel creation during setup
- Admin account creation with security questions

## Technical Requirements

### Backend API
- FastAPI framework
- MongoDB database
- JWT authentication
- RESTful API design
- Comprehensive error handling

### Frontend
- React.js with modern hooks
- Responsive design
- Real-time updates
- Interactive setup wizard
- Admin dashboard interface

### Security
- HTTPS enforcement
- Input validation
- SQL injection prevention
- XSS protection
- Rate limiting

## Deployment Requirements

### System Requirements
- Python 3.11+
- Node.js 18+
- MongoDB 5.0+
- Supervisor for process management

### Production Considerations
- SSL/TLS certificates
- Reverse proxy configuration
- Database authentication
- Backup strategies
- Monitoring and logging