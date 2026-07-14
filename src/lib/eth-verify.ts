import { ethers } from 'ethers';

// Default RPC providers
const DEFAULT_RPC_URLS: Record<string, string> = {
  ethereum: 'https://cloudflare-eth.com',
  sepolia: 'https://rpc.ankr.com/eth_sepolia',
  polygon: 'https://polygon-rpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  base: 'https://mainnet.base.org',
};

// ABI definitions
const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function uri(uint256 id) view returns (string)',
];

/**
 * Verifies that a signature was signed by the claimed wallet address.
 */
export function verifySignature(message: string, signature: string, walletAddress: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (err) {
    console.error('Error verifying signature:', err);
    return false;
  }
}

/**
 * Resolves IPFS URLs to public gateway URLs.
 */
export function resolveIpfsUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('ipfs://')) {
    // Standard ipfs:// CID/path
    return url.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
  }
  if (url.includes('/ipfs/Qm')) {
    // Sub-path format
    const idx = url.indexOf('/ipfs/');
    return 'https://cloudflare-ipfs.com' + url.substring(idx);
  }
  return url;
}

/**
 * Gets a provider for the selected network.
 */
export function getProvider(network: string): ethers.JsonRpcProvider {
  let rpcUrl = '';
  if (network === 'ethereum') rpcUrl = process.env.ETH_RPC_URL || '';
  else if (network === 'base') rpcUrl = process.env.BASE_RPC_URL || '';
  else if (network === 'polygon') rpcUrl = process.env.POLYGON_RPC_URL || '';
  else if (network === 'arbitrum') rpcUrl = process.env.ARBITRUM_RPC_URL || '';
  else if (network === 'optimism') rpcUrl = process.env.OPTIMISM_RPC_URL || '';
  else if (network === 'sepolia') rpcUrl = process.env.SEPOLIA_RPC_URL || '';

  if (!rpcUrl) {
    rpcUrl = DEFAULT_RPC_URLS[network] || DEFAULT_RPC_URLS.ethereum;
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Fetches the NFT balance for a user wallet.
 */
export async function getNftBalance(
  contractAddress: string,
  walletAddress: string,
  network = 'ethereum'
): Promise<number> {
  try {
    const provider = getProvider(network);
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    const balance = await contract.balanceOf(walletAddress);
    return Number(balance);
  } catch (err) {
    console.error('Error checking ERC-721 balance, trying ERC-1155...', err);
    // If it's ERC-1155, balanceOf requires tokenId. So we return 0 here and rely on token-based checks if ERC-721 fails.
    return 0;
  }
}

/**
 * Verifies traits of a specific token owned by the user.
 */
export async function verifySpecificTokenTraits(
  contractAddress: string,
  walletAddress: string,
  tokenId: string,
  traitType: string,
  traitValue: string,
  network = 'ethereum'
): Promise<{ success: boolean; message: string }> {
  try {
    const provider = getProvider(network);
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

    // 1. Verify owner of the tokenId
    let owner: string;
    try {
      owner = await contract.ownerOf(tokenId);
    } catch {
      // Try ERC-1155 check (needs balance of wallet > 0)
      const erc1155Contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
      const balance = await erc1155Contract.balanceOf(walletAddress, tokenId);
      if (Number(balance) > 0) {
        owner = walletAddress;
      } else {
        return { success: false, message: 'You do not own this Token ID or contract does not exist.' };
      }
    }

    if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
      return { success: false, message: `Token ID ${tokenId} is owned by another address: ${owner}` };
    }

    // 2. Fetch tokenURI
    let tokenUri: string;
    try {
      tokenUri = await contract.tokenURI(tokenId);
    } catch {
      try {
        const erc1155Contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
        tokenUri = await erc1155Contract.uri(tokenId);
      } catch {
        return { success: false, message: 'Failed to retrieve NFT metadata URI from contract.' };
      }
    }

    // Replace tokenId template in ERC1155 URI if present (e.g. {id})
    if (tokenUri.includes('{id}')) {
      const hexTokenId = BigInt(tokenId).toString(16).padStart(64, '0');
      tokenUri = tokenUri.replace('{id}', hexTokenId);
    }

    const resolvedUrl = resolveIpfsUrl(tokenUri);
    if (!resolvedUrl) {
      return { success: false, message: 'Invalid token metadata URL.' };
    }

    // 3. Fetch metadata JSON
    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      return { success: false, message: 'Could not fetch NFT metadata from IPFS or gateway.' };
    }

    const metadata = await response.json();
    const attributes = metadata.attributes || metadata.traits || [];

    // 4. Validate traits
    const match = attributes.some((attr: any) => {
      const currentType = attr.trait_type || attr.name || '';
      const currentValue = attr.value || '';
      return (
        currentType.toString().trim().toLowerCase() === traitType.trim().toLowerCase() &&
        currentValue.toString().trim().toLowerCase() === traitValue.trim().toLowerCase()
      );
    });

    if (match) {
      return { success: true, message: 'Verification successful.' };
    } else {
      return { success: false, message: `NFT does not have trait [${traitType}: ${traitValue}]` };
    }
  } catch (err: any) {
    console.error('Error verifying token traits:', err);
    return { success: false, message: `Verification failed: ${err.message}` };
  }
}

/**
 * Automates NFT checking using Alchemy's NFT API if available.
 * Returns true if the user owns any NFT in the contract that matches the rules.
 */
export async function verifyTraitsViaAlchemy(
  contractAddress: string,
  walletAddress: string,
  traitType: string,
  traitValue: string,
  network = 'ethereum'
): Promise<boolean> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) return false;

  // Map network names to Alchemy subdomains
  const ALCHEMY_SUBDOMAINS: Record<string, string> = {
    ethereum: 'eth-mainnet',
    sepolia: 'eth-sepolia',
    polygon: 'polygon-mainnet',
    arbitrum: 'arb-mainnet',
    optimism: 'opt-mainnet',
    base: 'base-mainnet',
  };

  const subdomain = ALCHEMY_SUBDOMAINS[network] || 'eth-mainnet';
  const url = `https://${subdomain}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${walletAddress}&contractAddresses[]=${contractAddress}&withMetadata=true`;

  try {
    const res = await fetch(url);
    if (!res.ok) return false;

    const data = await res.json();
    const ownedNfts = data.ownedNfts || [];

    for (const nft of ownedNfts) {
      const attributes = nft.raw?.metadata?.attributes || nft.raw?.metadata?.traits || [];
      const hasTrait = attributes.some((attr: any) => {
        const currentType = attr.trait_type || attr.name || '';
        const currentValue = attr.value || '';
        return (
          currentType.toString().trim().toLowerCase() === traitType.trim().toLowerCase() &&
          currentValue.toString().trim().toLowerCase() === traitValue.trim().toLowerCase()
        );
      });

      if (hasTrait) {
        return true; // Found matching NFT trait!
      }
    }
    return false;
  } catch (err) {
    console.error('Alchemy verification error:', err);
    return false;
  }
}
