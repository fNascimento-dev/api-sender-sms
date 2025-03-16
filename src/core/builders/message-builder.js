class MessageBuilder {
  constructor() {
    this.reset();
  }

  /**
   * Reseta o builder para um novo estado inicial
   * 
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  reset() {
    this.messages = [];
    this.options = {};
    return this;
  }

  /**
   * Adiciona uma nova mensagem à requisição
   * 
   * @param {Object} messageData - Dados da mensagem
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  addMessage(messageData) {
    if (!messageData) {
      throw new Error('Dados da mensagem são obrigatórios');
    }

    const message = {
      sender: messageData.sender,
      destinations: messageData.destinations || [],
      content: messageData.content || {},
      options: messageData.options || {},
      webhooks: messageData.webhooks
    };

    if (!message.sender) {
      throw new Error('Remetente (sender) é obrigatório');
    }

    if (!message.destinations || message.destinations.length === 0) {
      throw new Error('Pelo menos um destinatário (destination) é obrigatório');
    }

    if (!message.content || !message.content.text) {
      throw new Error('Texto da mensagem (content.text) é obrigatório');
    }

    this.messages.push(message);
    return this;
  }

  /**
   * Define opções de agendamento para todas as mensagens
   * 
   * @param {string} bulkId - ID do lote de mensagens
   * @param {string|Date} sendAt - Data e hora para envio
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  withSchedule(bulkId, sendAt) {
    if (!bulkId) {
      throw new Error('bulkId é obrigatório para agendamento');
    }

    if (!sendAt) {
      throw new Error('sendAt é obrigatório para agendamento');
    }

    const sendAtFormatted = sendAt instanceof Date 
      ? sendAt.toISOString() 
      : sendAt;

    this.options.schedule = {
      bulkId,
      sendAt: sendAtFormatted
    };

    return this;
  }

  /**
   * Define opções de rastreamento para todas as mensagens
   * 
   * @param {Object} trackingOptions - Opções de rastreamento
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  withTracking(trackingOptions) {
    if (!trackingOptions) {
      throw new Error('Opções de rastreamento são obrigatórias');
    }

    this.options.tracking = {
      shortenUrl: trackingOptions.shortenUrl || false,
      trackClicks: trackingOptions.trackClicks || false,
      trackingUrl: trackingOptions.trackingUrl,
      removeProtocol: trackingOptions.removeProtocol || false,
      customDomain: trackingOptions.customDomain
    };

    return this;
  }

  /**
   * Habilita o rastreamento de conversão
   * 
   * @param {string} campaignName - Nome da campanha para rastreamento
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  withConversionTracking(campaignName) {
    if (!campaignName) {
      throw new Error('Nome da campanha é obrigatório para rastreamento de conversão');
    }

    this.options.conversionTracking = {
      useConversionTracking: true,
      conversionTrackingName: campaignName
    };

    return this;
  }

  /**
   * Define se deve incluir a contagem de SMS na resposta
   * 
   * @param {boolean} include - Se deve incluir a contagem
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  includeSmsCount(include = true) {
    this.options.includeSmsCountInResponse = include;
    return this;
  }

  /**
   * Cria uma nova mensagem com destinatário único
   * 
   * @param {string} sender - Remetente da mensagem
   * @param {string} to - Número do destinatário
   * @param {string} text - Texto da mensagem
   * @param {string} messageId - ID opcional da mensagem
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  createSingleMessage(sender, to, text, messageId = null) {
    const destination = { to };
    
    if (messageId) {
      destination.messageId = messageId;
    }

    const message = {
      sender,
      destinations: [destination],
      content: {
        text
      }
    };

    this.messages.push(message);
    return this;
  }

  /**
   * Define o idioma e transliteração para a última mensagem adicionada
   * 
   * @param {string} languageCode - Código do idioma (ex: "TR")
   * @param {string} transliteration - Tipo de transliteração
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  setLanguage(languageCode, transliteration = null) {
    if (this.messages.length === 0) {
      throw new Error('Adicione uma mensagem antes de definir o idioma');
    }

    const lastMessage = this.messages[this.messages.length - 1];
    
    lastMessage.content.language = {
      languageCode
    };

    if (transliteration) {
      lastMessage.content.transliteration = transliteration;
    }

    return this;
  }

  /**
   * Define o período de validade para a última mensagem adicionada
   * 
   * @param {number} amount - Quantidade de tempo
   * @param {string} timeUnit - Unidade de tempo (MINUTES, HOURS, DAYS)
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  setValidityPeriod(amount, timeUnit = 'HOURS') {
    if (this.messages.length === 0) {
      throw new Error('Adicione uma mensagem antes de definir o período de validade');
    }

    const lastMessage = this.messages[this.messages.length - 1];
    
    if (!lastMessage.options) {
      lastMessage.options = {};
    }

    lastMessage.options.validityPeriod = {
      amount,
      timeUnit
    };

    return this;
  }

  /**
   * Define uma referência de campanha para a última mensagem adicionada
   * 
   * @param {string} campaignId - ID da campanha
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  setCampaignReference(campaignId) {
    if (this.messages.length === 0) {
      throw new Error('Adicione uma mensagem antes de definir a referência de campanha');
    }

    const lastMessage = this.messages[this.messages.length - 1];
    
    if (!lastMessage.options) {
      lastMessage.options = {};
    }

    lastMessage.options.campaignReferenceId = campaignId;

    return this;
  }

  /**
   * Define webhooks para a última mensagem adicionada
   * 
   * @param {string} url - URL de callback
   * @param {boolean} intermediateReport - Se deve receber relatórios intermediários
   * @param {string} callbackData - Dados adicionais para o callback
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  setWebhooks(url, intermediateReport = false, callbackData = null) {
    if (this.messages.length === 0) {
      throw new Error('Adicione uma mensagem antes de definir webhooks');
    }

    const lastMessage = this.messages[this.messages.length - 1];
    
    lastMessage.webhooks = {
      delivery: {
        url,
        intermediateReport
      },
      contentType: 'application/json'
    };

    if (callbackData) {
      lastMessage.webhooks.callbackData = callbackData;
    }

    return this;
  }

  /**
   * Define uma janela de tempo para entrega da última mensagem adicionada
   * 
   * @param {Array<string>} days - Dias da semana para entrega
   * @param {Object} from - Horário inicial (hour, minute)
   * @param {Object} to - Horário final (hour, minute)
   * @returns {SMSMessageBuilder} Instância do builder para encadeamento
   */
  setDeliveryTimeWindow(days, from, to) {
    if (this.messages.length === 0) {
      throw new Error('Adicione uma mensagem antes de definir a janela de entrega');
    }

    const lastMessage = this.messages[this.messages.length - 1];
    
    if (!lastMessage.options) {
      lastMessage.options = {};
    }

    lastMessage.options.deliveryTimeWindow = {
      days,
      from,
      to
    };

    return this;
  }

  /**
   * Valida se o objeto está completo com todos os campos obrigatórios
   * 
   * @returns {boolean} Verdadeiro se o objeto for válido
   * @throws {Error} Se o objeto não for válido
   */
  validate() {
    if (this.messages.length === 0) {
      throw new Error('Pelo menos uma mensagem é obrigatória');
    }


    return true;
  }

  /**
   * Constrói o objeto final
   * 
   * @returns {Object} Objeto completo pronto para envio
   * @throws {Error} Se o objeto não for válido
   */
  build() {
    this.validate();

    const result = {
      messages: [...this.messages]
    };

    if (Object.keys(this.options).length > 0) {
      result.options = { ...this.options };
    }

    return result;
  }

  
}

module.exports = MessageBuilder;