
import { ethers } from "hardhat";
const { provider } = ethers;
const { parseEther } = ethers.utils;

const dollarAddr = '0xE8F12Efeb864b152AbBf6826338516746BB70820'
const governanceTokenAddr = '0x97f721c18166eeb5Dee72873fd07bfD1b4D5F3A4'
const poolBondingAddr = '0x1Dcf6be37F1841aD5b986b2214F9E1e27D8e94d5'
const implAddress = '0x758fF0e49f5710392736A626815ff10915059eCf'
const poolLPAddr = '0xB0819e5a5db7E82697F8549a53965a354a0871F9'
const poolGovAddr = '0x6c7041DE3a2B3Db37cfAe9DF167b95e7a02CcA00'

const main = async () => {
    const owner = await provider.getSigner(0);
    const user1 = await provider.getSigner(1);
  
    const ownerAddress = await owner.getAddress();
    const user1Address = await user1.getAddress();
    console.log("ownerAddress  "+ownerAddress);
    console.log("user1Address  "+user1Address);

    const dollar = await ethers.getContractAt("Dollar", dollarAddr)
    const governanceToken = await ethers.getContractAt("Governance", governanceTokenAddr)
    const poolBonding = await ethers.getContractAt("PoolBonding", poolBondingAddr)
    const poolLP = await ethers.getContractAt("PoolLP", poolLPAddr)
    const poolGov = await ethers.getContractAt("PoolGov", poolGovAddr)
    const impl = await ethers.getContractAt("Implementation", implAddress)

    const dao = await ethers.getContractAt("Implementation", impl.address);

    console.log('dao init tokenaddr')
    await dao.initializeTokenAddresses(dollar.address, governanceToken.address, { gasLimit: 6000000 });
    console.log('dao init oracle')
    await dao.initializeOracle({ gasLimit: 6000000 });
    console.log('dao initpooladdress')
    await dao.initializePoolAddresses(poolBonding.address, poolLP.address, poolGov.address, { gasLimit: 6000000 });

}

main();

/*

{"dao":"0x0a28D6F9a63739176B36Eba95B0c95df360691E5",
"poolBonding":"0x1Dcf6be37F1841aD5b986b2214F9E1e27D8e94d5",
"poolLP":"0xB0819e5a5db7E82697F8549a53965a354a0871F9",
"poolGov":"0x6c7041DE3a2B3Db37cfAe9DF167b95e7a02CcA00",
"dollar":"0xE8F12Efeb864b152AbBf6826338516746BB70820",
"governanceToken":"0x97f721c18166eeb5Dee72873fd07bfD1b4D5F3A4",
"uniV2PairAddress":"0x83ABc20d35Fc4C0ACF5d61f026107c94788373fA",
"implementation":"0x758fF0e49f5710392736A626815ff10915059eCf",
"root":"0x0a28D6F9a63739176B36Eba95B0c95df360691E5"}

*/