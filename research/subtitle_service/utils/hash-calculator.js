const crypto = require('crypto');
const fs = require('fs');

/**
 * Calculate SubDB/TheSubDB compatible hash from video file
 * Hash is MD5 of first 64KB + last 64KB of file
 * 
 * @param {string} filePath - Path to video file
 * @returns {Promise<string>} - MD5 hash string
 */
function calculateSubDBHash(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const readSize = 64 * 1024; // 64KB
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            
            if (fileSize < readSize * 2) {
                reject(new Error('File too small for hash calculation (minimum 128KB)'));
                return;
            }
            
            const firstChunk = Buffer.alloc(readSize);
            const lastChunk = Buffer.alloc(readSize);
            
            const fd = fs.openSync(filePath, 'r');
            
            try {
                // Read first 64KB
                fs.readSync(fd, firstChunk, 0, readSize, 0);
                
                // Read last 64KB
                fs.readSync(fd, lastChunk, 0, readSize, fileSize - readSize);
                
                fs.closeSync(fd);
                
                // Combine chunks and calculate MD5
                const combined = Buffer.concat([firstChunk, lastChunk]);
                const hash = crypto.createHash('md5').update(combined).digest('hex');
                
                resolve(hash);
            } catch (readError) {
                fs.closeSync(fd);
                reject(readError);
            }
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Calculate OpenSubtitles compatible hash from video file
 * Uses file size + 64-bit checksum of first and last 64KB
 * 
 * @param {string} filePath - Path to video file
 * @returns {Promise<string>} - OpenSubtitles hash string
 */
function calculateOpenSubtitlesHash(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            const chunkSize = 64 * 1024; // 64KB
            
            if (fileSize < chunkSize * 2) {
                reject(new Error('File too small for OpenSubtitles hash (minimum 128KB)'));
                return;
            }
            
            let hash = fileSize;
            const fd = fs.openSync(filePath, 'r');
            
            try {
                // Read first 64KB chunk
                const firstChunk = Buffer.alloc(chunkSize);
                fs.readSync(fd, firstChunk, 0, chunkSize, 0);
                
                // Read last 64KB chunk
                const lastChunk = Buffer.alloc(chunkSize);
                fs.readSync(fd, lastChunk, 0, chunkSize, fileSize - chunkSize);
                
                fs.closeSync(fd);
                
                // Calculate checksum for both chunks
                for (let i = 0; i < chunkSize; i += 8) {
                    // Sum 8-byte integers from both chunks
                    hash += firstChunk.readBigUInt64LE(i);
                    hash += lastChunk.readBigUInt64LE(i);
                }
                
                // Convert to 16-digit hex string
                const hashStr = (hash & 0xFFFFFFFFFFFFFFFF).toString(16).padStart(16, '0');
                resolve(hashStr);
                
            } catch (readError) {
                fs.closeSync(fd);
                reject(readError);
            }
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate example hashes for testing (when no video files available)
 * These are realistic-looking but fake hashes for API testing
 */
function generateTestHashes() {
    const testHashes = [];
    
    for (let i = 0; i < 5; i++) {
        // Generate SubDB-style hash (32 char MD5)
        const subdbHash = crypto.randomBytes(16).toString('hex');
        
        // Generate OpenSubtitles-style hash (16 char hex)
        const osHash = crypto.randomBytes(8).toString('hex');
        
        testHashes.push({
            subdb: subdbHash,
            opensubtitles: osHash
        });
    }
    
    return testHashes;
}

/**
 * Validate if a string looks like a valid hash
 */
function validateHash(hash, type = 'subdb') {
    if (!hash || typeof hash !== 'string') {
        return false;
    }
    
    switch (type.toLowerCase()) {
        case 'subdb':
        case 'thesubdb':
            // MD5 hash: 32 hex characters
            return /^[a-f0-9]{32}$/i.test(hash);
            
        case 'opensubtitles':
            // OpenSubtitles hash: 16 hex characters
            return /^[a-f0-9]{16}$/i.test(hash);
            
        default:
            return false;
    }
}

/**
 * Get file information for debugging
 */
function getFileInfo(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return {
            exists: true,
            size: stats.size,
            sizeKB: Math.round(stats.size / 1024),
            sizeMB: Math.round(stats.size / (1024 * 1024)),
            canCalculateHash: stats.size >= (64 * 1024 * 2)
        };
    } catch (error) {
        return {
            exists: false,
            error: error.message
        };
    }
}

module.exports = {
    calculateSubDBHash,
    calculateOpenSubtitlesHash,
    generateTestHashes,
    validateHash,
    getFileInfo
}; 