# Email Service and Invitation System Documentation

## Overview

The KPI Productivity application includes a comprehensive email service and invitation system that enables users to invite friends and team members via email. The system supports both friend invitations and team invitations with customizable templates and robust validation.

## Table of Contents

1. [Email Service Configuration](#email-service-configuration)
2. [SMTP Setup](#smtp-setup)
3. [Invitation System Workflows](#invitation-system-workflows)
4. [Email Templates](#email-templates)
5. [API Endpoints](#api-endpoints)
6. [Error Handling](#error-handling)
7. [Testing and Validation](#testing-and-validation)
8. [Troubleshooting](#troubleshooting)

## Email Service Configuration

### Environment Variables

The email service requires the following environment variables to be configured:

```bash
# Required SMTP Configuration
SMTP_HOST="smtp.gmail.com"              # SMTP server hostname
SMTP_PORT=587                           # SMTP port (587 for TLS, 465 for SSL)
SMTP_SECURE=false                       # Use SSL (true for port 465)
SMTP_USER="your-email@gmail.com"        # SMTP username/email
SMTP_PASS="your-app-password"           # SMTP password or app password
SMTP_FROM="noreply@kpi-productivity.com" # From address for emails

# Application Configuration
APP_NAME="KPI Productivity"             # Application name for email templates
FRONTEND_URL="http://localhost:3000"    # Frontend URL for invitation links
```

### SMTP Provider Examples

#### Gmail Configuration
```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-gmail@gmail.com"
SMTP_PASS="your-16-character-app-password"
```

**Note**: For Gmail, you must use an App Password instead of your regular password. Enable 2FA and generate an App Password in your Google Account settings.

#### Outlook/Hotmail Configuration
```bash
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@outlook.com"
SMTP_PASS="your-password"
```

#### Custom SMTP Server
```bash
SMTP_HOST="mail.yourdomain.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="noreply@yourdomain.com"
SMTP_PASS="your-smtp-password"
```

### Service Initialization

The email service automatically initializes when the application starts:

```typescript
import { emailService } from '../services/emailService';

// Check if email service is configured
if (emailService.isReady()) {
  console.log('Email service is ready');
} else {
  console.log('Email service not configured');
}

// Test connection (optional)
const connectionTest = await emailService.testConnection();
if (connectionTest) {
  console.log('SMTP connection successful');
} else {
  console.log('SMTP connection failed');
}
```

## SMTP Setup

### Gmail Setup Guide

1. **Enable 2-Factor Authentication**
   - Go to Google Account settings
   - Security → 2-Step Verification
   - Enable 2FA

2. **Generate App Password**
   - Go to Google Account settings
   - Security → App passwords
   - Select "Mail" and generate password
   - Use the 16-character password in `SMTP_PASS`

3. **Configure Environment**
   ```bash
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER="your-gmail@gmail.com"
   SMTP_PASS="abcd efgh ijkl mnop"  # 16-character app password
   ```

### Testing SMTP Configuration

Use the built-in test endpoint to verify your SMTP configuration:

```bash
# Test SMTP connection
curl -X POST http://localhost:3001/api/email/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Email service connection test successful",
  "configured": true
}
```

## Invitation System Workflows

### Friend Invitation Workflow

1. **Create Invitation**
   - User sends friend invitation with email address
   - System generates unique invite code
   - Email is sent to recipient (if SMTP configured)
   - Invitation expires after 7 days

2. **Accept Invitation**
   - Recipient clicks email link or enters invite code
   - System validates code and creates friendship
   - Both users become friends in the system

3. **Invitation States**
   - `pending`: Invitation sent, awaiting response
   - `accepted`: Invitation accepted, friendship created
   - `expired`: Invitation expired or cancelled

### Team Invitation Workflow

1. **Create Team Invitation**
   - Team leader/deputy sends invitation
   - System validates team capacity
   - Unique invite code generated
   - Email sent to recipient

2. **Accept Team Invitation**
   - Recipient validates invite code
   - System checks team capacity again
   - User added as team member
   - Team analytics updated

3. **Permission Validation**
   - Only team leaders and deputies can send invitations
   - Team capacity limits are enforced
   - Existing members cannot be re-invited

## Email Templates

### Friend Invitation Template

The system generates rich HTML emails with the following features:

- **Responsive design** for mobile and desktop
- **Branded header** with application logo
- **Personal message** from sender (optional)
- **Prominent call-to-action** button
- **Invite code** for manual entry
- **Feature highlights** of the application

#### Template Customization

To customize friend invitation templates, modify the `generateFriendInviteTemplate` method in `emailService.ts`:

```typescript
private generateFriendInviteTemplate(data: FriendInviteEmailData): EmailTemplate {
  const { senderName, senderEmail, inviteCode, message, appUrl } = data;
  
  // Customize subject line
  const subject = `${senderName} invites you to KPI Productivity!`;
  
  // Customize HTML template
  const html = `
    <!-- Your custom HTML template -->
    <div style="font-family: Arial, sans-serif;">
      <h1>Welcome to KPI Productivity!</h1>
      <p>${senderName} has invited you to join.</p>
      <!-- Add your custom styling and content -->
    </div>
  `;
  
  return { subject, text, html };
}
```

### Team Invitation Template

Team invitations include:

- **Team information** (name, leader)
- **Team-specific branding** (green color scheme)
- **Team benefits** and features
- **Join team call-to-action**

#### Template Variables

Both templates support the following variables:

```typescript
// Friend Invitation Variables
interface FriendInviteEmailData {
  senderName: string;      // Name of person sending invite
  senderEmail: string;     // Email of sender
  inviteCode: string;      // Unique invitation code
  message?: string;        // Optional personal message
  appUrl: string;          // Frontend application URL
}

// Team Invitation Variables
interface TeamInviteEmailData {
  senderName: string;      // Name of team leader/deputy
  teamName: string;        // Name of the team
  inviteCode: string;      // Unique team invitation code
  message?: string;        // Optional invitation message
  appUrl: string;          // Frontend application URL
}
```

## API Endpoints

### Friend Invitations

#### Send Friend Invitation
```http
POST /api/friends/invite
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "email": "friend@example.com",
  "message": "Join me on KPI Productivity!"
}
```

Response:
```json
{
  "success": true,
  "message": "Friend invitation created successfully",
  "data": {
    "inviteCode": "FRIEND-ABC123",
    "expiresAt": "2026-01-17T10:00:00.000Z",
    "emailSent": true
  }
}
```

#### Validate Friend Invite Code
```http
GET /api/friends/invite/validate/FRIEND-ABC123
```

Response:
```json
{
  "isValid": true,
  "invite": {
    "id": "invite-id",
    "senderName": "John Doe",
    "senderEmail": "john@example.com",
    "message": "Join me on KPI Productivity!",
    "expiresAt": "2026-01-17T10:00:00.000Z"
  }
}
```

#### Accept Friend Invitation
```http
POST /api/friends/invite/accept
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "inviteCode": "FRIEND-ABC123"
}
```

### Team Invitations

#### Send Team Invitation
```http
POST /api/teams/:teamId/invite
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "email": "member@example.com",
  "message": "Join our productivity team!"
}
```

#### Accept Team Invitation
```http
POST /api/teams/invite/accept
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "inviteCode": "TEAM-XYZ789"
}
```

### Email Service Endpoints

#### Test Email Configuration
```http
POST /api/email/test
Authorization: Bearer JWT_TOKEN
```

#### Get Email Service Status
```http
GET /api/email/status
Authorization: Bearer JWT_TOKEN
```

Response:
```json
{
  "configured": true,
  "ready": true,
  "provider": "Gmail",
  "from": "noreply@kpi-productivity.com"
}
```

## Error Handling

### Common Email Errors

#### SMTP Configuration Errors
```json
{
  "success": false,
  "error": "Email service not configured",
  "details": "Missing required environment variables: SMTP_HOST, SMTP_USER, SMTP_PASS"
}
```

#### Authentication Errors
```json
{
  "success": false,
  "error": "SMTP authentication failed",
  "details": "Invalid username or password"
}
```

#### Network Errors
```json
{
  "success": false,
  "error": "SMTP connection failed",
  "details": "Connection timeout or network error"
}
```

### Invitation Errors

#### Invalid Invite Code
```json
{
  "success": false,
  "error": "Invalid invite code",
  "message": "Invite code not found or has expired"
}
```

#### Team Capacity Exceeded
```json
{
  "success": false,
  "error": "Team at capacity",
  "message": "Team has reached maximum member limit"
}
```

#### Permission Denied
```json
{
  "success": false,
  "error": "Permission denied",
  "message": "Only team leaders and deputies can send invitations"
}
```

## Testing and Validation

### Unit Tests

Test email service functionality:

```typescript
import { emailService } from '../services/emailService';

describe('Email Service', () => {
  test('should initialize with valid configuration', () => {
    expect(emailService.isReady()).toBe(true);
  });

  test('should send friend invitation email', async () => {
    const result = await emailService.sendFriendInvitation(
      'test@example.com',
      {
        senderName: 'Test User',
        senderEmail: 'sender@example.com',
        inviteCode: 'TEST-123',
        appUrl: 'http://localhost:3000'
      }
    );
    expect(result).toBe(true);
  });
});
```

### Integration Tests

Test complete invitation workflows:

```typescript
describe('Invitation Workflows', () => {
  test('complete friend invitation flow', async () => {
    // 1. Send invitation
    const invite = await InvitationService.createFriendInvite({
      senderId: 'user1',
      email: 'friend@example.com'
    });
    expect(invite.success).toBe(true);

    // 2. Validate invitation
    const validation = await InvitationService.validateFriendInvite(
      invite.data.inviteCode
    );
    expect(validation.isValid).toBe(true);

    // 3. Accept invitation
    const acceptance = await InvitationService.processFriendInviteAcceptance(
      invite.data.inviteCode,
      'user2'
    );
    expect(acceptance.success).toBe(true);
  });
});
```

### Manual Testing

#### Test Email Delivery

1. **Configure SMTP** with valid credentials
2. **Send test invitation** using API or UI
3. **Check recipient inbox** for email delivery
4. **Verify email formatting** and links
5. **Test invitation acceptance** flow

#### Test Different Email Providers

Test with multiple email providers:
- Gmail
- Outlook/Hotmail
- Yahoo Mail
- Custom domain emails

## Troubleshooting

### Email Not Sending

1. **Check Configuration**
   ```bash
   # Verify environment variables are set
   echo $SMTP_HOST
   echo $SMTP_USER
   echo $SMTP_PASS
   ```

2. **Test SMTP Connection**
   ```bash
   curl -X POST http://localhost:3001/api/email/test
   ```

3. **Check Application Logs**
   ```bash
   # Look for email service errors
   grep -i "email" logs/application.log
   ```

### Gmail App Password Issues

1. **Verify 2FA is enabled** on Google account
2. **Generate new App Password** if existing one fails
3. **Use 16-character password** without spaces
4. **Check account security settings** for blocked sign-ins

### Invitation Code Issues

1. **Check code format** (should match pattern)
2. **Verify expiration date** (7 days from creation)
3. **Check invitation status** (should be 'pending')
4. **Validate user permissions** for team invitations

### Common Solutions

#### "Email service not configured"
- Ensure all required SMTP environment variables are set
- Restart application after configuration changes

#### "SMTP authentication failed"
- Verify SMTP credentials are correct
- For Gmail, use App Password instead of regular password
- Check if account has 2FA enabled

#### "Connection timeout"
- Verify SMTP host and port are correct
- Check firewall settings
- Test network connectivity to SMTP server

#### "Invite code expired"
- Invitation codes expire after 7 days
- Generate new invitation for expired codes
- Clean up expired invitations regularly

### Monitoring and Logging

The system logs all email operations:

```typescript
// Email send logging
console.log(`Email sent - Type: ${type}, To: ${recipient}, From: ${sender}, Time: ${new Date().toISOString()}`);

// Error logging
console.error('Failed to send email:', error);

// Connection test logging
console.log('Email service connection test successful');
```

Monitor email delivery rates and errors to ensure system reliability.

## Security Considerations

1. **SMTP Credentials**: Store securely in environment variables
2. **Email Validation**: Validate email addresses before sending
3. **Rate Limiting**: Implement limits on invitation sending
4. **Invite Code Security**: Use cryptographically secure random codes
5. **Expiration**: Automatically expire old invitation codes
6. **Permission Checks**: Validate user permissions before sending invitations

## Best Practices

1. **Graceful Degradation**: System works without email configuration
2. **Error Handling**: Comprehensive error handling and logging
3. **Template Consistency**: Maintain consistent branding across templates
4. **Mobile Optimization**: Ensure emails render well on mobile devices
5. **Accessibility**: Use proper HTML structure and alt text
6. **Testing**: Regular testing of email delivery and formatting
7. **Monitoring**: Track email delivery success rates
8. **Cleanup**: Regular cleanup of expired invitations