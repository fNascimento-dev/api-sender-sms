import SmsProviderFactory from '../factories/sms-provider-factory.js';
import logger from '../../utils/logger.js';

/**
 * Serviço responsável pelo envio de SMS
 */
class SmsService {
  /**
   * Envia um SMS utilizando o provedor especificado
   * 
   * @param {Object} smsPayload - Objeto com dados da mensagem formatado pelo MessageBuilder
   * @param {string} providerName - Nome do provedor de SMS (default: 'infobip')
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendSms(smsPayload, providerName = 'infobip') {
    try {
      // Obter a primeira mensagem da lista, se existir
      const firstMessage = smsPayload.messages && smsPayload.messages[0];
      const destination = firstMessage?.destinations && firstMessage.destinations[0];
      
      logger.info(`Enviando SMS para ${destination?.to || 'destinatário'}`, {
        provider: providerName,
        messageId: destination?.messageId || 'unknown'
      });
      
      // Obter instância do provedor
      const provider = SmsProviderFactory.create(providerName);
      
      // Enviar SMS através do provedor
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

// Exportar instância singleton
export default new SmsService();