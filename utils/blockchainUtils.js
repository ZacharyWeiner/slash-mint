const bitcoinToSatoshis = (fractionOfBitcoin) => {
    try{
        // The number of satoshis in one bitcoin
        const satoshisInOneBitcoin = 100000000;

        // Calculate the number of satoshis in the given fraction of a bitcoin
        const satoshis = fractionOfBitcoin * satoshisInOneBitcoin;
    }catch(err){console.log("Error converting to satoshis: ", err.message)}
    // Return the result as an integer
    return Math.round(satoshis);
}

module.exports = {
    bitcoinToSatoshis
}