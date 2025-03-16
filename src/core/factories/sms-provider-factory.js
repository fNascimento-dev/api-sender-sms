const InfobipSmsProvider = require('../providers/InfobipSmsProvider');

class SmsProviderFactory {
   
  static create(provider) {
    switch (provider) {
      case 'infobip':
        return new InfobipSmsProvider();
      default:
        throw new Error('Invalid SMS provider');
    }
  }
}

module.exports = SmsProviderFactory;