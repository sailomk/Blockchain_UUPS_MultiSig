require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: "0.8.28",
	networks: {
		hardhat: {
			// This sets the block gas limit for the Hardhat Network
			// Default is usually 30,000,000. If your transaction is very large,
			// you might need to increase it, but 10M for a single tx is already high.
			blockGasLimit: 30_000_000, // Example: Increase if needed, but 30M is standard
		},
	},
};
