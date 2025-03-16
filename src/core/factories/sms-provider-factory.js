import logger from '../../utils/logger.js';


class SmsProviderFactory {
 
  static #providers = new Map();


  static registerProvider(name, ProviderClass) {
    this.#providers.set(name.toLowerCase(), ProviderClass);
    logger.info(`Provedor de SMS '${name}' registrado com sucesso`);
  }

 
  static create(providerName, config = {}) {
    const normalizedName = providerName.toLowerCase();
    
    if (!this.#providers.has(normalizedName)) {

      logger.warn(`Provedor '${providerName}' não encontrado. Usando provedor mock`);
      return new MockSmsProvider(config);
    }
    
    const ProviderClass = this.#providers.get(normalizedName);
    
    logger.info(`Criando instância do provedor '${providerName}'`);
    return new ProviderClass(config);
  }


  static getAvailableProviders() {
    return Array.from(this.#providers.keys());
  }
}

class MockSmsProvider {
  constructor(config = {}) {
    this.config = config;
    logger.warn('Provedor mock de SMS criado. Este provedor simula envio sem realmente enviar mensagens.');
  }


  async sendSMS(messagePayload) {
    const messages = messagePayload.messages || [];
    const destination = messages[0]?.destinations?.[0]?.to || 'destinatário desconhecido';
    
    logger.info(`[MOCK] Simulando envio de SMS para ${destination}`);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      bulkId: `mock-${Date.now()}`,
      messages: messages.map((msg, index) => ({
        messageId: msg.destinations?.[0]?.messageId || `mock-msg-${index}-${Date.now()}`,
        status: {
          groupId: 1,
          groupName: 'PENDING',
          id: 7,
          name: 'PENDING_ENROUTE',
          description: 'Message sent to next instance'
        },
        to: msg.destinations?.[0]?.to || 'unknown'
      }))
    };
  }
  

  async getDeliveryReports(messageId) {
    logger.info(`[MOCK] Obtendo relatório de entrega para mensagem ${messageId}`);
    
    return {
      results: [
        {
          messageId,
          status: {
            groupId: 3,
            groupName: 'DELIVERED',
            id: 5,
            name: 'DELIVERED_TO_HANDSET',
            description: 'Message delivered to handset'
          },
          sentAt: new Date().toISOString(),
          doneAt: new Date().toISOString()
        }
      ]
    };
  }
}

SmsProviderFactory.registerProvider('mock', MockSmsProvider);

export default SmsProviderFactory;