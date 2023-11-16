require('dotenv').config();
const { JungleBusClient, ControlMessageStatusCode } = require("@gorillapool/js-junglebus");
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const filePath = path.join(__dirname, 'state.txt');

// Create an instance of axios with default configuration
const axiosInstance = axios.create({
  // You can set base URLs, headers, timeout limits, etc.
});

// A simple in-memory cache to store responses
const responseCache = new Map();


// Function to append state to the file
const appendStateToFile = async (state) => {
    try {
        const stateString = JSON.stringify(state, null, 2) + '\n';
        await fs.appendFile(filePath, stateString);
    }
    catch{console.log("Error writing to file")}
  
};

const client = new JungleBusClient("junglebus.gorillapool.io", {
    useSSL: true,
    onConnected(ctx) {
        console.log("CONNECTED", ctx);
    },
    onConnecting(ctx) {
        console.log("CONNECTING", ctx);
    },
    onDisconnected(ctx) {
        console.log("DISCONNECTED", ctx);
    },
    onError(ctx) {
        console.error("Error:", ctx);
    },
});

const onStatus = function(message) {
    if (message.statusCode === ControlMessageStatusCode.BLOCK_DONE) {
        //console.log("BLOCK DONE", message.block);
    } else if (message.statusCode === ControlMessageStatusCode.WAITING) {
        console.log("WAITING FOR NEW BLOCK...", message);
    } else if (message.statusCode === ControlMessageStatusCode.REORG) {
        console.log("REORG TRIGGERED", message);
    } else if (message.statusCode === ControlMessageStatusCode.ERROR) {
        console.error("Error message:", message);
    }
};

const onError = function(err) {
    console.error("Error:", err);
};

const onMempool = function(tx) {
    console.log("MEMPOOL TRANSACTION", tx);
};

const onPublish = async function(tx) {
    let lockID = tx.id;
    let lockedTo; 
    let lockerHandle; 
    let lockedToHandle; 

    // 1: We get a streaming feed of lock transactions. 
    // Generally the lock is in the _0 outout and the context (MAP DATA) is in the _1 output 
    // 2: Get information about all of the outputs in the transaction with a lock
  //console.log("Repsponding to a new Lock with TransactionID: ", tx.id);
  try {
    let locksResponseData;
    if (responseCache.has(tx.id)) {
      locksResponseData = responseCache.get(tx.id);
    } else {
      const locksResponse = await axiosInstance.get(`https://locks.gorillapool.io/api/locks/txid/${tx.id}`);
      locksResponseData = locksResponse.data;
      responseCache.set(tx.id, locksResponseData); // Cache the response
    }
    // At this point the locksResponse should be an array of the outputs 

     // 3: Check if the lock is significant.
    //   If not - do nothing
    //   If it is then lets take a look at what they were locking to. 
    if (locksResponseData && locksResponseData.length > 1 && locksResponseData[0].satoshis > 1000) {
      // 4: Retrieve the output with the data context 
      const hasContext = locksResponseData[1];
      // 5: Check to make sure that there is map data in this output, and that it refrences another transaction
      if (hasContext.data && hasContext.data.map && 'tx' in hasContext.data.map) {
        let contentTx = hasContext.data.map.tx;
        lockedTo = contentTx;
        // 6: fetch the content of the referenced transaction
        const contentResponse = await axiosInstance.get(`https://v3.ordinals.gorillapool.io/content/${contentTx}`, { responseType: 'arraybuffer' });
        const contentType = contentResponse.headers['content-type'];

        // If you want to you can check the Content-Type of the
        // response before continuing.
    
        // If it's text, it's safe to convert to string
        const content = Buffer.from(contentResponse.data).toString();
        // check to make sure its not an image. 
      
        const mapDataResponse = await axiosInstance.get(`https://locks.gorillapool.io/api/txos/${contentTx}_1`);
        // NOTE: At this point we have the content to which the lock has been applied.
        //.      Details about the lock its self
        lockerHandle = hasContext?.data?.map?.paymail ? hasContext.data.map.paymail : mapDataResponse.data.data.map.paymail;
        lockedToHandle = mapDataResponse.data.data.map.paymail
        console.log(lockedToHandle, "got a lock of ",  locksResponseData[0].satoshis, "satoshis from ", lockerHandle, "on:", content);            
        
        const state = {
          lockTxid: tx.id,
          satoshisLocked: locksResponseData[0].satoshis,
          contentTxid: lockedTo,
          postContent: content,
          locks: locksResponseData,
          postAuthor: mapDataResponse.data.data.map.paymail,
          lockerHandle: lockerHandle
        };
        await appendStateToFile(state);
      }
    }
  } catch (error) {
    console.error("Error handling published transaction:", error.message);
  }
};


(async () => {
    try {
        await client.Subscribe(
            "",
            817415,
            onPublish,
            onStatus,
            onError
        );
    } catch (error) {
        console.error("Error during subscription:", error.message);
    }
})();
