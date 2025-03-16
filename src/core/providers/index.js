import SmsProviderFactory from '../factories/sms-provider-factory.js';
import InfobipProvider from './infobip-provider.js';

// Registrar o provedor Infobip
SmsProviderFactory.registerProvider('infobip', InfobipProvider);

// Registrar outros provedores aqui...

export default SmsProviderFactory;