/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/equinix_contract.json`.
 */
export type EquinixContract = {
  "address": "8My2SGb47iBJW6D5dkCmfXoRU4cjg1p77aiuHDmwakJo",
  "metadata": {
    "name": "equinixContract",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initializeSplitter",
      "discriminator": [
        81,
        111,
        81,
        77,
        41,
        36,
        149,
        189
      ],
      "accounts": [
        {
          "name": "splitter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  108,
                  105,
                  116,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "merchant"
        },
        {
          "name": "agent"
        },
        {
          "name": "platform"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "merchantShare",
          "type": "u8"
        },
        {
          "name": "agentShare",
          "type": "u8"
        },
        {
          "name": "platformShare",
          "type": "u8"
        }
      ]
    },
    {
      "name": "splitPayment",
      "discriminator": [
        142,
        211,
        58,
        150,
        156,
        255,
        35,
        37
      ],
      "accounts": [
        {
          "name": "splitter",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  108,
                  105,
                  116,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "splitter.authority",
                "account": "splitter"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "payerTokenAccount",
          "writable": true
        },
        {
          "name": "merchantTokenAccount",
          "writable": true
        },
        {
          "name": "agentTokenAccount",
          "writable": true
        },
        {
          "name": "platformTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateShares",
      "discriminator": [
        31,
        59,
        15,
        141,
        227,
        50,
        179,
        253
      ],
      "accounts": [
        {
          "name": "splitter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  108,
                  105,
                  116,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "splitter"
          ]
        }
      ],
      "args": [
        {
          "name": "merchantShare",
          "type": "u8"
        },
        {
          "name": "agentShare",
          "type": "u8"
        },
        {
          "name": "platformShare",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "splitter",
      "discriminator": [
        187,
        177,
        147,
        182,
        44,
        155,
        130,
        202
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidShares",
      "msg": "Shares must add up to 100"
    }
  ],
  "types": [
    {
      "name": "splitter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "platform",
            "type": "pubkey"
          },
          {
            "name": "merchantShare",
            "type": "u8"
          },
          {
            "name": "agentShare",
            "type": "u8"
          },
          {
            "name": "platformShare",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
