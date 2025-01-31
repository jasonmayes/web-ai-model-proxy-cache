import fetchInChunks from '/FetchInChunks.js';

let FileProxyCache = function () {
  // Default shard size is 128MB.
  let cacheShardSize = 134217728; // Bytes.
  let cacheName = 'JMWebAIModels';
  let cacheDebug = false;


  function setName(name) {
    cacheName = name;
  }


  function setShardSize(bytes) {
    cacheShardSize = bytes;
  }


  function enableDebug(bool) {
    cacheDebug = bool;
  }


  async function cacheIt(blob, fileUrl) {
    try {
      const MODEL_CACHE = await caches.open(cacheName);
      let n = 0;
      for (let i = 0; i < blob.size; i+= cacheShardSize) {
        let blobShard = undefined;
        // Ensure not last chunk which may be less than shard size.
        if (i + cacheShardSize > blob.size) {
          blobShard = blob.slice(i, blob.size, 'binary/octet-stream');
        } else {
          blobShard = blob.slice(i, i + cacheShardSize, 'binary/octet-stream');
        }
        await MODEL_CACHE.put(MD5(fileUrl) + '-' + n, new Response(blobShard));
        n++;
      }
      await MODEL_CACHE.put(MD5(fileUrl), new Response(n));
      if (cacheDebug) {
        console.log('Cached: ' + fileUrl);
      }
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error(err.name, err.message);
      return URL.createObjectURL(blob);
    }
  }
  
  
  async function fetchAndCacheFile(url, progressCallback) {
    let blob = undefined;
    try {
      blob = await fetchInChunks(url, {
        chunkSize: 5 * 1024 * 1024,
        maxParallelRequests: 10,
        progressCallback: (done, total) => (progressCallback('Loading Web AI Model file: ' + Math.round((done / total) * 100) + '%'))
      });
      if (cacheDebug) {
        console.log('Caching: ' + url);
      }
      return cacheIt(blob, url);
    } catch(e) {
      // File not availble return null;
      console.warn('File does not exist! Returning null object.');
      return null;
    }
  };
  
  
  async function fetchFile(url, progressCallback) {
    if (cacheDebug) {
      console.log('Attempting to fetch: ' + url + ' from cache.');
    }
    try {
      const MODEL_CACHE = await caches.open(cacheName);
      const MD5_FILE_HASH = MD5(url);
      const response = await MODEL_CACHE.match(MD5_FILE_HASH);
      let blobParts = [];
      
      if (!response) {
        console.warn('Requested file not in cache - attempting to fetch and then cache.');
        return await fetchAndCacheFile(url, progressCallback);
      } else {
        const file = await response.blob();
        let n = parseInt(await file.text());
        for (let i = 0; i < n; i++) {
          const part = await MODEL_CACHE.match(MD5_FILE_HASH + '-' + i);
          blobParts.push(await part.blob());
        }
        
        let concatBlob = new Blob(blobParts, {type: 'binary/octet-stream'});
        return await URL.createObjectURL(concatBlob);
      }
    } catch (err) {
      console.error(err);
    }
  };
  return {
    loadFromURL: fetchFile,
    setName: setName,
    setShardSize: setShardSize,
    enableDebug: enableDebug
  };
}();

export default FileProxyCache;
