const OpenAI = require('openai');

class AIReplyService {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;
  }

  async generateAutoReply(originalEmail, replyEmail, context = {}) {
    if (!this.openai) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    try {
      const prompt = `
You are an AI assistant helping to generate professional auto-replies to emails.

Original Email Subject: ${originalEmail.subject}
Original Email Body: ${originalEmail.body}

Reply Received Subject: ${replyEmail.subject}
Reply Received Body: ${replyEmail.body}

Context: ${JSON.stringify(context)}

Generate a professional, contextually appropriate auto-reply that:
1. Acknowledges the reply
2. Is helpful and relevant
3. Maintains a professional tone
4. Is concise (2-3 sentences max)

Auto-Reply:`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional email assistant. Generate concise, helpful auto-replies.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      const autoReply = completion.choices[0].message.content.trim();

      return {
        success: true,
        autoReply: autoReply
      };
    } catch (error) {
      console.error('Error generating AI auto-reply:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateFollowUpMessage(originalEmail, daysWaited, context = {}) {
    if (!this.openai) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    try {
      const prompt = `
Generate a professional follow-up email for:

Original Email Subject: ${originalEmail.subject}
Original Email Body: ${originalEmail.body}
Days since original email: ${daysWaited}
Context: ${JSON.stringify(context)}

Create a polite follow-up that:
1. References the original email
2. Is not pushy or aggressive
3. Provides value or additional context
4. Includes a clear call to action
5. Is professional and concise

Follow-up Email:`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional email assistant. Generate polite, effective follow-up emails.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const followUpMessage = completion.choices[0].message.content.trim();

      return {
        success: true,
        followUpMessage: followUpMessage
      };
    } catch (error) {
      console.error('Error generating AI follow-up:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async personalizeEmailContent(template, recipientData) {
    if (!this.openai) {
      // Fallback to simple variable replacement
      let personalized = template;
      Object.keys(recipientData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        personalized = personalized.replace(regex, recipientData[key]);
      });
      return { success: true, personalizedContent: personalized };
    }

    try {
      const prompt = `
Personalize this email template with the provided recipient data:

Template: ${template}
Recipient Data: ${JSON.stringify(recipientData)}

Rules:
1. Replace any {{variableName}} placeholders with appropriate values
2. Make the tone more personal and engaging
3. Keep the core message intact
4. Ensure it sounds natural and professional

Personalized Email:`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an email personalization assistant. Make emails more personal while keeping them professional.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.6
      });

      const personalizedContent = completion.choices[0].message.content.trim();

      return {
        success: true,
        personalizedContent: personalizedContent
      };
    } catch (error) {
      console.error('Error personalizing email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new AIReplyService();