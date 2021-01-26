import dotenv from "dotenv";

import path from "path";
import { ethers } from "ethers";
const { parseEther } = ethers.utils;

const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const UNISWAP_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

const TREASURY_ADDRESS = "0x61c32f08B0cbe61feF4166f09363504b4b5F38d8";

const PRIVATE_KEY = process.env['PRIVATE_KEY'];
const RPC_URL = process.env["RPC_URL"]

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const user = new ethers.Wallet(PRIVATE_KEY, provider);

const blockchainFuture = async () => {
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);

  return block.timestamp + 6000;
};

const getFastGasPrice = async () => {
  const gasPrice = await provider.getGasPrice();
  return gasPrice.mul(ethers.BigNumber.from(170)).div(ethers.BigNumber.from(100));
};

import ImplementationArtifact from "../artifacts/contracts/dao/Implementation.sol/Implementation.json";
import RootArtifact from "../artifacts/contracts/dao/Root.sol/Root.json";
import DollarArtifact from "../artifacts/contracts/token/Dollar.sol/Dollar.json";
import GovernanceArtifact from "../artifacts/contracts/token/Governance.sol/Governance.json";
import UniswapV2RouterArtifact from "../artifacts/contracts/external/UniswapV2Router.sol/IUniswapV2Router02.json";
import UniswapFactoryArtifact from "../artifacts/@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol/IUniswapV2Factory.json";
import PoolBondingArtifact from "../artifacts/contracts/oracle/pool-bonding/Pool.sol/PoolBonding.json";
import PoolLpArtifact from "../artifacts/contracts/oracle/PoolLP.sol/PoolLP.json";
import PoolGovArtifact from "../artifacts/contracts/oracle/PoolGov.sol/PoolGov.json";

const DEPLOYED = {};

const main = async () => {
  // Contract Factories
  const Dollar = new ethers.ContractFactory(DollarArtifact.abi, DollarArtifact.bytecode, user);
  const Governance = new ethers.ContractFactory(GovernanceArtifact.abi, GovernanceArtifact.bytecode, user);
  const Implementation = new ethers.ContractFactory(ImplementationArtifact.abi, ImplementationArtifact.bytecode, user);
  const Root = new ethers.ContractFactory(RootArtifact.abi, RootArtifact.bytecode, user);

  const PoolBonding = new ethers.ContractFactory(PoolBondingArtifact.abi, PoolBondingArtifact.bytecode, user);
  const PoolLp = new ethers.ContractFactory(PoolLpArtifact.abi, PoolLpArtifact.bytecode, user);
  const PoolGov = new ethers.ContractFactory(PoolGovArtifact.abi, PoolGovArtifact.bytecode, user);

  // 1. Deploy tokens and oracle
  const dollar = await Dollar.deploy({ gasPrice: await getFastGasPrice() });
  await dollar.deployTransaction.wait();
  console.log(`Dollar deployed: ${dollar.address}`);

  const governanceToken = await Governance.deploy({ gasPrice: await getFastGasPrice() });
  await governanceToken.deployTransaction.wait();
  console.log(`governanceToken deployed: ${governanceToken.address}`);

  // 2. Supply to Uniswap and create token pair
  const uniswapRouter = new ethers.Contract(UNISWAP_ROUTER, UniswapV2RouterArtifact.abi, user);
  console.log("minting tokens user");
  await dollar.mint(user.address, parseEther("4"), { gasPrice: await getFastGasPrice() });
  console.log("minting tokens treasury");
  await dollar.mint(TREASURY_ADDRESS, parseEther("4509"), { gasPrice: await getFastGasPrice() });
  console.log("getting dai");
  await uniswapRouter
    .connect(user)
    .swapExactETHForTokens(0, [WETH, DAI], user.address, await blockchainFuture(), {
      value: parseEther("0.01"),
      gasPrice: await getFastGasPrice(),
    })
    .then(x => x.wait());
  console.log("approving uniswap router dollar");
  await dollar
    .connect(user)
    .approve(uniswapRouter.address, ethers.constants.MaxUint256, {
      gasLimit: 1000000,
      gasPrice: await getFastGasPrice(),
    });
  console.log("approving uniswap router dai");
  await dollar
    .attach(DAI)
    .connect(user)
    .approve(uniswapRouter.address, ethers.constants.MaxUint256, {
      gasLimit: 1000000,
      gasPrice: await getFastGasPrice(),
    });
  console.log("adding liquidity");
  await uniswapRouter
    .connect(user)
    .addLiquidity(
      dollar.address,
      DAI,
      parseEther("2"),
      parseEther("2"),
      parseEther("2"),
      parseEther("2"),
      user.address,
      await blockchainFuture(),
      { gasLimit: 5000000, gasPrice: await getFastGasPrice() },
    );

  const uniswapFactory = new ethers.Contract(UNISWAP_FACTORY, UniswapFactoryArtifact.abi, user);
  const uniV2PairAddress = await uniswapFactory.getPair(dollar.address, DAI);

  // 3. Deploy implementation and dao
  const impl = await Implementation.deploy({ gasLimit: 1000000, gasPrice: await getFastGasPrice() });
  console.log("implementation", impl.address);
  await impl.deployTransaction.wait();
  const root = await Root.deploy(impl.address, { gasLimit: 1000000, gasPrice: await getFastGasPrice() });
  console.log("root", root.address);
  await root.deployTransaction.wait();

  const dao = new ethers.Contract(root.address, ImplementationArtifact.abi, user);

  // Change minter role
  await dollar.addMinter(dao.address, { gasLimit: 1000000, gasPrice: await getFastGasPrice() });
  console.log("dao renouncing minter");
  await dollar.renounceMinter({ gasPrice: await getFastGasPrice() });

  await governanceToken.addMinter(dao.address, { gasLimit: 1000000, gasPrice: await getFastGasPrice() });
  console.log("gov renouncing minter");
  await governanceToken.renounceMinter({ gasLimit: 1000000, gasPrice: await getFastGasPrice() });

  // 4. Deploy pool contracts

  // Bonding pool, you stake Dollars, and get Dollars OR Governance token as a reward
  // Don't want it to auto-compound
  const poolBonding = await PoolBonding.deploy(dao.address, dollar.address, dollar.address, governanceToken.address, {
    gasPrice: await getFastGasPrice(),
  });
  await poolBonding.deployTransaction.wait();
  console.log("poolBonding", poolBonding.address);

  const poolLP = await PoolLp.deploy(dao.address, uniV2PairAddress, dollar.address, {
    gasPrice: await getFastGasPrice(),
  });
  await poolLP.deployTransaction.wait();
  console.log("poolLP", poolLP.address);

  const poolGov = await PoolGov.deploy(dao.address, governanceToken.address, dollar.address, {
    gasPrice: await getFastGasPrice(),
  });
  await poolGov.deployTransaction.wait();
  console.log("poolGov", poolGov.address);

  // 5. Initialize dao
  await dao.initializeTokenAddresses(dollar.address, governanceToken.address, {
    gasLimit: 1000000,
    gasPrice: await getFastGasPrice(),
  });
  console.log("initializing dao tokens...");
  await dao.initializeOracle({ gasLimit: 1000000, gasPrice: await getFastGasPrice() });
  console.log("initializing dao oracle...");
  await dao.initializePoolAddresses(poolBonding.address, poolLP.address, poolGov.address, {
    gasLimit: 1000000,
    gasPrice: await getFastGasPrice(),
  });
  console.log("initializing dao pool...");

  // Output contract addresses
  console.log(
    JSON.stringify(
      {
        dao: dao.address,
        poolBonding: poolBonding.address,
        poolLP: poolLP.address,
        poolGov: poolGov.address,
        dollar: dollar.address,
        governanceToken: governanceToken.address,
        uniV2PairAddress,
      },
      null,
      4,
    ),
  );
};

main().catch(e => console.log("error", e));
