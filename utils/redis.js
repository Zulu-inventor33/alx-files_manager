import { promisify } from 'util';
import { createClient } from 'redis';

/**
 * Represents a Redis client.
 */
class RedisClient {
  /**
   * Creates a new RedisClient instance.
   */
  constructor() {
    this.client = createClient();
    this.isClientConnected = false; // Default to false until connected.
    
    // Set up error and connection event listeners.
    this.client.on('error', (err) => {
      console.error('Redis client failed to connect:', err.message || err.toString());
      this.isClientConnected = false;
    });
    
    this.client.on('connect', () => {
      console.log('Redis client connected.');
      this.isClientConnected = true;
    });
    
    // Promisify Redis commands for easier async usage
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.setex).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  /**
   * Checks if this client's connection to the Redis server is active.
   * @returns {boolean}
   */
  isAlive() {
    return this.isClientConnected;
  }

  /**
   * Retrieves the value of a given key.
   * @param {String} key The key of the item to retrieve.
   * @returns {String | null} The value stored for the key, or null if not found.
   */
  async get(key) {
    try {
      return await this.getAsync(key);
    } catch (err) {
      console.error('Error fetching from Redis:', err.message || err.toString());
      return null; // Return null if there's an error.
    }
  }

  /**
   * Stores a key and its value along with an expiration time.
   * @param {String} key The key of the item to store.
   * @param {String | Number | Boolean} value The item to store.
   * @param {Number} duration The expiration time of the item in seconds.
   * @returns {Promise<void>}
   */
  async set(key, value, duration) {
    try {
      await this.setAsync(key, duration, value);
    } catch (err) {
      console.error('Error setting value in Redis:', err.message || err.toString());
    }
  }

  /**
   * Removes the value of a given key.
   * @param {String} key The key of the item to remove.
   * @returns {Promise<void>}
   */
  async del(key) {
    try {
      await this.delAsync(key);
    } catch (err) {
      console.error('Error deleting from Redis:', err.message || err.toString());
    }
  }
}

// Export an instance of the RedisClient
export const redisClient = new RedisClient();
export default redisClient;

