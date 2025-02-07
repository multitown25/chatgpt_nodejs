import Wallet from "../models/wallet-model.js";


const getWalletByCompanyId = async (companyId) => {
    const wallet = await Wallet.findOne({company: companyId});
    if (!wallet) throw new Error('Wallet not found');

    return wallet;
}