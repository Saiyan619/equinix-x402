use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("8My2SGb47iBJW6D5dkCmfXoRU4cjg1p77aiuHDmwakJo");

#[program]
pub mod equinix_contract {
   use super::*;

    pub fn initialize_splitter(
        ctx: Context<InitializeSplitter>,
        merchant_share: u8,
        agent_share: u8,
        platform_share: u8,
    ) -> Result<()> {
        require!(
            merchant_share + agent_share + platform_share == 100,
            ErrorCode::InvalidShares
        );

        let splitter = &mut ctx.accounts.splitter;
        splitter.merchant = ctx.accounts.merchant.key();
        splitter.agent = ctx.accounts.agent.key();
        splitter.platform = ctx.accounts.platform.key();
        splitter.merchant_share = merchant_share;
        splitter.agent_share = agent_share;
        splitter.platform_share = platform_share;
        splitter.authority = ctx.accounts.authority.key();
        splitter.bump = ctx.bumps.splitter;

        msg!("Splitter initialized! PDA: {}", splitter.key());
        msg!("Merchant: {}% to {}", merchant_share, splitter.merchant);
        msg!("Agent: {}% to {}", agent_share, splitter.agent);
        msg!("Platform: {}% to {}", platform_share, splitter.platform);

        Ok(())
    }

    pub fn split_payment(ctx: Context<SplitPayment>, amount: u64) -> Result<()> {
        let splitter = &ctx.accounts.splitter;

        // Calculate split amounts
        let merchant_amount = (amount * splitter.merchant_share as u64) / 100;
        let agent_amount = (amount * splitter.agent_share as u64) / 100;
        let platform_amount = (amount * splitter.platform_share as u64) / 100;

        msg!("Splitting {} tokens", amount);
        msg!("Merchant gets: {}", merchant_amount);
        msg!("Agent gets: {}", agent_amount);
        msg!("Platform gets: {}", platform_amount);

        // Transfer to merchant
        let cpi_accounts = Transfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: ctx.accounts.merchant_token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts);
        token::transfer(cpi_ctx, merchant_amount)?;

        // Transfer to agent
        let cpi_accounts = Transfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: ctx.accounts.agent_token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts);
        token::transfer(cpi_ctx, agent_amount)?;

        // Transfer to platform
        let cpi_accounts = Transfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: ctx.accounts.platform_token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, platform_amount)?;

        msg!("Payment split complete!");
        Ok(())
    }

    pub fn update_shares(
        ctx: Context<UpdateShares>,
        merchant_share: u8,
        agent_share: u8,
        platform_share: u8,
    ) -> Result<()> {
        require!(
            merchant_share + agent_share + platform_share == 100,
            ErrorCode::InvalidShares
        );

        let splitter = &mut ctx.accounts.splitter;
        splitter.merchant_share = merchant_share;
        splitter.agent_share = agent_share;
        splitter.platform_share = platform_share;

        msg!("Shares updated!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeSplitter<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Splitter::INIT_SPACE,
        seeds = [b"splitter", authority.key().as_ref()],
        bump
    )]
    pub splitter: Account<'info, Splitter>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: Merchant wallet address
    pub merchant: AccountInfo<'info>,
    
    /// CHECK: Agent wallet address
    pub agent: AccountInfo<'info>,
    
    /// CHECK: Platform wallet address
    pub platform: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SplitPayment<'info> {
    #[account(
        seeds = [b"splitter", splitter.authority.as_ref()],
        bump = splitter.bump
    )]
    pub splitter: Account<'info, Splitter>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(mut)]
    pub payer_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub merchant_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub platform_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateShares<'info> {
    #[account(
        mut,
        seeds = [b"splitter", authority.key().as_ref()],
        bump = splitter.bump,
        has_one = authority
    )]
    pub splitter: Account<'info, Splitter>,
    
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Splitter {
    pub merchant: Pubkey,
    pub agent: Pubkey,
    pub platform: Pubkey,
    pub merchant_share: u8,
    pub agent_share: u8,
    pub platform_share: u8,
    pub authority: Pubkey,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Shares must add up to 100")]
    InvalidShares,
}