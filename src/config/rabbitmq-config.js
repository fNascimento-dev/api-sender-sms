import 'dotenv/config';

/**
 * Para adicionar um novo consumer, basta adicionar um novo objeto no array abaixo.
 */
export const rabbitmqConfig = [
  {
    url: process.env.RABBITMQ_URL || 'amqp://admin:pass@localhost:5672',
    vhost: process.env.RABBITMQ_VHOST || 'bts',
    queueName: process.env.RABBITMQ_QUEUE || 'sms-homolrx',
    options: {
      heartbeat: 30
    },
    prefetch: 10,
    maxRetries: 3,
    consumerTag: 'international_sms_sender',
    deadLetterQueue: 'sms_notifications_failed',
  }
];