export default class MessageBuilder {
  constructor() {
    this.reset();
  }


  reset() {
    this.messages = [];
    this.options = {};
    return this;
  }


  addMessage(messageData) {
    if (!messageData) {
      throw new Error('Message data is required');
    }

    const message = {
      sender: messageData.sender,
      destinations: messageData.destinations || [],
      content: messageData.content || {},
      options: messageData.options || {},
      webhooks: messageData.webhooks
    };

    if (!message.sender) {
      throw new Error('Sender is required');
    }

    if (!message.destinations || message.destinations.length === 0) {
      throw new Error('At least one destination is required');
    }

    if (!message.content || !message.content.text) {
      throw new Error('Message text (content.text) is required');
    }

    this.messages.push(message);
    return this;
  }


  withSchedule(bulkId, sendAt) {
    if (!bulkId) {
      throw new Error('bulkId is required for scheduling');
    }

    if (!sendAt) {
      throw new Error('sendAt is required for scheduling');
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


  withTracking(trackingOptions) {
    if (!trackingOptions) {
      throw new Error('Tracking options are required');
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


  withConversionTracking(campaignName) {
    if (!campaignName) {
      throw new Error('Campaign name is required for conversion tracking');
    }

    this.options.conversionTracking = {
      useConversionTracking: true,
      conversionTrackingName: campaignName
    };

    return this;
  }


  includeSmsCount(include = true) {
    this.options.includeSmsCountInResponse = include;
    return this;
  }


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


  setLanguage(languageCode, transliteration = null) {
    if (this.messages.length === 0) {
      throw new Error('Add a message before setting the language');
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


  setValidityPeriod(amount, timeUnit = 'HOURS') {
    if (this.messages.length === 0) {
      throw new Error('Add a message before setting validity period');
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

 
  setCampaignReference(campaignId) {
    if (this.messages.length === 0) {
      throw new Error('Add a message before setting campaign reference');
    }

    const lastMessage = this.messages[this.messages.length - 1];
    
    if (!lastMessage.options) {
      lastMessage.options = {};
    }

    lastMessage.options.campaignReferenceId = campaignId;

    return this;
  }

 
  setWebhooks(url, intermediateReport = false, callbackData = null) {
    if (this.messages.length === 0) {
      throw new Error('Add a message before setting webhooks');
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


  setDeliveryTimeWindow(days, from, to) {
    if (this.messages.length === 0) {
      throw new Error('Add a message before setting delivery window');
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


  validate() {
    if (this.messages.length === 0) {
      throw new Error('At least one message is required');
    }

    return true;
  }


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