require('dotenv').config();


const rabbitmqConfig = [

    {
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      vhost: process.env.RABBITMQ_VHOST || 'bts',
      queueName: process.env.RABBITMQ_QUEUE || 'sms-homolrx',
      options: {
        credentials: {
          username: process.env.RABBITMQ_USER || 'guest',
          password: process.env.RABBITMQ_PASS || 'guest'
        },
        heartbeat: 30
      },
      prefetch: 10,
      maxRetries: 3,
      consumerTag: 'international_sms_sender',
      deadLetterQueue: 'sms_notifications_failed',
  }
    
   
  ];
  
  module.exports = {
    rabbitmqConfig
  };