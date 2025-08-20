# Email Automation Features - AutoTask AI

## Overview

The Email Automation module provides comprehensive email scheduling, follow-up automation, and AI-powered personalization features for your AutoTask AI application.

## Features

### 1. Email Scheduling
- **Compose emails** with rich text editor
- **Schedule delivery** for specific date and time
- **Recurring schedules** (daily, weekly, monthly, custom)
- **Multiple recipients** with CC/BCC support
- **File attachments** (coming soon)

### 2. Automatic Follow-Up & Auto-Reply
- **Smart follow-ups** if no reply received within specified days
- **AI-generated responses** for incoming emails
- **Customizable follow-up messages**
- **Automatic reply templates**

### 3. Smart Personalization
- **Variable substitution** ({{recipientName}}, {{company}})
- **Custom variables** for dynamic content
- **AI-powered content generation**
- **Context-aware personalization**

### 4. Advanced Scheduling Options
- **One-time or recurring** schedules
- **Custom recurrence patterns**
- **Time zone support**
- **Cancel/reschedule** before sending

## User Flow

### Creating a Scheduled Email

1. **Navigate to Email Automation tab** in the dashboard
2. **Compose your email**:
   - Enter subject and body
   - Add recipients (single or multiple)
   - Set CC/BCC if needed
3. **Configure scheduling**:
   - Pick date and time
   - Choose recurrence pattern
   - Set timezone
4. **Set up automation**:
   - Enable follow-up reminders
   - Configure auto-replies
   - Set personalization variables
5. **Preview and schedule**:
   - Review email content
   - Confirm automation settings
   - Schedule for delivery

### Follow-Up Automation

1. **Enable follow-up** when creating email
2. **Set wait period** (e.g., 3 days)
3. **Write follow-up message** or use AI generation
4. **System automatically sends** if no reply received

### Auto-Reply Setup

1. **Enable auto-reply** for incoming emails
2. **Write custom message** or use AI generation
3. **System responds automatically** to received emails

## API Endpoints

### Base URL
```
http://localhost:5000/api/email-automation
```

### Endpoints

#### Schedule Email
```http
POST /schedule
Content-Type: application/json
Authorization: Bearer <token>

{
  "subject": "Meeting Reminder",
  "body": "Hi {{recipientName}}, reminder for our meeting...",
  "recipients": ["user@example.com"],
  "scheduledTime": "2024-01-20T09:00:00Z",
  "followUpEnabled": true,
  "followUpDays": 3,
  "followUpMessage": "Just checking in...",
  "autoReplyEnabled": true,
  "autoReplyMessage": "Thanks for your email...",
  "personalizationEnabled": true,
  "variables": {
    "recipientName": true,
    "company": true,
    "customFields": [
      {"key": "project", "value": "Website Redesign"}
    ]
  }
}
```

#### Get All Automations
```http
GET /
Authorization: Bearer <token>
```

#### Get Specific Automation
```http
GET /:id
Authorization: Bearer <token>
```

#### Update Automation
```http
PUT /:id
Authorization: Bearer <token>
```

#### Delete Automation
```http
DELETE /:id
Authorization: Bearer <token>
```

#### Update Status
```http
PATCH /:id/status
Authorization: Bearer <token>

{
  "status": "paused"
}
```

#### Run Immediately
```http
POST /:id/run
Authorization: Bearer <token>
```

#### Generate AI Auto-Reply
```http
POST /generate-auto-reply
Authorization: Bearer <token>

{
  "originalEmail": "Email content here",
  "context": "General inquiry",
  "tone": "professional"
}
```

## Personalization Variables

### Built-in Variables
- `{{recipientName}}` - Recipient's name
- `{{company}}` - Company name
- `{{senderName}}` - Your name
- `{{currentDate}}` - Current date

### Custom Variables
- Add your own variables like `{{project}}`, `{{deadline}}`
- Set default values for each variable
- Variables are replaced at send time

### Example Usage
```
Subject: Project Update - {{project}}

Hi {{recipientName}},

Here's the latest update on the {{project}} project.
Deadline: {{deadline}}

Best regards,
{{senderName}}
```

## AI Features

### Auto-Reply Generation
- **Context-aware** responses
- **Professional tone** options
- **Customizable prompts**
- **Multiple language support**

### Follow-up Message Generation
- **Friendly reminders**
- **Professional follow-ups**
- **Context-sensitive content**
- **Brand voice consistency**

## Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

### Email Service Integration
Currently supports simulation mode. To integrate with real email services:

1. **SendGrid**:
   ```javascript
   // In sendEmail function
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   ```

2. **AWS SES**:
   ```javascript
   // In sendEmail function
   const AWS = require('aws-sdk');
   const ses = new AWS.SES();
   ```

3. **Nodemailer**:
   ```javascript
   // In sendEmail function
   const nodemailer = require('nodemailer');
   const transporter = nodemailer.createTransporter(config);
   ```

## Security Features

- **JWT Authentication** required for all endpoints
- **Rate limiting** to prevent abuse
- **Input validation** and sanitization
- **CORS protection**
- **Helmet security headers**

## Error Handling

### Common Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (automation doesn't exist)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Error Response Format
```json
{
  "error": "Error message description",
  "details": "Additional error details if available"
}
```

## Monitoring & Logging

### Activity Tracking
- **Email sent timestamps**
- **Delivery status** tracking
- **Reply detection** (when integrated)
- **Error logging** and reporting

### Dashboard Metrics
- **Active automations** count
- **Scheduled emails** overview
- **Success/failure rates**
- **Performance analytics**

## Best Practices

### Email Content
1. **Keep subjects clear** and actionable
2. **Use personalization** sparingly but effectively
3. **Test automation** with small groups first
4. **Monitor engagement** and adjust accordingly

### Scheduling
1. **Consider time zones** of recipients
2. **Avoid peak hours** for better open rates
3. **Use recurring schedules** for regular updates
4. **Set realistic follow-up** intervals

### Automation Rules
1. **Don't over-automate** - keep it personal
2. **Test follow-up logic** thoroughly
3. **Monitor auto-replies** for appropriateness
4. **Regular review** of automation performance

## Troubleshooting

### Common Issues

#### Emails Not Sending
- Check server logs for errors
- Verify email service configuration
- Ensure authentication tokens are valid
- Check rate limiting settings

#### Follow-ups Not Working
- Verify follow-up is enabled
- Check follow-up message content
- Ensure proper timing configuration
- Review server logs for errors

#### Personalization Issues
- Check variable syntax ({{variableName}})
- Verify variable values are set
- Test with simple variables first
- Check for special characters

### Debug Mode
Enable debug logging:
```bash
NODE_ENV=development DEBUG=email-automation:* npm run dev
```

## Future Enhancements

### Planned Features
- **File attachments** support
- **Advanced analytics** dashboard
- **A/B testing** for email content
- **Multi-language** support
- **Advanced scheduling** (holidays, business hours)
- **Integration** with CRM systems
- **Advanced AI** features (sentiment analysis, smart timing)

### Integration Possibilities
- **Slack notifications** for automation events
- **Webhook support** for external systems
- **API rate limiting** and quotas
- **Multi-tenant** support
- **Advanced reporting** and analytics

## Support

For technical support or feature requests:
- Check the main project README
- Review server logs for errors
- Test with minimal configuration first
- Ensure all dependencies are installed

## License

This module is part of the AutoTask AI project and follows the same licensing terms.