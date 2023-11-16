const axios = require('axios');
const {bitcoinToSatoshis} = require('./../utils/blockchainUtils')
async function fetchAddressForPaymail(paymail) {
    try {
        const url = `https://api.relayx.io/v1/paymail/run/${paymail}`;
        const response = await axios.get(url);
        console.log(response.data); // Log or process the response data as needed
        return response.data;
    } catch (error) {
        console.error('Error fetching data:', error.message);
    }
}

async function getTransactionDetails(tx_hash, minimumSats){
    const endpoint = `https://api.whatsonchain.com/v1/bsv/main/tx/hash/${tx_hash}`;
    let response;
    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        // Find an entry in vout with value of more than 10000
        const eligibleVout = data.vout.find(voutEntry => voutEntry.value * 100000000 > minimumSats);
        // If an eligible entry is found, return the txid, vout, and value
        if (eligibleVout) {
            const result = {
                txid: data.txid,
                vout: eligibleVout.n,
                value: bitcoinToSatoshis(eligibleVout.value)
            };
            return result;
        } else {
            console.log('No eligible entry found with value > 10000 in vout');
            return null;
        }
    } catch (error) {
        console.error('Error:', error);
    }
    return response;
}

const getUnspentTransaction = async(minimumSats, address) => {
    if(!address){return new Error("Address may not be null")}
    if(minimumSats < 2){ minimumSats = 2}
    const endpoint = `https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`;

    let response;
    let data; 
    let transactionDetails; 
    let error;

    try {response = await fetch(endpoint);}
    catch(err){ error = err; console.error(`Error in function fetch in getUnspentTransaction: ${err.message}`);}
    if(response){
        try {data = await response.json(); console.log(JSON.stringify(data))}
        catch(err){ error = err; console.error(`Error in function fetch in getUnspentTransaction: ${err.message}`);}
    }
    if(data){
        // Find an entry with a value of at least minimumSats
        const eligibleEntry = data.find(entry => (entry.value >= minimumSats));
        // If an eligible entry is found, use the tx_hash to get transaction details
        if (eligibleEntry) {
            try {transactionDetails = await getTransactionDetails(eligibleEntry.tx_hash, minimumSats);}
            catch(err){ error = err; console.error(`Error in function getTransactionDetails in getUnspentTransaction: ${err.message}`);}
        }
    }
    if(!transactionDetails){console.log("There were no eligable entries in getUnspentTransactions")}
    return transactionDetails;
}

module.exports = {
    fetchAddressForPaymail,
    getTransactionDetails,
    getUnspentTransaction
}