const MessageBuilder = require('../message-builder');


/**
 * Pool de MessageBuilder para reutilização
 * Implementa um padrão Object Pool
 */
class MessageBuilderPool {
    constructor(initialSize = 10, maxSize = 100) {
      if (MessageBuilderPool.instance) {
        return MessageBuilderPool.instance;
      }
  
      this.available = [];
      this.inUse = new Map();
      this.maxSize = maxSize;
      
      this._initializePool(initialSize);
      
      MessageBuilderPool.instance = this;
    }
  
    /**
     * Obtém a instância única do pool
     * 
     * @returns {MessageBuilderPool} Instância do pool
     */
    static getInstance() {
      if (!MessageBuilderPool.instance) {
        MessageBuilderPool.instance = new MessageBuilderPool();
      }
      return MessageBuilderPool.instance;
    }
  
    /**
     * Inicializa o pool com um número específico de builders
     * 
     * @param {number} size - Tamanho inicial do pool
     * @private
     */
    _initializePool(size) {
      this.logger.info(`Inicializando pool com ${size} builders`);
      for (let i = 0; i < size; i++) {
        this.available.push(new MessageBuilder());
      }
    }
  
    /**
     * Obtém um builder do pool ou cria um novo se necessário
     * 
     * @returns {MessageBuilder} Uma instância de MessageBuilder
     */
    async acquire() {
      if (this.available.length === 0) {
        if (this.inUse.size < this.maxSize) {
          const builder = new SMSMessageBuilder();
          this.logger.debug('Criando novo SMS builder pois o pool está vazio', { poolSize: this.inUse.size + 1 });
          this._trackBuilder(builder);
          return builder;
        } else {
          this.logger.warn('Pool de SMS builders atingiu o tamanho máximo, aguardando builder disponível', { maxSize: this.maxSize });
          return await this._waitForAvailableBuilder();
        }
      }
      
      const builder = this.available.pop();
      this._trackBuilder(builder);
      return builder;
    }
  
    /**
     * Rastreia um builder em uso
     * 
     * @param {MessageBuilder} builder - Builder a ser rastreado
     * @private
     */
    _trackBuilder(builder) {
      const id = Math.random().toString(36).substring(7);
      this.inUse.set(id, {
        builder,
        acquiredAt: Date.now()
      });
      
      builder.__poolId = id;
    }
  
    /**
     * Aguarda até um builder ficar disponível
     * Este método usa uma abordagem de backoff exponencial
     * 
     * @returns {Promise<MessageBuilder>} Promise com um builder quando disponível
     * @private
     */
    async _waitForAvailableBuilder() {
      let attempt = 0;
      const maxAttempts = 5;
      
      while (attempt < maxAttempts) {
        const waitTime = Math.min(100 * Math.pow(2, attempt), 1000);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        if (this.available.length > 0) {
          const builder = this.available.pop();
          this._trackBuilder(builder);
          return builder;
        }
        
        attempt++;
      }
      
      this.logger.warn('Forçando liberação do builder mais antigo após tentativas de espera', { attempts: maxAttempts });
      
      let oldestId = null;
      let oldestTime = Infinity;
      
      for (const [id, { acquiredAt }] of this.inUse.entries()) {
        if (acquiredAt < oldestTime) {
          oldestTime = acquiredAt;
          oldestId = id;
        }
      }
      
      if (oldestId) {
        const { builder } = this.inUse.get(oldestId);
        this.inUse.delete(oldestId);
        builder.reset();
        this._trackBuilder(builder);
        return builder;
      }
      
      this.logger.error('Não foi possível obter um builder do pool', { maxSize: this.maxSize });
      return new MessageBuilder();
    }
  
    /**
     * Libera um builder de volta para o pool
     * 
     * @param {MessageBuilder} builder - Builder a ser liberado
     */
    release(builder) {
      if (!builder) return;
      
      const id = builder.__poolId;
      
      if (id && this.inUse.has(id)) {
        this.inUse.delete(id);
        
        builder.reset();
        this.available.push(builder);
        
        this.logger.debug('Builder liberado de volta para o pool', { 
          availableCount: this.available.length,
          inUseCount: this.inUse.size 
        });
      }
    }
  
    /**
     * Obtém estatísticas do pool
     * 
     * @returns {Object} Estatísticas do pool
     */
    getStats() {
      return {
        availableCount: this.available.length,
        inUseCount: this.inUse.size,
        totalSize: this.available.length + this.inUse.size,
        maxSize: this.maxSize,
        utilizationPercentage: (this.inUse.size / this.maxSize) * 100
      };
    }
  }
  
  MessageBuilderPool.instance = undefined;
  
  module.exports = MessageBuilderPool;