import { ethers } from "hardhat";
const { provider } = ethers;
const { parseEther } = ethers.utils;

const dollarAddr = '0x96e3c8Fa6DE75712cca47B0db0Bd559aaa7Ac416';
const governanceTokenAddr = '0x6F341b6Ff1a7A72A7E6c3fa1748afc2fb31E0d0A';

const treasuryAddr = '0x247C08e7f043B960457676516A3258484aD8e7Bb';
const DAI = '0xe9e7cea3dedca5984780bafc599bd69add087d56'  //BUSD

const uniV2PairAddress = 

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

