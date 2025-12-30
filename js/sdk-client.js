/**
 * SDK Client - Wrapper for @dashevo/evo-sdk
 * Handles connection to Dash Platform and contract/document operations
 */

import { TORRENT_CONTRACT_SCHEMA } from './contract-schema.js';
import { generateEntropy, generateEntropyBytes, generateContractId } from './utils.js';

/**
 * SDK Client class for Dash Platform operations
 */
export class SdkClient {
  constructor() {
    this.sdk = null;
    this.network = 'testnet';
    this.connected = false;
    this.connecting = false;
    this.onStatusChange = null;
  }

  /**
   * Set status change callback
   * @param {function} callback - Called with (status, message)
   */
  setStatusCallback(callback) {
    this.onStatusChange = callback;
  }

  /**
   * Update status and notify listeners
   * @param {string} status - Status type (loading, connected, error, etc.)
   * @param {string} message - Status message
   */
  updateStatus(status, message) {
    if (this.onStatusChange) {
      this.onStatusChange(status, message);
    }
  }

  /**
   * Initialize and connect to Dash Platform
   * @param {string} network - 'testnet' or 'mainnet'
   * @returns {Promise<void>}
   */
  async connect(network = 'testnet') {
    if (this.connecting) {
      throw new Error('Connection already in progress');
    }

    if (this.connected && this.network === network) {
      return; // Already connected to the same network
    }

    this.connecting = true;
    this.updateStatus('loading', `Connecting to ${network}...`);

    try {
      // Disconnect if previously connected to different network
      if (this.sdk && this.network !== network) {
        await this.disconnect();
      }

      // Get EvoSDK from global (set by app.js after loading)
      if (typeof window.EvoSDK === 'undefined') {
        throw new Error('EvoSDK not loaded. Make sure WASM is initialized.');
      }

      // Create SDK instance with trusted mode for the selected network
      // These factory methods return configured instances that need connect() called
      this.sdk = network === 'testnet'
        ? window.EvoSDK.testnetTrusted()
        : window.EvoSDK.mainnetTrusted();

      this.updateStatus('loading', `Prefetching quorums for ${network}...`);

      // Connect to the network (this initializes WASM and prefetches quorums)
      await this.sdk.connect();

      this.network = network;
      this.connected = true;
      this.updateStatus('connected', `Connected to ${network}`);

    } catch (error) {
      this.connected = false;
      this.updateStatus('error', `Connection failed: ${error.message}`);
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Disconnect from Dash Platform
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.sdk) {
      try {
        // SDK cleanup if available
        this.sdk = null;
      } catch (error) {
        console.warn('Error during disconnect:', error);
      }
    }

    this.connected = false;
    this.updateStatus('disconnected', 'Disconnected');
  }

  /**
   * Check if SDK is ready for operations
   * @returns {boolean}
   */
  isReady() {
    return this.connected && this.sdk != null;
  }

  /**
   * Register a new data contract
   * @param {string} identityId - The identity ID that will own the contract
   * @param {string} privateKeyWif - Private key in WIF format
   * @returns {Promise<{ contractId: string, result: object }>}
   */
  async registerContract(identityId, privateKeyWif) {
    if (!this.isReady()) {
      throw new Error('SDK not connected');
    }

    if (!identityId) {
      throw new Error('Identity ID is required');
    }

    this.updateStatus('loading', 'Registering contract...');

    try {
      // Generate entropy and compute contract ID
      const entropy = generateEntropyBytes();
      const contractId = await generateContractId(identityId, entropy);

      this.updateStatus('loading', `Generated contract ID: ${contractId.substring(0, 12)}...`);

      // Build complete contract definition with all required fields
      const definition = {
        $format_version: "0",
        id: contractId,
        ownerId: identityId,
        version: 1,
        config: {
          $format_version: "0",
          canBeDeleted: false,
          readonly: false,
          keepsHistory: false,
          documentsKeepHistoryContractDefault: false,
          documentsMutableContractDefault: false,
          documentsCanBeDeletedContractDefault: false
        },
        documentSchemas: TORRENT_CONTRACT_SCHEMA
      };

      const result = await this.sdk.contracts.create({
        ownerId: identityId,
        definition: definition,
        privateKeyWif: privateKeyWif,
        keyId: null
      });

      // Log the full result to understand what's returned
      console.log('Contract creation result:', result);
      console.log('Our generated contract ID:', contractId);

      // Extract the actual contract ID from the result
      // The platform may assign a different ID than what we generated
      let finalContractId = contractId;
      if (result && typeof result === 'object') {
        // Check various possible locations for the ID in the result
        const possibleId = result.dataContractId || result.contractId || result.id ||
                          result.dataContract?.id || result.dataContract?.$id;
        if (possibleId && possibleId !== contractId) {
          console.warn('Platform assigned different ID than generated!');
          console.warn('Generated:', contractId);
          console.warn('Actual:', possibleId);
          finalContractId = possibleId;
        }
      }

      // If result is a string, it might be the contract ID directly
      if (typeof result === 'string' && result.length > 30) {
        finalContractId = result;
      }

      console.log('Using contract ID:', finalContractId);
      this.updateStatus('connected', `Contract registered: ${finalContractId}`);

      return {
        contractId: finalContractId,
        result
      };

    } catch (error) {
      this.updateStatus('error', `Contract registration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify a contract exists on the network
   * @param {string} contractId - The contract ID to verify
   * @returns {Promise<object|null>} The contract if found, null otherwise
   */
  async verifyContract(contractId) {
    if (!this.isReady()) {
      throw new Error('SDK not connected');
    }

    try {
      console.log('Verifying contract exists:', contractId);
      const contract = await this.sdk.contracts.fetch(contractId);
      console.log('Contract found:', contract);
      return contract;
    } catch (error) {
      console.error('Contract verification failed:', error);
      return null;
    }
  }

  /**
   * Submit a document to an existing contract
   * @param {string} contractId - The contract ID to submit to
   * @param {string} documentType - Document type (movie, tv, book, iso, other)
   * @param {string} ownerId - The identity ID of the document owner
   * @param {object} data - Document data
   * @param {string} privateKeyWif - Private key in WIF format
   * @returns {Promise<{ documentId: string, result: object }>}
   */
  async submitDocument(contractId, documentType, ownerId, data, privateKeyWif) {
    if (!this.isReady()) {
      throw new Error('SDK not connected');
    }

    this.updateStatus('loading', `Verifying contract ${contractId.substring(0, 12)}...`);

    // First verify the contract exists
    const contract = await this.verifyContract(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found on network. It may need more time to propagate, or the ID may be incorrect.`);
    }

    console.log('Contract verified, submitting document...');
    console.log('Contract document types:', Object.keys(contract.documentSchemas || contract.documents || {}));

    this.updateStatus('loading', `Submitting ${documentType} document...`);

    try {
      // API: documents.create({ contractId, type, ownerId, data, entropyHex, privateKeyWif })
      const result = await this.sdk.documents.create({
        contractId: contractId,
        type: documentType,
        ownerId: ownerId,
        data: data,
        entropyHex: generateEntropy(),
        privateKeyWif: privateKeyWif
      });

      const documentId = result.documentId || result.id || result;

      this.updateStatus('connected', `Document submitted: ${documentId}`);

      return {
        documentId,
        result
      };

    } catch (error) {
      this.updateStatus('error', `Document submission failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a data contract by ID
   * @param {string} contractId - The contract ID to fetch
   * @returns {Promise<object>}
   */
  async getContract(contractId) {
    if (!this.isReady()) {
      throw new Error('SDK not connected');
    }

    return await this.sdk.contracts.get({
      contractId
    });
  }

  /**
   * Query documents from a contract
   * @param {string} contractId - The contract ID
   * @param {string} documentType - Document type
   * @param {object} options - Query options (where, orderBy, limit, startAfter, startAt)
   * @returns {Promise<object[]>}
   */
  async queryDocuments(contractId, documentType, options = {}) {
    if (!this.isReady()) {
      throw new Error('SDK not connected');
    }

    this.updateStatus('loading', `Querying ${documentType} documents...`);

    try {
      // Build query params for the SDK
      const queryParams = {
        contractId,
        type: documentType,
        limit: options.limit || 10
      };

      // Add where clause if provided
      if (options.where) {
        queryParams.where = options.where;
      }

      // Add orderBy if provided
      if (options.orderBy) {
        queryParams.orderBy = options.orderBy;
      }

      console.log('Query params:', queryParams);

      const result = await this.sdk.documents.query(queryParams);

      this.updateStatus('connected', `Found ${result?.length || 0} documents`);

      return result;

    } catch (error) {
      this.updateStatus('error', `Query failed: ${error.message}`);
      throw error;
    }
  }
}

// Create and export singleton instance
export const sdkClient = new SdkClient();
