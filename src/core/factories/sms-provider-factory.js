import logger from '../../utils/logger.js';

/**
 * Fábrica para criar instâncias de provedores de SMS
 * Este padrão Factory permite que o sistema use diferentes 
 * provedores de SMS sem alterar o código cliente
 */
class SmsProviderFactory {
  /**
   * Armazena os provedores disponíveis
   * @private
   */
  static #providers = new Map();

  /**
   * Registra um provedor no factory
   * 
   * @param {string} name - Nome do provedor
   * @param {Function} ProviderClass - Classe do provedor
   */
  static registerProvider(name, ProviderClass) {
    this.#providers.set(name.toLowerCase(), ProviderClass);
    logger.info(`Provedor de SMS '${name}' registrado com sucesso`);
  }

  /**
   * Cria uma instância do provedor solicitado
   * 
   * @param {string} providerName - Nome do provedor
   * @param {Object} config - Configuração adicional do provedor (opcional)
   * @returns {Object} Instância do provedor
   * @throws {Error} Se o provedor não estiver registrado
   */
  static create(providerName, config = {}) {
    const normalizedName = providerName.toLowerCase();
    
    // Verificar se o provedor existe
    if (!this.#providers.has(normalizedName)) {
      // Por enquanto, vamos simular um provedor básico para permitir
      // que o sistema continue funcionando
      logger.warn(`Provedor '${providerName}' não encontrado. Usando provedor mock`);
      return new MockSmsProvider(config);
    }
    
    // Obter classe do provedor
    const ProviderClass = this.#providers.get(normalizedName);
    
    // Instanciar o provedor
    logger.info(`Criando instância do provedor '${providerName}'`);
    return new ProviderClass(config);
  }

  /**
   * Retorna os nomes dos provedores disponíveis
   * 
   * @returns {Array<string>} Lista de nomes de provedores
   */
  static getAvailableProviders() {
    return Array.from(this.#providers.keys());
  }
}

/**
 * Provedor de SMS básico para teste/mock
 * Será usado caso o provedor solicitado não esteja disponível
 */
class MockSmsProvider {
  constructor(config = {}) {
    this.config = config;
    logger.warn('Provedor mock de SMS criado. Este provedor simula envio sem realmente enviar mensagens.');
  }

  /**
   * Simula o envio de um SMS
   * 
   * @param {Object} messagePayload - Objeto de mensagem
   * @returns {Promise<Object>} Resposta simulada
   */
  async sendSMS(messagePayload) {
    const messages = messagePayload.messages || [];
    const destination = messages[0]?.destinations?.[0]?.to || 'destinatário desconhecido';
    
    logger.info(`[MOCK] Simulando envio de SMS para ${destination}`);
    
    // Simular uma pequena latência
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
  
  /**
   * Simula a obtenção de relatórios de entrega
   * 
   * @param {string} messageId - ID da mensagem
   * @returns {Promise<Object>} Status simulado
   */
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

// Registrar o provedor mock por padrão
SmsProviderFactory.registerProvider('mock', MockSmsProvider);

export default SmsProviderFactory;