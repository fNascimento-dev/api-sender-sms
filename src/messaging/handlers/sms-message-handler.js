import logger from '../../utils/logger.js';
import MessageBuilderPool from '../../core/builders/pool/message-builder-pool.js';
import SmsService from '../../core/service/sms-service.js';

/**
 * Manipulador de mensagens SMS
 * Responsável por processar mensagens da fila e encaminhá-las para envio
 */
class SmsMessageHandler {
  constructor() {
    this.builderPool = MessageBuilderPool.getInstance();
    this.smsService = SmsService;
  }

  /**
   * Processa uma mensagem recebida do RabbitMQ
   * 
   * @param {Object} messageData - Dados da mensagem
   * @returns {Promise<void>}
   */
  async handle(messageData) {
    // Validar mensagem
    this._validateMessage(messageData);
    
    // Obter builder do pool
    const builder = await this.builderPool.acquire();
    
    try {
      logger.info(`Processando mensagem SMS para ${messageData.to}`);
      
      // Construir objeto de mensagem
      builder.createSingleMessage(
        messageData.sender || process.env.DEFAULT_SENDER,
        messageData.to,
        messageData.text,
        messageData.messageId
      );
      
      // Configurar opções adicionais se fornecidas
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
      
      // Construir objeto final
      const smsPayload = builder.build();
      
      // Enviar SMS de forma assíncrona (sem await)
      // Utilizamos Promise.resolve().then() para executar de forma não bloqueante
      Promise.resolve().then(() => {
        return this.smsService.sendSms(smsPayload, messageData.provider || 'infobip')
          .then(result => {
            logger.info(`SMS enviado com sucesso para ${messageData.to}`, { messageId: result.messageId });
          })
          .catch(error => {
            logger.error(`Falha ao enviar SMS para ${messageData.to}: ${error.message}`);
            // Aqui poderíamos implementar lógica adicional para notificar sobre falhas
            // Por exemplo, enviando para uma fila de notificação de erros
          });
      });
      
      // Note que retornamos antes da promessa de envio ser concluída
      // Isso implementa o "fire and forget" para não bloquear o processamento da fila
      return Promise.resolve();
    } finally {
      // Sempre devolver o builder ao pool
      this.builderPool.release(builder);
    }
  }

  /**
   * Valida se a mensagem contém os campos obrigatórios
   * 
   * @param {Object} messageData - Dados da mensagem
   * @throws {Error} Se a mensagem for inválida
   * @private
   */
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