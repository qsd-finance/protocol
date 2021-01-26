const { ethers } = require("ethers");

const provider = new ethers.providers.JsonRpcProvider('');

const main = async () => {
  await provider.send("evm_increaseTime", [1440000]);
  await provider.send("evm_mine", []);
};

main();
