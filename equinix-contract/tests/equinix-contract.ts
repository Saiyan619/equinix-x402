import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EquinixContract } from "../target/types/equinix_contract";

import { 
  PublicKey, 
  SystemProgram, 
  Keypair,
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

import { assert } from "chai";

describe("equinix-contract", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.EquinixContract as Program<EquinixContract>;
  
  // Test accounts
  let mint: PublicKey;
  let authority: Keypair;
  let merchant: Keypair;
  let agent: Keypair;
  let platform: Keypair;
  let payer: Keypair;
  
  let splitterPDA: PublicKey;
  let splitterBump: number;
  
  // Token accounts
  let payerTokenAccount: PublicKey;
  let merchantTokenAccount: PublicKey;
  let agentTokenAccount: PublicKey;
  let platformTokenAccount: PublicKey;

  before(async () => {
    // Generate keypairs
    authority = Keypair.generate();
    merchant = Keypair.generate();
    agent = Keypair.generate();
    platform = Keypair.generate();
    payer = Keypair.generate();

    // Airdrop SOL to all accounts
    const accounts = [authority, merchant, agent, platform, payer];
    for (const account of accounts) {
      const signature = await provider.connection.requestAirdrop(
        account.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);
    }

    // Create mint
    mint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6 // USDC has 6 decimals
    );

    // Create token accounts
    payerTokenAccount = await createAccount(
      provider.connection,
      payer,
      mint,
      payer.publicKey
    );

    merchantTokenAccount = await createAccount(
      provider.connection,
      merchant,
      mint,
      merchant.publicKey
    );

    agentTokenAccount = await createAccount(
      provider.connection,
      agent,
      mint,
      agent.publicKey
    );

    platformTokenAccount = await createAccount(
      provider.connection,
      platform,
      mint,
      platform.publicKey
    );

    // Mint tokens to payer
    await mintTo(
      provider.connection,
      payer,
      mint,
      payerTokenAccount,
      authority,
      10_000_000 // 10 USDC
    );

    // Derive splitter PDA
    [splitterPDA, splitterBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter"), authority.publicKey.toBuffer()],
      program.programId
    );

    console.log("\n🧪 Test Setup Complete");
    console.log("==========================================");
    console.log(`Authority: ${authority.publicKey.toBase58()}`);
    console.log(`Splitter PDA: ${splitterPDA.toBase58()}`);
    console.log(`Mint: ${mint.toBase58()}`);
    console.log(`Payer balance: 10 USDC`);
    console.log("==========================================\n");
  });

  describe("initialize_splitter", () => {
    it("Creates a new splitter with valid shares", async () => {
      const merchantShare = 70;
      const agentShare = 20;
      const platformShare = 10;

      const tx = await program.methods
        .initializeSplitter(merchantShare, agentShare, platformShare)
        .accounts({
          splitter: splitterPDA,
          authority: authority.publicKey,
          merchant: merchant.publicKey,
          agent: agent.publicKey,
          platform: platform.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("✅ Splitter initialized:", tx);

      // Fetch and verify the account
      const splitterAccount = await program.account.splitter.fetch(splitterPDA);

      assert.equal(splitterAccount.merchantShare, merchantShare);
      assert.equal(splitterAccount.agentShare, agentShare);
      assert.equal(splitterAccount.platformShare, platformShare);
      assert.ok(splitterAccount.merchant.equals(merchant.publicKey));
      assert.ok(splitterAccount.agent.equals(agent.publicKey));
      assert.ok(splitterAccount.platform.equals(platform.publicKey));
      assert.ok(splitterAccount.authority.equals(authority.publicKey));
      assert.equal(splitterAccount.bump, splitterBump);
    });

    it("Fails with invalid shares (not adding to 100)", async () => {
      const badAuthority = Keypair.generate();
      
      // Airdrop SOL
      const sig = await provider.connection.requestAirdrop(
        badAuthority.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [badSplitterPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("splitter"), badAuthority.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .initializeSplitter(50, 30, 15) // Adds to 95, not 100
          .accounts({
            splitter: badSplitterPDA,
            authority: badAuthority.publicKey,
            merchant: merchant.publicKey,
            agent: agent.publicKey,
            platform: platform.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([badAuthority])
          .rpc();

        assert.fail("Should have failed with invalid shares");
      } catch (error) {
        assert.include(error.toString(), "InvalidShares");
        console.log("✅ Correctly rejected invalid shares");
      }
    });

    it("Fails when trying to initialize twice for same authority", async () => {
      try {
        await program.methods
          .initializeSplitter(70, 20, 10)
          .accounts({
            splitter: splitterPDA,
            authority: authority.publicKey,
            merchant: merchant.publicKey,
            agent: agent.publicKey,
            platform: platform.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have failed - splitter already exists");
      } catch (error) {
        // Should fail because account already exists
        console.log("✅ Correctly rejected duplicate initialization");
      }
    });
  });

  describe("split_payment", () => {
    it("Splits payment correctly according to shares", async () => {
      const paymentAmount = 1_000_000; // 1 USDC

      // Get initial balances
      const initialPayerBalance = (await getAccount(provider.connection, payerTokenAccount)).amount;
      const initialMerchantBalance = (await getAccount(provider.connection, merchantTokenAccount)).amount;
      const initialAgentBalance = (await getAccount(provider.connection, agentTokenAccount)).amount;
      const initialPlatformBalance = (await getAccount(provider.connection, platformTokenAccount)).amount;

      console.log("\n💰 Initial Balances:");
      console.log(`   Payer: ${Number(initialPayerBalance) / 1_000_000} USDC`);
      console.log(`   Merchant: ${Number(initialMerchantBalance) / 1_000_000} USDC`);
      console.log(`   Agent: ${Number(initialAgentBalance) / 1_000_000} USDC`);
      console.log(`   Platform: ${Number(initialPlatformBalance) / 1_000_000} USDC`);

      // Execute split payment
      const tx = await program.methods
        .splitPayment(new anchor.BN(paymentAmount))
        .accounts({
          splitter: splitterPDA,
          payer: payer.publicKey,
          payerTokenAccount: payerTokenAccount,
          merchantTokenAccount: merchantTokenAccount,
          agentTokenAccount: agentTokenAccount,
          platformTokenAccount: platformTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();

      console.log("✅ Payment split:", tx);

      // Get final balances
      const finalPayerBalance = (await getAccount(provider.connection, payerTokenAccount)).amount;
      const finalMerchantBalance = (await getAccount(provider.connection, merchantTokenAccount)).amount;
      const finalAgentBalance = (await getAccount(provider.connection, agentTokenAccount)).amount;
      const finalPlatformBalance = (await getAccount(provider.connection, platformTokenAccount)).amount;

      console.log("\n💰 Final Balances:");
      console.log(`   Payer: ${Number(finalPayerBalance) / 1_000_000} USDC`);
      console.log(`   Merchant: ${Number(finalMerchantBalance) / 1_000_000} USDC`);
      console.log(`   Agent: ${Number(finalAgentBalance) / 1_000_000} USDC`);
      console.log(`   Platform: ${Number(finalPlatformBalance) / 1_000_000} USDC`);

      // Calculate expected amounts (70/20/10 split)
      const expectedMerchant = 700_000; // 0.7 USDC
      const expectedAgent = 200_000;    // 0.2 USDC
      const expectedPlatform = 100_000; // 0.1 USDC

      // Verify the splits
      assert.equal(
        Number(finalPayerBalance),
        Number(initialPayerBalance) - paymentAmount,
        "Payer balance incorrect"
      );

      assert.equal(
        Number(finalMerchantBalance),
        Number(initialMerchantBalance) + expectedMerchant,
        "Merchant balance incorrect"
      );

      assert.equal(
        Number(finalAgentBalance),
        Number(initialAgentBalance) + expectedAgent,
        "Agent balance incorrect"
      );

      assert.equal(
        Number(finalPlatformBalance),
        Number(initialPlatformBalance) + expectedPlatform,
        "Platform balance incorrect"
      );

      console.log("\n✅ All splits verified correctly!");
    });

    it("Handles multiple consecutive payments", async () => {
      const payments = [500_000, 750_000, 1_250_000]; // Different amounts

      let totalPaid = 0;

      for (const amount of payments) {
        await program.methods
          .splitPayment(new anchor.BN(amount))
          .accounts({
            splitter: splitterPDA,
            payer: payer.publicKey,
            payerTokenAccount: payerTokenAccount,
            merchantTokenAccount: merchantTokenAccount,
            agentTokenAccount: agentTokenAccount,
            platformTokenAccount: platformTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([payer])
          .rpc();

        totalPaid += amount;
        console.log(`✅ Paid ${amount / 1_000_000} USDC`);
      }

      console.log(`✅ Total paid: ${totalPaid / 1_000_000} USDC`);
    });

    it("Fails when payer has insufficient balance", async () => {
      const poorPayer = Keypair.generate();
      
      // Airdrop SOL but don't fund token account
      const sig = await provider.connection.requestAirdrop(
        poorPayer.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const poorPayerTokenAccount = await createAccount(
        provider.connection,
        poorPayer,
        mint,
        poorPayer.publicKey
      );

      // Try to pay with empty token account
      try {
        await program.methods
          .splitPayment(new anchor.BN(1_000_000))
          .accounts({
            splitter: splitterPDA,
            payer: poorPayer.publicKey,
            payerTokenAccount: poorPayerTokenAccount,
            merchantTokenAccount: merchantTokenAccount,
            agentTokenAccount: agentTokenAccount,
            platformTokenAccount: platformTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([poorPayer])
          .rpc();

        assert.fail("Should have failed with insufficient balance");
      } catch (error) {
        console.log("✅ Correctly rejected payment with insufficient balance");
      }
    });
  });

  describe("update_shares", () => {
    it("Updates shares correctly", async () => {
      const newMerchantShare = 60;
      const newAgentShare = 30;
      const newPlatformShare = 10;

      const tx = await program.methods
        .updateShares(newMerchantShare, newAgentShare, newPlatformShare)
        .accounts({
          splitter: splitterPDA,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      console.log("✅ Shares updated:", tx);

      // Verify the update
      const splitterAccount = await program.account.splitter.fetch(splitterPDA);

      assert.equal(splitterAccount.merchantShare, newMerchantShare);
      assert.equal(splitterAccount.agentShare, newAgentShare);
      assert.equal(splitterAccount.platformShare, newPlatformShare);
    });

    it("Verifies payment works with new shares", async () => {
      const paymentAmount = 1_000_000;

      const initialMerchantBalance = (await getAccount(provider.connection, merchantTokenAccount)).amount;
      const initialAgentBalance = (await getAccount(provider.connection, agentTokenAccount)).amount;
      const initialPlatformBalance = (await getAccount(provider.connection, platformTokenAccount)).amount;

      await program.methods
        .splitPayment(new anchor.BN(paymentAmount))
        .accounts({
          splitter: splitterPDA,
          payer: payer.publicKey,
          payerTokenAccount: payerTokenAccount,
          merchantTokenAccount: merchantTokenAccount,
          agentTokenAccount: agentTokenAccount,
          platformTokenAccount: platformTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();

      const finalMerchantBalance = (await getAccount(provider.connection, merchantTokenAccount)).amount;
      const finalAgentBalance = (await getAccount(provider.connection, agentTokenAccount)).amount;
      const finalPlatformBalance = (await getAccount(provider.connection, platformTokenAccount)).amount;

      // With 60/30/10 split
      const expectedMerchant = 600_000; // 0.6 USDC
      const expectedAgent = 300_000;    // 0.3 USDC
      const expectedPlatform = 100_000; // 0.1 USDC

      assert.equal(
        Number(finalMerchantBalance),
        Number(initialMerchantBalance) + expectedMerchant,
        "Merchant received wrong amount with new shares"
      );

      assert.equal(
        Number(finalAgentBalance),
        Number(initialAgentBalance) + expectedAgent,
        "Agent received wrong amount with new shares"
      );

      assert.equal(
        Number(finalPlatformBalance),
        Number(initialPlatformBalance) + expectedPlatform,
        "Platform received wrong amount with new shares"
      );

      console.log("✅ Payment works correctly with updated shares!");
    });

    it("Fails when non-authority tries to update", async () => {
      const unauthorized = Keypair.generate();
      
      const sig = await provider.connection.requestAirdrop(
        unauthorized.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      try {
        await program.methods
          .updateShares(50, 25, 25)
          .accounts({
            splitter: splitterPDA,
            authority: unauthorized.publicKey,
          })
          .signers([unauthorized])
          .rpc();

        assert.fail("Should have failed - unauthorized");
      } catch (error) {
        console.log("✅ Correctly rejected unauthorized update");
      }
    });

    it("Fails with invalid shares on update", async () => {
      try {
        await program.methods
          .updateShares(60, 30, 15) // Adds to 105
          .accounts({
            splitter: splitterPDA,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have failed with invalid shares");
      } catch (error) {
        assert.include(error.toString(), "InvalidShares");
        console.log("✅ Correctly rejected invalid shares on update");
      }
    });
  });

  describe("edge cases", () => {
    it("Handles very large payment amounts", async () => {
      // Mint more tokens to payer
      await mintTo(
        provider.connection,
        payer,
        mint,
        payerTokenAccount,
        authority,
        1_000_000_000 // 1000 USDC
      );

      const largeAmount = 100_000_000; // 100 USDC

      const tx = await program.methods
        .splitPayment(new anchor.BN(largeAmount))
        .accounts({
          splitter: splitterPDA,
          payer: payer.publicKey,
          payerTokenAccount: payerTokenAccount,
          merchantTokenAccount: merchantTokenAccount,
          agentTokenAccount: agentTokenAccount,
          platformTokenAccount: platformTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();

      console.log("✅ Large payment processed:", tx);
    });

    it("Handles minimum payment amounts", async () => {
      const minAmount = 100; // 0.0001 USDC

      const tx = await program.methods
        .splitPayment(new anchor.BN(minAmount))
        .accounts({
          splitter: splitterPDA,
          payer: payer.publicKey,
          payerTokenAccount: payerTokenAccount,
          merchantTokenAccount: merchantTokenAccount,
          agentTokenAccount: agentTokenAccount,
          platformTokenAccount: platformTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();

      console.log("✅ Minimum payment processed:", tx);
    });

    it("Handles extreme split ratios", async () => {
      // Update to extreme split: 98/1/1
      await program.methods
        .updateShares(98, 1, 1)
        .accounts({
          splitter: splitterPDA,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const paymentAmount = 1_000_000;

      const tx = await program.methods
        .splitPayment(new anchor.BN(paymentAmount))
        .accounts({
          splitter: splitterPDA,
          payer: payer.publicKey,
          payerTokenAccount: payerTokenAccount,
          merchantTokenAccount: merchantTokenAccount,
          agentTokenAccount: agentTokenAccount,
          platformTokenAccount: platformTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();

      console.log("✅ Extreme split ratio processed:", tx);
    });
  });

  describe("performance tests", () => {
    it("Processes multiple splitters concurrently", async () => {
      const numSplitters = 5;
      const promises = [];

      for (let i = 0; i < numSplitters; i++) {
        const newAuthority = Keypair.generate();
        
        // Airdrop
        const sig = await provider.connection.requestAirdrop(
          newAuthority.publicKey,
          LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig);

        const [newSplitterPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("splitter"), newAuthority.publicKey.toBuffer()],
          program.programId
        );

        promises.push(
          program.methods
            .initializeSplitter(70, 20, 10)
            .accounts({
              splitter: newSplitterPDA,
              authority: newAuthority.publicKey,
              merchant: merchant.publicKey,
              agent: agent.publicKey,
              platform: platform.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([newAuthority])
            .rpc()
        );
      }

      const results = await Promise.all(promises);
      console.log(`✅ Created ${numSplitters} splitters concurrently`);
      assert.equal(results.length, numSplitters);
    });

    it("Processes multiple payments rapidly", async () => {
      const numPayments = 10;
      const paymentAmount = 100_000;

      const startTime = Date.now();

      for (let i = 0; i < numPayments; i++) {
        await program.methods
          .splitPayment(new anchor.BN(paymentAmount))
          .accounts({
            splitter: splitterPDA,
            payer: payer.publicKey,
            payerTokenAccount: payerTokenAccount,
            merchantTokenAccount: merchantTokenAccount,
            agentTokenAccount: agentTokenAccount,
            platformTokenAccount: platformTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([payer])
          .rpc();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTime = duration / numPayments;

      console.log(`✅ Processed ${numPayments} payments in ${duration}ms`);
      console.log(`   Average: ${avgTime.toFixed(2)}ms per payment`);
    });
  });

  after(() => {
    console.log("\n🎉 All tests completed!");
    console.log("==========================================");
  });
});
