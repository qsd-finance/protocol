import { ethers } from "hardhat";
const { provider } = ethers;
const { parseEther } = ethers.utils;

/*
{"claim":"0x50AA74434a536bf45eA82E9a460aD743dABDEE97",
"dollar":"0xE8F12Efeb864b152AbBf6826338516746BB70820",
"governanceToken":"0x97f721c18166eeb5Dee72873fd07bfD1b4D5F3A4"}
*/


const dollarAddr = '0xE8F12Efeb864b152AbBf6826338516746BB70820';
const governanceTokenAddr = '0x97f721c18166eeb5Dee72873fd07bfD1b4D5F3A4';

const treasuryAddr = '0x247C08e7f043B960457676516A3258484aD8e7Bb';
const DAI = '0xe9e7cea3dedca5984780bafc599bd69add087d56'  //BUSD

const uniV2PairAddress = '0x83ABc20d35Fc4C0ACF5d61f026107c94788373fA'

  const main = async () => {
    const owner = await provider.getSigner(0);
    const user1 = await provider.getSigner(1);
  
    const ownerAddress = await owner.getAddress();
    const user1Address = await user1.getAddress();
    console.log("ownerAddress  "+ownerAddress);
    console.log("user1Address  "+user1Address);

    //const dollar = new ethers.Contract(dollarAddr, dollarabi, provider)
    const dollar = await ethers.getContractAt("Dollar", dollarAddr)
    //const governanceToken = new ethers.Contract(governanceTokenAddr, govabi, provider)
    const governanceToken = await ethers.getContractAt("Governance", governanceTokenAddr)
    
    // 3. Deploy implementation and dao
    console.log('deploy implementation')
    const impl = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 6000000 }));
    console.log('deploy root')
    const root = await ethers.getContractFactory("Root").then(x => x.deploy(impl.address, { gasLimit: 6000000 }));
    const dao = await ethers.getContractAt("Implementation", root.address);

    // Change minter role
    console.log('change minter role for dollar to dao')
    await dollar.addMinter(dao.address,{ gasLimit: 6000000 });
    await dollar.renounceMinter({ gasLimit: 6000000 });

    console.log('change minter role for gov to dao')
    await governanceToken.addMinter(dao.address,{ gasLimit: 6000000 });
    await governanceToken.renounceMinter({ gasLimit: 6000000 });

      // 4. Deploy pool contracts

    // Bonding pool, you stake Dollars, and get Dollars OR Governance token as a reward
    // Don't want it to auto-compound
    console.log('do some poolBonding shit')
    const poolBonding = await ethers
      .getContractFactory("PoolBonding")
      .then(x => x.deploy(dao.address, dollar.address, dollar.address, governanceToken.address, { gasLimit: 6000000 }));
      console.log('do some poolLP shit')
    const poolLP = await ethers
      .getContractFactory("PoolLP")
      .then(x => x.deploy(dao.address, uniV2PairAddress, dollar.address, { gasLimit: 6000000 }));
      console.log('do some PoolGov shit')
    const poolGov = await ethers
      .getContractFactory("PoolGov")
      .then(x => x.deploy(dao.address, governanceToken.address, dollar.address, { gasLimit: 6000000 }));

    // 5. Initialize dao
    console.log('dao init tokenaddr')
    await dao.initializeTokenAddresses(dollar.address, governanceToken.address, { gasLimit: 6000000 });
    console.log('dao init oracle')
    await dao.initializeOracle({ gasLimit: 6000000 });
    console.log('dao initpooladdress')
    await dao.initializePoolAddresses(poolBonding.address, poolLP.address, poolGov.address, { gasLimit: 6000000 });
    
    
    console.log(JSON.stringify(
      {
        dao: dao.address,
        poolBonding: poolBonding.address,
        poolLP: poolLP.address,
        poolGov: poolGov.address,
        dollar: dollar.address,
        governanceToken: governanceToken.address,
        uniV2PairAddress,
        implementation: impl.address,
        root: root.address,
      },
    ))
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

<<<<<<< HEAD
*/
=======
*/
>>>>>>> 7239dd778b860df4c8f986c46fc9eb0642883098
