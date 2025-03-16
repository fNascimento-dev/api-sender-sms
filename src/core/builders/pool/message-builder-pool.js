import MessageBuilder from '../message-builder.js';
import logger from '../../../utils/logger.js';

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


  static getInstance() {
    if (!MessageBuilderPool.instance) {
      MessageBuilderPool.instance = new MessageBuilderPool();
    }
    return MessageBuilderPool.instance;
  }

 
  _initializePool(size) {
    logger.info(`Initializing message builder pool with ${size} builders`);
    for (let i = 0; i < size; i++) {
      this.available.push(new MessageBuilder());
    }
  }

 
  async acquire() {
    if (this.available.length === 0) {
      if (this.inUse.size < this.maxSize) {
        const builder = new MessageBuilder();
        logger.info('Creating new message builder as the pool is empty', { poolSize: this.inUse.size + 1 });
        this._trackBuilder(builder);
        return builder;
      } else {
        logger.warn('Message builder pool reached maximum size, waiting for available builder', { maxSize: this.maxSize });
        return await this._waitForAvailableBuilder();
      }
    }
    
    const builder = this.available.pop();
    this._trackBuilder(builder);
    return builder;
  }

 
  _trackBuilder(builder) {
    const id = Math.random().toString(36).substring(7);
    this.inUse.set(id, {
      builder,
      acquiredAt: Date.now()
    });
    
    builder.__poolId = id;
  }


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
    
    logger.warn('Forcing release of oldest builder after wait attempts', { attempts: maxAttempts });
    
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
    
    logger.error('Could not obtain a builder from the pool', { maxSize: this.maxSize });
    return new MessageBuilder();
  }


  release(builder) {
    if (!builder) return;
    
    const id = builder.__poolId;
    
    if (id && this.inUse.has(id)) {
      this.inUse.delete(id);
      
      builder.reset();
      this.available.push(builder);
      
      logger.info('Builder released back to the pool', { 
        availableCount: this.available.length,
        inUseCount: this.inUse.size 
      });
    }
  }


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

export default MessageBuilderPool;