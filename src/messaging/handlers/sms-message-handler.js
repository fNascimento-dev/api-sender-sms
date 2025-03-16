import logger from '../../utils/logger.js';
import MessageBuilderPool from '../../core/builders/pool/message-builder-pool.js';
import SmsService from '../../core/service/sms-service.js';
class SmsMessageHandler {
  constructor() {
    this.builderPool = MessageBuilderPool.getInstance();
    this.smsService = SmsService;
  }

 
  async handle(messageData) {
    this._validateMessage(messageData);
    
    const builder = await this.builderPool.acquire();
    
    try {
      logger.info(`Processando mensagem SMS para ${messageData.to}`);
      
      builder.createSingleMessage(
        messageData.sender || process.env.DEFAULT_SENDER,
        messageData.to,
        messageData.text,
        messageData.messageId
      );
      
      if (messageData.validityPeriod) {
        builder.setValidityPeriod(
          messageData.validityPeriod.amount,
          messageData.validityPeriod.timeUnit
        );
      }
      
      if (messageData.webhookUrl) {
        builder.setWebhooks(
          messageData.webhookUrl,
          messageData.intermediateReports || false,
          messageData.callbackData
        );
      }
      
      if (messageData.campaignId) {
        builder.setCampaignReference(messageData.campaignId);
      }
      
      if (messageData.language) {
        builder.setLanguage(
          messageData.language, 
          messageData.transliteration
        );
      }
      
      const smsPayload = builder.build();
      
      Promise.resolve().then(() => {
        return this.smsService.sendSms(smsPayload, messageData.provider || 'infobip')
          .then(result => {
            logger.info(`SMS enviado com sucesso para ${messageData.to}`, { messageId: result.messageId });
          })
          .catch(error => {
            logger.error(`Falha ao enviar SMS para ${messageData.to}: ${error.message}`);
          });
      });
      
      return Promise.resolve();
    } finally {
      this.builderPool.release(builder);
    }
  }


  _validateMessage(messageData) {
    if (!messageData) {
      throw new Error('Dados da mensagem são obrigatórios');
    }
    
    if (!messageData.to) {
      throw new Error('Destinatário (to) é obrigatório');
    }
    
    if (!messageData.text) {
      throw new Error('Texto da mensagem é obrigatório');
    }
  }
}

export default SmsMessageHandler;