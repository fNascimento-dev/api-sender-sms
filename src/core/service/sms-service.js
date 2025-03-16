import SmsProviderFactory from '../factories/sms-provider-factory.js';
import logger from '../../utils/logger.js';

class SmsService {

  async sendSms(smsPayload, providerName = 'infobip') {
    try {
      const firstMessage = smsPayload.messages && smsPayload.messages[0];
      const destination = firstMessage?.destinations && firstMessage.destinations[0];
      
      logger.info(`Enviando SMS para ${destination?.to || 'destinatário'}`, {
        provider: providerName,
        messageId: destination?.messageId || 'unknown'
      });
      
      const provider = SmsProviderFactory.create(providerName);
      
      const result = await provider.sendSMS(smsPayload);
      
      logger.info(`SMS enviado com sucesso`, {
        provider: providerName,
        messageId: destination?.messageId || 'unknown',
        resultId: result.messageId || result.bulkId
      });
      
      return {
        success: true,
        messageId: destination?.messageId || result.messageId || result.bulkId,
        providerResponse: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Falha ao enviar SMS: ${error.message}`, {
        stack: error.stack,
        provider: providerName
      });
      
      throw new Error(`Falha ao enviar SMS: ${error.message}`);
    }
  }
}

export default new SmsService();