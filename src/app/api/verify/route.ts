import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import {
  verifySignature,
  getNftBalance,
  verifySpecificTokenTraits,
  verifyTraitsViaAlchemy,
  verifyTraitsViaOpenSea,
  withTimeout,
} from '@/lib/eth-verify';
import { assignGuildRole } from '@/lib/discord-api';
import { ObjectId } from 'mongodb';

/**
 * GET: Retrieve verification rules for a server.
 * Anyone can query rules (needed for the public verification page).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');

  if (!guildId) {
    return NextResponse.json({ error: 'Missing guildId parameter' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const rules = await db.collection('nft_rules').find({ guildId }).toArray();
    return NextResponse.json({ rules });
  } catch (err: any) {
    console.error('Error fetching verification rules:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: Submit signature and verify NFT holdings to grant a role.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const isBot = authHeader === `Bot ${process.env.DISCORD_BOT_TOKEN}`;

  let session = null;
  if (!isBot) {
    session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Please log in with Discord first' }, { status: 401 });
    }
  }

  try {
    const body = await req.json();
    const db = await getDb();

    // Handle bot-initiated auto-verification
    if (isBot && body.action === 'auto_verify') {
      const { discordId, guildId } = body;
      if (!discordId || !guildId) {
        return NextResponse.json({ error: 'Missing discordId or guildId' }, { status: 400 });
      }

      // 1. Check if user has a verified wallet registered
      const walletRecord = await db.collection('verified_wallets').findOne({ discordId });
      if (!walletRecord) {
        return NextResponse.json({
          success: false,
          error: 'no_wallet_linked',
          message: 'No wallet is linked to your Discord account. Please visit the dashboard link to verify and link your wallet.',
        });
      }

      const walletAddress = walletRecord.walletAddress;

      // 2. Fetch all rules for this guild
      const rules = await db.collection('nft_rules').find({ guildId }).toArray();
      if (rules.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'no_rules',
          message: 'No NFT verification rules are configured for this server.',
        });
      }

      const results = [];
      let anyAssigned = false;
      let anyEligible = false;

      for (const rule of rules) {
        const { contractAddress, network, ruleType, minQuantity, traitType, traitValue, roleId } = rule;
        let isEligible = false;

        try {
          if (ruleType === 'quantity') {
            const balance = await withTimeout(
              getNftBalance(contractAddress, walletAddress, network),
              8000,
              'NFT balance check timed out.'
            );
            const threshold = minQuantity || 1;
            isEligible = balance >= threshold;
          } else if (ruleType === 'trait') {
            // 1. Try OpenSea first
            const hasOpenSeaKey = !!process.env.OPENSEA_API_KEY;
            if (hasOpenSeaKey) {
              try {
                isEligible = await withTimeout(
                  verifyTraitsViaOpenSea(contractAddress, walletAddress, traitType, traitValue, network),
                  7000,
                  'OpenSea verification timed out.'
                );
              } catch (osErr) {
                console.error('OpenSea auto-verify error, falling back to Alchemy:', osErr);
              }
            }

            // 2. Fallback to Alchemy if not eligible and Alchemy key is present
            if (!isEligible && process.env.ALCHEMY_API_KEY) {
              try {
                isEligible = await withTimeout(
                  verifyTraitsViaAlchemy(contractAddress, walletAddress, traitType, traitValue, network),
                  7000,
                  'Alchemy verification timed out.'
                );
              } catch (alErr) {
                console.error('Alchemy auto-verify error:', alErr);
              }
            }
          }

          if (isEligible) {
            anyEligible = true;
            const assigned = await assignGuildRole(guildId, discordId, roleId);
            if (assigned) {
              anyAssigned = true;
              results.push({ roleId, success: true });

              // Save verification record
              await db.collection('verified_users').updateOne(
                { discordId, guildId, roleId },
                {
                  $set: {
                    discordId,
                    guildId,
                    roleId,
                    walletAddress,
                    contractAddress,
                    verifiedAt: new Date(),
                  },
                },
                { upsert: true }
              );
            } else {
              results.push({ roleId, success: false, error: 'Failed to assign role (check bot role permissions hierarchy)' });
            }
          }
        } catch (err: any) {
          console.error(`Auto verify failed for rule ${rule._id}:`, err);
          results.push({ roleId, success: false, error: err.message });
        }
      }

      if (anyAssigned) {
        return NextResponse.json({
          success: true,
          walletAddress,
          message: 'Successfully verified holdings and updated your server roles!',
          results,
        });
      } else if (anyEligible) {
        return NextResponse.json({
          success: false,
          error: 'role_assignment_failed',
          walletAddress,
          message: 'You hold the required NFTs, but the bot lacks permission to assign the role. Please ask server admins to move the "Organik Bot" role higher in Server Settings.',
          results,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'not_eligible',
          walletAddress,
          message: `Holdings checked for wallet ${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}, but you do not hold the required NFTs.`,
          results,
        });
      }
    }

    // Handle regular signature verification from the website
    const { action, signature, message, walletAddress, guildId } = body;

    if (action === 'link_wallet') {
      if (!signature || !message || !walletAddress || !guildId) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
      }

      // 1. Validate cryptographic signature
      const isValidSig = verifySignature(message, signature, walletAddress);
      if (!isValidSig) {
        return NextResponse.json({ error: 'Cryptographic signature verification failed' }, { status: 400 });
      }

      // 2. Ensure the message contains the user's actual Discord ID
      if (!session || !message.includes(session.discordId)) {
        return NextResponse.json(
          { error: 'Signature security check failed: Message does not contain your Discord ID' },
          { status: 400 }
        );
      }

      // 3. Save verification records in DB
      await db.collection('verified_wallets').updateOne(
        { discordId: session.discordId, guildId },
        {
          $set: {
            discordId: session.discordId,
            guildId,
            walletAddress,
            verifiedAt: new Date(),
          },
        },
        { upsert: true }
      );

      return NextResponse.json({
        success: true,
        message: 'Wallet linked successfully! You can now close this tab and return to Discord to click the green Verify button.',
      });
    }

    const { ruleId, tokenId } = body;
    if (!signature || !message || !walletAddress || !guildId || !ruleId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch the NFT verification rule
    let rule;
    try {
      rule = await db.collection('nft_rules').findOne({ _id: new ObjectId(ruleId) });
    } catch {
      return NextResponse.json({ error: 'Invalid rule ID format' }, { status: 400 });
    }

    if (!rule || rule.guildId !== guildId) {
      return NextResponse.json({ error: 'NFT verification rule not found' }, { status: 404 });
    }

    // 2. Validate cryptographic signature (authenticates the user owns the wallet)
    const isValidSig = verifySignature(message, signature, walletAddress);
    if (!isValidSig) {
      return NextResponse.json({ error: 'Cryptographic signature verification failed' }, { status: 400 });
    }

    // 3. Ensure the message contains the user's actual Discord ID to prevent signature spoofing
    if (!session || !message.includes(session.discordId)) {
      return NextResponse.json(
        { error: 'Signature security check failed: Message does not contain your Discord ID' },
        { status: 400 }
      );
    }

    // 4. Perform blockchain checks
    const { contractAddress, network, ruleType, minQuantity, traitType, traitValue, roleId } = rule;
    let isEligible = false;
    let detailsMessage = '';

    if (ruleType === 'quantity') {
      const balance = await withTimeout(
        getNftBalance(contractAddress, walletAddress, network),
        8000,
        'NFT balance check timed out.'
      );
      const threshold = minQuantity || 1;
      isEligible = balance >= threshold;
      detailsMessage = `NFT balance checked: Found ${balance}. Required: ${threshold}+`;
    } else if (ruleType === 'trait') {
      // 1. Try OpenSea first
      const hasOpenSeaKey = !!process.env.OPENSEA_API_KEY;
      if (hasOpenSeaKey) {
        try {
          isEligible = await withTimeout(
            verifyTraitsViaOpenSea(contractAddress, walletAddress, traitType, traitValue, network),
            7000,
            'OpenSea verification timed out.'
          );
          if (isEligible) {
            detailsMessage = 'Matching trait verified automatically via OpenSea API.';
          }
        } catch (osErr) {
          console.error('OpenSea web-verify error:', osErr);
        }
      }

      // 2. Fallback to Alchemy if not eligible and Alchemy key is present
      if (!isEligible && process.env.ALCHEMY_API_KEY) {
        try {
          isEligible = await withTimeout(
            verifyTraitsViaAlchemy(contractAddress, walletAddress, traitType, traitValue, network),
            7000,
            'Alchemy verification timed out.'
          );
          if (isEligible) {
            detailsMessage = 'Matching trait verified automatically via Alchemy API.';
          }
        } catch (alErr) {
          console.error('Alchemy web-verify error:', alErr);
        }
      }

      if (!isEligible) {
        detailsMessage = 'No matching traits found automatically via API.';
      }

      // If not verified via Alchemy and user provided a specific Token ID, try manual on-chain verification
      if (!isEligible && tokenId) {
        const manualResult = await verifySpecificTokenTraits(
          contractAddress,
          walletAddress,
          tokenId.toString().trim(),
          traitType,
          traitValue,
          network
        );
        isEligible = manualResult.success;
        detailsMessage = manualResult.message;
      }

      // If still not verified and no token ID was provided, ask the user to provide one
      if (!isEligible && !tokenId && !process.env.ALCHEMY_API_KEY) {
        return NextResponse.json(
          {
            error: 'Trait verification requires a Token ID. Please input a Token ID you own to proceed with verification.',
            requiresTokenId: true,
          },
          { status: 400 }
        );
      }
    }

    if (!isEligible) {
      return NextResponse.json(
        { error: detailsMessage || 'You do not meet the holdings requirement for this contract.' },
        { status: 400 }
      );
    }

    // 5. Award the Discord role
    const assigned = await assignGuildRole(guildId, session.discordId, roleId);
    if (!assigned) {
      return NextResponse.json(
        {
          error:
            'Failed to assign Discord role. Please make sure the bot has "Manage Roles" permission and its role is positioned above the role it is trying to assign.',
        },
        { status: 500 }
      );
    }

    // 6. Save verification records in DB
    await db.collection('verified_users').updateOne(
      { discordId: session.discordId, guildId, roleId },
      {
        $set: {
          discordId: session.discordId,
          guildId,
          roleId,
          walletAddress,
          contractAddress,
          verifiedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await db.collection('verified_wallets').updateOne(
      { discordId: session.discordId, guildId },
      {
        $set: {
          discordId: session.discordId,
          guildId,
          walletAddress,
          verifiedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Verification successful! The role has been assigned to your Discord account.',
    });
  } catch (err: any) {
    console.error('Verify route error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE: Admin deleting a verification rule.
 */
export async function DELETE(req: NextRequest) {
  const session = getSession(req);
  const { searchParams } = new URL(req.url);
  const ruleId = searchParams.get('ruleId');
  const guildId = searchParams.get('guildId');

  if (!ruleId || !guildId) {
    return NextResponse.json({ error: 'Missing ruleId or guildId' }, { status: 400 });
  }

  // Authorize admin
  const isAdmin = await verifyGuildAdmin(session, guildId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = await getDb();
    await db.collection('nft_rules').deleteOne({ _id: new ObjectId(ruleId), guildId });
    return NextResponse.json({ success: true, message: 'Rule deleted successfully' });
  } catch (err: any) {
    console.error('Delete rule error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete rule' }, { status: 500 });
  }
}

/**
 * PUT: Admin creating a new verification rule.
 */
export async function PUT(req: NextRequest) {
  const session = getSession(req);

  try {
    const { guildId, contractAddress, roleId, network, ruleType, minQuantity, traitType, traitValue } =
      await req.json();

    if (!guildId || !contractAddress || !roleId || !network || !ruleType) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Authorize admin
    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const newRule: any = {
      guildId,
      contractAddress: contractAddress.trim().toLowerCase(),
      roleId,
      network,
      ruleType,
      createdAt: new Date(),
    };

    if (ruleType === 'quantity') {
      newRule.minQuantity = Math.max(1, Number(minQuantity) || 1);
    } else if (ruleType === 'trait') {
      if (!traitType || !traitValue) {
        return NextResponse.json({ error: 'Trait type and value are required for trait rules' }, { status: 400 });
      }
      newRule.traitType = traitType.trim();
      newRule.traitValue = traitValue.trim();
    }

    const result = await db.collection('nft_rules').insertOne(newRule);

    return NextResponse.json({
      success: true,
      rule: {
        _id: result.insertedId,
        ...newRule,
      },
    });
  } catch (err: any) {
    console.error('Create rule error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create rule' }, { status: 500 });
  }
}
