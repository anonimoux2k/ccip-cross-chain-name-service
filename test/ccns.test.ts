import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  CrossChainNameServiceLookup,
  CrossChainNameServiceRegister,
  CrossChainNameServiceReceiver,
  CCIPLocalSimulator,
} from "../typechain-types";
import { BigNumber } from "ethers";

describe("CCNS", function () {
  async function deployFixture() {
    const [alice] = await ethers.getSigners();

    const ccipLocalSimualtorFactory = await ethers.getContractFactory(
      "CCIPLocalSimulator"
    );
    // 1. Create an instance of CCIPLocalSimulator.sol smart contract
    const ccipLocalSimulator: CCIPLocalSimulator =
      await ccipLocalSimualtorFactory.deploy();

    // 2. Call the configuration() function to get Router contract address
    const config: {
      chainSelector_: BigNumber;
      sourceRouter_: string;
      destinationRouter_: string;
      wrappedNative_: string;
      linkToken_: string;
      ccipBnM_: string;
      ccipLnM_: string;
    } = await ccipLocalSimulator.configuration();

    // 3. Create instances of CrossChainNameServiceRegister.sol, CrossChainNameServiceReceiver.sol and
    // CrossChainNameServiceLookup.sol smart contracts
    const lookupFactory = await ethers.getContractFactory(
      "CrossChainNameServiceLookup"
    );
    const lookupSource: CrossChainNameServiceLookup =
      await lookupFactory.deploy();
    const lookupReceiver: CrossChainNameServiceLookup =
      await lookupFactory.deploy();

    const registerFactory = await ethers.getContractFactory(
      "CrossChainNameServiceRegister"
    );
    const register: CrossChainNameServiceRegister =
      await registerFactory.deploy(
        config.destinationRouter_,
        lookupSource.address
      );

    const receiverFactory = await ethers.getContractFactory(
      "CrossChainNameServiceReceiver"
    );
    const receiver: CrossChainNameServiceReceiver =
      await receiverFactory.deploy(
        config.destinationRouter_,
        lookupReceiver.address,
        config.chainSelector_
      );

    return {
      ccipLocalSimulator,
      alice,
      config,
      lookupSource,
      lookupReceiver,
      register,
      receiver,
    };
  }

  it("Should register and lookup 'alice.ccns' correctly", async function () {
    const {
      ccipLocalSimulator,
      alice,
      config,
      lookupSource,
      lookupReceiver,
      register,
      receiver,
    } = await loadFixture(deployFixture);

    // 4. Call the setCrossChainNameServiceAddress function of the CrossChainNameServiceLookup.sol smart contract "source" instance
    // and provide the address of the CrossChainNameServiceRegister.sol smart contract instance.
    // Repeat the process for the CrossChainNameServiceLookup.sol smart contract "receiver" instance
    // and provide the address of the CrossChainNameServiceReceiver.sol smart contract instance.
    await lookupSource.setCrossChainNameServiceAddress(register.address);
    await lookupReceiver.setCrossChainNameServiceAddress(receiver.address);

    // 3.1. Enable the chain in the Register contract for cross-chain registration
    await register.enableChain(
      config.chainSelector_,
      receiver.address,
      500_000
    );

    // 5. Call the register() function and provide “alice.ccns” and Alice’s EOA address as function arguments.
    await register.connect(alice).register("alice.ccns"); // Alices's EOA address is the msg.sender

    // 6. Call the lookup() function and provide “alice.ccns” as a function argument. Assert that the returned address is Alice’s EOA address
    let result = await lookupSource.lookup("alice.ccns");
    expect(result).to.equal(alice.address);
    result = await lookupReceiver.lookup("alice.ccns");
    expect(result).to.equal(alice.address);
  });
});
