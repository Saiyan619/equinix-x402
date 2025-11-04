use anchor_lang::prelude::*;

declare_id!("FjcpHuBVNAZcrMecuNXcudnY5AWaUF4JJHvTc8gYkPED");

#[program]
pub mod equinix_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
