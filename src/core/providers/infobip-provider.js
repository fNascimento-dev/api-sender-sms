import axios from 'axios';
import logger from '../../utils/logger.js';
import { apiKey, baseApi } from '../../config/infobip-api-credentials.js';


class InfobipSmsProvider {
  constructor() {
    this.baseUrl = baseApi || 'http://127.0.0.1:3000';
    this.apiKey = apiKey
    
    if (!this.apiKey) {
      throw new Error('Infobip API key is required');
    }
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `App ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }
  

  async sendSMS(message) {
    try {
      logger.info('Sending SMS through Infobip API', {
        destinations: message.messages[0]?.destinations?.length || 0
      });
      
      const response = await this.client.post('/sms/3/messages', message);
      
      logger.info('Infobip API response received', {
        status: response.status,
        messageCount: response.data?.messages?.length || 0
      });
      
      return response.data;
    } catch (error) {
      logger.error('Error sending SMS through Infobip API', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      throw new Error(`Infobip API error: ${error.message}`);
    }
  }
  
}

export default InfobipSmsProvider;