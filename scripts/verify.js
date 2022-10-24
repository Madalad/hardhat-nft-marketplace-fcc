const { ethers, network } = require("hardhat")
const { verify } = require("../utils/verify")

async function main() {
    // 0xf953Ddd29ff90D29F4c15d95b9A8f79D2A57203e - NftMarketplace
    // 0x69b8716bacC420B1644BBa1aDeeDD5e3a3A7f670 - BasicNft

    const contractAddress = "0x69b8716bacC420B1644BBa1aDeeDD5e3a3A7f670"
    const constructorArguments = []
    console.log(`Verifying contract at ${contractAddress}...`)
    await verify(contractAddress, constructorArguments)
    console.log("Contract verified.")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
