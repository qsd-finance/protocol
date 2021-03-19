import { ethers } from "hardhat";
const { provider } = ethers;
const { parseEther } = ethers.utils;

const treasuryAddr = '0x247C08e7f043B960457676516A3258484aD8e7Bb';

  const main = async () => {
    const owner = await provider.getSigner(0);
    const user1 = await provider.getSigner(1);
  
    const ownerAddress = await owner.getAddress();
    const user1Address = await user1.getAddress();
    console.log("ownerAddress  "+ownerAddress);
    console.log("user1Address  "+user1Address);


    // 1. Deploy tokens and oracle
    console.log('Deploying Dollar');
    const dollar = await ethers.getContractFactory("Dollar").then(x => x.deploy());
    console.log('Deploying gov token');
    const governanceToken = await ethers.getContractFactory("Governance").then(x => x.deploy());

    // 2. deploy claim contract
    console.log('deploying claim contract');
    const claim = await ethers.getContractFactory("Claims").then(x => x.deploy(treasuryAddr, dollar.address, governanceToken.address));

    // 3. mint tokens to claim contract
    console.log('minting qsd to claims');
    await dollar.mint(claim.address, '1050140860000000000000000');
    console.log('minting qsdg to claim contract');
    await governanceToken.mint(claim.address, '14342400000000000000000');
    
    

    console.log(JSON.stringify({
        claim: claim.address,
        dollar: dollar.address,
        governanceToken: governanceToken.address,
    }))
  }

  main();


  