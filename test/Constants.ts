import { BN } from "./Utils";

export const FROZEN = BN(0);
export const FLUID = BN(1);
export const LOCKED = BN(2);

export const INITIAL_STAKE_MULTIPLE = BN(10).pow(BN(6)); // 100 ESD -> 100M ESDS

export const VOTE_PERIOD = BN(9);
export const EXPIRATION = BN(3);
export const EMERGENCY_COMMIT_PERIOD = BN(6);

export const UNDECIDED = BN(0);
export const APPROVE = BN(1);
export const REJECT = BN(2);

export const TREASURY_ADDRESS = "0x61c32f08B0cbe61feF4166f09363504b4b5F38d8";
export const POOL_LP_REWARD_PERCENT = BN(27);
export const POOL_BONDING_REWARD_PERCENT = BN(63);
export const TREASURY_REWARD_PERCENT = BN(10);

export const CURRENT_EPOCH_START = 1600905600;
export const CURRENT_EPOCH_PERIOD = 14400;

export const SUPPLY_CHANGE_LIMIT = 0.054; // 5.4$
export const BOOTSTRAPPING_PERIOD = 72;
