require('dotenv').config();
(async () => {
    const chalk = await import('chalk').then(module => module.default);

    console.log(chalk.green('Hello, world!'));

const { JungleBusClient, ControlMessageStatusCode } = require("@gorillapool/js-junglebus");
const {fetchAddressForPaymail, getUnspentTransaction } = require('./api/api')
const axios = require('axios');
const fs = require('fs');
const { admin, db } = require('./firebaseAdmin');
const { createOrdinal, sendOrdinal, sendUtxos } = require('js-1sat-ord');
const {PrivateKey, P2PKHAddress} = require('bsv-wasm');
const path = require('path');
const paymentWif = process.env.PAYMENT_PRIVATE_KEY;
const paymentPk = PrivateKey.from_wif(paymentWif);
const changeAddress = process.env.PAYMENT_CHANGE_ADDRESS;
//const ordinalDestinationAddress  = "1EPpfs5kh84BZzdwKVnFxyjgWNU8ofqoBy";
const triggerText = "/mint"
let isRunning = false;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Create an instance of axios with default configuration
const axiosInstance = axios.create({
  // You can set base URLs, headers, timeout limits, etc.
});

// A simple in-memory cache to store responses
const responseCache = new Map();

// Utility function to check if the content type is text
const isTextContentType = (contentType) => {
  return contentType && contentType.startsWith('text');
};

// const saveContentLock = async (txid, satoshis, lockedInBlock, lockDuration, contentTxid, content, author) => {
//   try{
//         const contentLocksRef = db.collection('contentLocks').doc(txid);

//           // Check if the document already exists
//           const doc = await contentLocksRef.get();
//           if (!doc.exists) {
//             // If the document doesn't exist, create a new one
//             await contentLocksRef.set({
//               txid,
//               satoshis,
//               lockedInBlock,
//               lockDuration,
//               contentTxid,
//               content,
//               author
//           });
//             console.log(chalk.greenBright('Content lock saved:', txid));
//         } else {
//             // If the document already exists, log a message
//             console.log(chalk.redBright('Content lock already exists:', txid));
//         }
//     } catch(err){console.log("There was an error saving the content lock", err.message)}
// };

const saveContentLock = async (txid, satoshis, lockedInBlock, lockDuration, contentTxid, content, author) => {
    console.log(chalk.bgCyan("Beginning Save", txid, satoshis, lockedInBlock, lockDuration, contentTxid, content, author))
    try {
      // References to the collections
      const contentCollectionRef = db.collection('contentCollection');
      const likesCollectionRef = db.collection('likesCollection').doc(txid);
  
      // Check if content exists
      const contentDoc = await contentCollectionRef.doc(contentTxid).get();
      if (!contentDoc.exists) {
        // Save the content if it doesn't exist
        await contentCollectionRef.doc(contentTxid).set({
          contentTxid,
          content,
          author: author ? author : "",
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(chalk.bgGreen('Content saved:', contentTxid));
      } else {
        console.log(chalk.bgYellow('Content already exists:', contentTxid));
      }
  
      // Check if the like already exists
      const likeDoc = await likesCollectionRef.get();
      if (!likeDoc.exists) {
        // Save the like if it doesn't exist
        await likesCollectionRef.set({
          txid,
          contentTxid,
          satoshis,
          lockedInBlock,
          lockDuration,
          contentAuthor: author ? author : "",
          contentRef: contentCollectionRef.doc(contentTxid),  // Reference to the content
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(chalk.bgGreen('Like saved:', txid));
      } else {
        console.log(chalk.bgYellow('Like already exists:', txid));
      }
    } catch (err) {
      console.log(chalk.bgRed("There was an error", err.message));
    }
  };

async function updateLockStatistics(newLockBitcoins, newLockBlocks) {
    if(newLockBlocks < 0){newLockBlocks = 0};
    console.log("Starting to update Lock Statistics")
    const statsRef = db.collection('lockStatistics').doc('total');
    console.log("Got statsRef from firebase");
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(statsRef).catch(err => {
                console.error("Error getting document:", err);
                throw err; // Throw error to be caught by outer try-catch
            });
            console.log("Got doc from firebase");
            if (!doc.exists) {
                return transaction.set(statsRef, { totalLocks: 1, totalBitcoins: newLockBitcoins, totalBlocks: newLockBlocks });
            } else {
                const data = doc.data();
                return transaction.update(statsRef, {
                    totalLocks: (data.totalLocks || 0) + 1,
                    totalBitcoins: (data.totalBitcoins || 0) + (newLockBitcoins || 0),
                    totalBlocks: (data.totalBlocks || 0) + (newLockBlocks || 0)
                });
            }
        });
        console.log('Lock statistics updated!');
    } catch (error) {
        console.error('Transaction failed:', error);
    }
}



// Example function to update a document in Firestore
const updateTotalCoinsLocked = async (txid, additionalSatoshis) => {
  const transactionRef = db.collection('transactions').doc(txid);
  await transactionRef.update({
    satoshis: admin.firestore.FieldValue.increment(additionalSatoshis)
});
};

function getImageAsBase64(filePath) {
    try{
        console.log('Starting to read file:', filePath);
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    // Determine MIME type based on file extension
                    const mimeType = getMimeType(filePath);
                    const base64Image = `data:${mimeType};base64,${data.toString('base64')}`;
                    resolve(base64Image);
                }
            });
        });
    }  catch(error){
        console.log("There was an error getting the image as base 64:", error.message)
    } 
    
}

function saveBase64AsFile(base64Image, outputFilePath) {
    try{
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
        const dataBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFile(outputFilePath, dataBuffer, (err) => {
            if (err) {
                console.log("Error saving image:", err);
            } else {
                console.log("Image saved:", outputFilePath);
            }
        });
    }
    catch(err){console.log("There was an error saving the file:", error.message)}
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
    case '.jpg':
    case '.jpeg':
        return 'image/jpeg';
    case '.png':
        return 'image/png';
        // Add other cases as needed
    default:
            return 'application/octet-stream'; // Fallback MIME type
        }
    }

const mintOrdinal = async (input) => {
    console.log("mint hit", input)
    try {
        let paymail;
        try{ paymail = await fetchAddressForPaymail(input);}catch(err){"Error fetching address for paymail", err.message};
        console.log(paymail.data);
        const imagePath = path.join(__dirname, '/mint/images/icecream_small.jpg'); // Replace with your image path
        console.log(imagePath);
        //let img = await getImageAsBase64(imagePath);

        getImageAsBase64(imagePath)
        .then(async base64Image => {
            try{
                saveBase64AsFile(base64Image, path.join(__dirname, "/TEST.jpeg"));
                let mimePopped = base64Image.split(';base64,').pop();
                //console.log(img);
                // inscription
                const inscription =  { dataB64: mimePopped,  contentType: "image/jpeg"}
                try{
                    let utxoResponse = await getUnspentTransaction(1000, changeAddress)
                }catch(err){console.log("There was an error getting the utxoResponse" , err.message)}
                
                console.log(utxoResponse)
                const inscriptionInputTxid = utxoResponse?.txid ? utxoResponse?.txid : 0;
                const satoshiCount = utxoResponse?.value ? utxoResponse.value : 0;
                const vout = utxoResponse?.vout ? utxoResponse?.vout : 0;
                let p2Script = P2PKHAddress.from_string(changeAddress ? changeAddress : '' );

                const utxoDetails = {
                    satoshis: satoshiCount,
                    txid: inscriptionInputTxid,
                    script: p2Script.get_locking_script().to_asm_string(),
                    vout: vout,
                };
                    // // returns Promise<Transaction>
                const ordinalForBroadcast = await createOrdinal(utxoDetails, ordinalDestinationAddress, paymentPk, changeAddress, 0.001, inscription);
                console.log(ordinalForBroadcast.to_hex());
                console.log(ordinalForBroadcast.to_hex().length);
                try{}catch(err){"There was a error broadcasting the ordinal ", err.message}
                let response = await fetch("https://api.whatsonchain.com/v1/bsv/main/tx/raw", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        txhex: ordinalForBroadcast.to_hex()
                    })
                })
                    // Check if the request was successful
                if (response.ok) {
                      // Parse the response as JSON
                  let data = await response.json();
                  console.log("Ordinal Broadcast response.data", data);
                } else {
                  console.log("HTTP-Error: " + response.status);
                };
                if(response.status === 400){console.log('400 Error')}
                else{
                  console.log(ordinalForBroadcast.get_id_hex())
                  console.log("Minted Ordinal Response:", response);
                  return ordinalForBroadcast.get_id_hex();
                }
                
            
                return response;
            
            }catch(err){
                "There was an error saving the base64 file in mint:", err.message
            }
            
        })
        .catch(error => {
            console.error('Error:', error);
        });
        

    } catch (error) {
        console.error('Error in MintOrdinal:', error);
    }
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
        console.log("BLOCK DONE", message.block);
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
    console.log(chalk.green("Pushing new tx into the stack"))
    // transactionsToInspect.push(tx)
    try{
        let {lockedForBlocks, satoshisLocked} = await processTransaction(tx)
        console.log(chalk.cyan(`Updating Stats - Total Blocks Locked: ${lockedForBlocks} Total Satoshis: ${satoshisLocked}`))
        if(satoshisLocked || lockedForBlocks){
            try{
                let bitcoinLocked = satoshisLocked / 100000000;
                await updateLockStatistics(bitcoinLocked, lockedForBlocks) 
                console.log(chalk.cyan(`Updated Stats`))
            }catch(err){"There was an error updating the stats: ", err.message}
        }
    }catch(err){console.log("Error in main: ", err.message)}
    
};

const processTransaction = async (tx) => {
    delay(1000)
    let lockID = tx.id;
    let lockedTo; 
    let lockerHandle; 
    let lockedUntil;
    let satoshisLocked;
    let lockedInBlock;
    let lockedForBlocks;
    let contentAuthor;

    // 1: We get a streaming feed of lock transactions. 
    // Generally the lock is in the _0 outout and the context (MAP DATA) is in the _1 output 
    // 2: Get information about all of the outputs in the transaction with a lock
    console.log(chalk.green("Repsponding to a new Lock with TransactionID: ", tx.id));
    try{
        const locksResponse = await axiosInstance.get(`https://locks.gorillapool.io/api/locks/txid/${tx.id}`);
        locksResponseData = locksResponse.data;
    } catch(err){
        console.log(chalk.red("Error getting lock for txid ", tx.id));
        return {};
    }
    try {
        
        // 3: Check if the lock is significant.
        //   If not - do nothing
        //   If it is then lets take a look at what they were locking to. 
        satoshisLocked = locksResponseData[0].satoshis
        console.log({satoshisLocked});
        if (locksResponseData && locksResponseData.length > 1 && satoshisLocked > 1000) {
            console.log(chalk.blue("This lock is significant... "));
            lockedInBlock = locksResponseData[0].height;
            lockedUntil = locksResponseData[0].data?.lock?.until
            lockedForBlocks = lockedUntil - lockedInBlock
            console.log(chalk.blue(`Locked in Block ${lockedInBlock} Until: ${lockedUntil} For ${lockedForBlocks} Blocks`))

            // 4: Retrieve the output with the data/context 
            const hasContext = locksResponseData[1];
            console.log(hasContext? "has context" : "no context");
            // 5: Check to make sure that there is map data in this output, and that it refrences another transaction
            if (hasContext.data && hasContext.data.map && 'tx' in hasContext.data.map) {
                console.log("Has Context References txid: ", hasContext.data.map.tx);
                let contentTx = hasContext.data.map.tx;
                lockedTo = contentTx;
                // 6: fetch the content of the referenced transaction
                let ordinalResponse;

                try{
                    ordinalResponse = await axiosInstance.get(`https://v3.ordinals.gorillapool.io/content/${contentTx}`, { responseType: 'arraybuffer' });
                }catch(err){
                    console.log("error fetching the content:", err.message)
                }

                const contentType = ordinalResponse.headers['content-type'];
                console.log({contentType});
                // Check the Content-Type of the response
                if (ordinalResponse && isTextContentType(contentType)) {
                    console.log("is text");
                    // If it's text, it's safe to convert to string
                    const content = Buffer.from(ordinalResponse.data).toString();
                        // check to make sure its not an image. 
                    if (!content.includes(';base64,')){ //&& content.includes(triggerText)) {
                        console.log("has mint");
                        const mapDataResponse = await axiosInstance.get(`https://locks.gorillapool.io/api/txos/${contentTx}_1`);
                        // NOTE: At this point we have the content to which the lock has been applied.
                        //.      Details about the lock its self
                        console.log( "mint command ",  "got a lock of ",  locksResponseData[0].satoshis, "satoshis - ", "comand-author:", mapDataResponse.data.data.map.paymail, "content:", content);
                        contentAuthor = mapDataResponse.data.data.map.paymail;
                        const state = {
                            lockTxid: tx.id,
                            satoshisLocked: locksResponseData[0].satoshis,
                            contentTxid: contentTx,
                            postContent: content,
                            locks: locksResponseData,
                            commandAuthor: contentAuthor,
                            lockerHandle: hasContext.data.map.paymail
                        };
                        let exists = false;//await checkTransactionIdExists(tx.id, servicedTxPath);
                        if(exists){
                            console.log("This txid exists in the file", tx.id);
                        }else{
                            //await mintOrdinal(mapDataResponse.data.data.map.paymail);
                            try{
                                await saveContentLock(tx.id, locksResponseData[0].satoshis, lockedInBlock, lockedForBlocks, contentTx, content, contentAuthor) 
                                delay(1000)   
                            }catch(err){console.log("error saving contentLock:", err.message)};
                            //appendToFile(filePath, state);
                            //appendToFile(servicedTxPath, tx.id);
                            console.log("Minted and saved to file")
                        }

                    }
                } else {
                    console.log(chalk.yellow(`The content of the post that received the lock is of type '${contentType}' and cannot be displayed as text.`));
                }
            }
        }
    } catch (error) {
        console.error(chalk.red("Error handling published transaction:", error.message));
    }
    return {lockedForBlocks, satoshisLocked};

}


(async () => {
    try {
        await client.Subscribe(
            process.env.GORILLA_POOL_SUBSCRIPTION_KEY,
            807700,
            onPublish,
            onStatus,
            onError
            );
    } catch (error) {
        console.error("Error during subscription:", error.message);
    }
})();
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.bgMagenta('Unhandled Rejection at:', promise, 'reason:', reason));
    // Application specific logging, throwing an error, or other logic here
  });
})();